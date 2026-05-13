const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUTPUT_DIR = path.join(__dirname, 'output');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Ensure dirs
[OUTPUT_DIR, PUBLIC_DIR, TEMPLATES_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Config helpers
function loadConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch { return {}; }
}
function saveConfig(data) {
    const current = loadConfig();
    const merged = { ...current, ...data };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
    return merged;
}

const mimeTypes = {
    '.html': 'text/html', '.js': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2', '.woff': 'font/woff',
};

// ============================================
// HTTPS request helper (for Claude & ImgBB)
// ============================================
function httpsRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

// ============================================
// SERVER
// ============================================
const server = http.createServer(async (req, res) => {
    console.log(`[${req.method}] ${req.url}`);

    // --- CORS & JSON helpers ---
    const sendJSON = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
    };

    // --- Collect POST body ---
    const getBody = () => new Promise((resolve) => {
        let body = '';
        req.on('data', c => body += c.toString());
        req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(body); } });
    });

    // ==========================================
    // API ROUTES
    // ==========================================

    // --- Save / Load Config (API Keys) ---
    if (req.method === 'GET' && req.url === '/api/config') {
        const cfg = loadConfig();
        // Mask keys for security
        const masked = { ...cfg };
        if (masked.claudeApiKey) masked.claudeApiKey = masked.claudeApiKey.slice(0, 8) + '...' + masked.claudeApiKey.slice(-4);
        if (masked.imgbbApiKey) masked.imgbbApiKey = masked.imgbbApiKey.slice(0, 6) + '...' + masked.imgbbApiKey.slice(-4);
        if (masked.geminiApiKey) masked.geminiApiKey = masked.geminiApiKey.slice(0, 6) + '...' + masked.geminiApiKey.slice(-4);
        return sendJSON(200, masked);
    }

    if (req.method === 'POST' && req.url === '/api/config') {
        const data = await getBody();
        const saved = saveConfig(data);
        console.log('[CONFIG] Keys updated.');
        return sendJSON(200, { success: true });
    }

    // --- Template Engine Routes ---
    if (req.method === 'GET' && req.url === '/api/templates') {
        try {
            const categories = {};
            // Scan TEMPLATES_DIR
            if (fs.existsSync(TEMPLATES_DIR)) {
                const dirs = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);

                for (const cat of dirs) {
                    categories[cat] = [];
                    const catPath = path.join(TEMPLATES_DIR, cat);
                    const templates = fs.readdirSync(catPath, { withFileTypes: true })
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => dirent.name);

                    for (const tName of templates) {
                        const tPath = path.join(catPath, tName);
                        const hasHtml = fs.existsSync(path.join(tPath, 'index.html'));
                        const metaPath = path.join(tPath, 'meta.json');
                        let meta = { name: tName, preview: '' };
                        if (fs.existsSync(metaPath)) {
                            try { meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, 'utf8')) }; } catch (e) { }
                        }
                        if (hasHtml) {
                            categories[cat].push({ id: `${cat}/${tName}`, name: meta.name, preview: meta.preview });
                        }
                    }
                }
            }
            return sendJSON(200, categories);
        } catch (err) {
            console.error('[TEMPLATE ERROR]', err);
            return sendJSON(500, { error: 'Failed to load templates' });
        }
    }

    if (req.method === 'POST' && req.url === '/api/templates') {
        try {
            const data = await getBody();
            // { category: 'hero', name: 'modern-hero', html: '...', css: '...', previewUrl: '...' }
            if (!data.category || !data.name || !data.html) {
                return sendJSON(400, { error: 'Missing category, name, or html' });
            }

            const catId = data.category.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
            const tId = data.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

            const targetDir = path.join(TEMPLATES_DIR, catId, tId);
            fs.mkdirSync(targetDir, { recursive: true });

            fs.writeFileSync(path.join(targetDir, 'index.html'), data.html);
            if (data.css) {
                fs.writeFileSync(path.join(targetDir, 'style.css'), data.css);
            }

            const meta = { name: data.name, preview: data.previewUrl || '' };
            fs.writeFileSync(path.join(targetDir, 'meta.json'), JSON.stringify(meta, null, 2));

            console.log(`[TEMPLATE] Saved template: ${catId}/${tId}`);
            return sendJSON(200, { success: true, id: `${catId}/${tId}` });
        } catch (err) {
            console.error('[TEMPLATE ERROR]', err);
            return sendJSON(500, { error: 'Failed to save template' });
        }
    }

    // --- Gemini AI Proxy ---
    if (req.method === 'POST' && req.url === '/api/gemini') {
        const data = await getBody();
        const config = loadConfig();
        const apiKey = config.geminiApiKey;

        if (!apiKey) return sendJSON(400, { error: 'Gemini API key not set.' });

        try {
            const payload = JSON.stringify({
                contents: [{ parts: [{ text: data.prompt }] }]
            });

            console.log('[GEMINI] Sending request...');
            const result = await httpsRequest({
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, payload);

            console.log('[GEMINI] Status:', result.status);

            if (result.status !== 200) {
                console.error('[GEMINI ERROR]', result.body);
                const msg = result.body?.error?.message || JSON.stringify(result.body);
                return res.end(`[API Error: ${msg}]`);
            }

            const text = result.body.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                console.log('[GEMINI EMPTY]', JSON.stringify(result.body));

                // Check for safety filters
                const safety = result.body.promptFeedback?.blockReason || result.body.candidates?.[0]?.finishReason;
                if (safety) {
                    return res.end(`[Blocked by Safety: ${safety}]`);
                }

                return res.end('[No response from Gemini - Candidate Empty]');
            }

            res.end(text);
        } catch (err) {
            console.error('[GEMINI PROXY CRASH]', err.message);
            res.end(`[Error: ${err.message}]`);
        }
    }

    // --- Info Spy: Search + Scrape + AI Extract ---
    if (req.method === 'POST' && req.url === '/api/spy') {
        const data = await getBody();
        const businessName = data.query || data.url;

        if (!businessName) return sendJSON(400, { error: 'No business name provided.' });

        try {
            // Helper: fetch any URL with redirect support
            function fetchUrl(targetUrl) {
                return new Promise((resolve, reject) => {
                    const urlObj = new URL(targetUrl);
                    const client = urlObj.protocol === 'https:' ? https : http;
                    client.get(targetUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml',
                            'Accept-Language': 'en-US,en;q=0.9'
                        }
                    }, (fetchRes) => {
                        if (fetchRes.statusCode >= 300 && fetchRes.statusCode < 400 && fetchRes.headers.location) {
                            let redirectUrl = fetchRes.headers.location;
                            if (redirectUrl.startsWith('/')) redirectUrl = urlObj.origin + redirectUrl;
                            fetchUrl(redirectUrl).then(resolve).catch(reject);
                            return;
                        }
                        let d = '';
                        fetchRes.on('data', c => d += c);
                        fetchRes.on('end', () => resolve(d));
                    }).on('error', reject);
                });
            }

            // Helper: POST to a URL (used for DuckDuckGo search)
            function postUrl(targetUrl, postData) {
                return new Promise((resolve, reject) => {
                    const urlObj = new URL(targetUrl);
                    const client = urlObj.protocol === 'https:' ? https : http;
                    const req = client.request(targetUrl, {
                        method: 'POST',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    }, (res) => {
                        let d = '';
                        res.on('data', c => d += c);
                        res.on('end', () => resolve(d));
                    });
                    req.on('error', reject);
                    req.write(postData);
                    req.end();
                });
            }

            // Step 1: Search for the business (try DuckDuckGo first, fallback to Google)
            const searchQuery = encodeURIComponent(businessName);
            let foundUrl = null;

            // --- Try DuckDuckGo HTML (scraper-friendly via POST) ---
            let fallbackUrl = null;
            try {
                const ddgUrl = 'https://html.duckduckgo.com/html/';
                const postData = 'q=' + encodeURIComponent(businessName + ' official website');
                console.log('[SPY] Trying DuckDuckGo HTML (POST)...');
                const ddgHtml = await postUrl(ddgUrl, postData);
                console.log('[SPY] DuckDuckGo response length:', ddgHtml.length);

                // Match links from the result titles or URIs
                const resultBlocks = ddgHtml.split(/class="result__a"|class="result__url"/i);
                const allLinks = [];
                // Skip the first block (everything before the first result)
                for (let i = 1; i < resultBlocks.length; i++) {
                    const block = resultBlocks[i];
                    const hrefMatch = block.match(/href="([^"]+)"/i);
                    if (hrefMatch && hrefMatch[1]) {
                        allLinks.push(hrefMatch[1]);
                    }
                }

                console.log('[SPY] Found', allLinks.length, 'raw links in DDG results');

                for (let resultUrl of allLinks) {
                    // Extract actual URL if wrapped in DuckDuckGo redirect
                    if (resultUrl.includes('uddg=')) {
                        const uddg = resultUrl.match(/uddg=([^&]+)/);
                        if (uddg) resultUrl = decodeURIComponent(uddg[1]);
                    }

                    console.log('[SPY] DDG raw link:', resultUrl);

                    // Store facebook as a fallback if no actual website exists
                    if (resultUrl.includes('facebook.com') && !resultUrl.includes('sharer') && !fallbackUrl) {
                        fallbackUrl = resultUrl;
                    }

                    // Skip DuckDuckGo's own links, directories, etc.
                    if (resultUrl.includes('duckduckgo.com')) continue;
                    if (resultUrl.includes('facebook.com')) continue;
                    if (resultUrl.includes('yelp.com')) continue;
                    if (resultUrl.includes('yellowpages.com')) continue;
                    if (resultUrl.includes('bbb.org')) continue;
                    if (resultUrl.includes('linkedin.com')) continue;
                    if (resultUrl.includes('instagram.com')) continue;
                    if (resultUrl.includes('twitter.com')) continue;
                    if (resultUrl.includes('tiktok.com')) continue;
                    if (resultUrl.includes('google.com')) continue;
                    if (resultUrl.includes('youtube.com')) continue;
                    if (resultUrl.includes('wikipedia.org')) continue;
                    if (resultUrl.includes('mapquest.com')) continue;
                    if (resultUrl.includes('about:blank')) continue;
                    if (!resultUrl.startsWith('http')) continue;

                    console.log('[SPY] Candidate URL:', resultUrl);
                    foundUrl = resultUrl;
                    break;
                }
            } catch (ddgErr) {
                console.log('[SPY] DuckDuckGo failed:', ddgErr.message);
            }

            // --- Fallback: Try Google ---
            if (!foundUrl) {
                try {
                    const googleUrl = 'https://www.google.com/search?q=' + encodeURIComponent(businessName + ' official website') + '&num=10&hl=en';
                    console.log('[SPY] DuckDuckGo found nothing, trying Google...');
                    const googleHtml = await fetchUrl(googleUrl);
                    console.log('[SPY] Google response length:', googleHtml.length);

                    // Search for generic links starting with http in title blocks
                    // Google often wraps results in <a href="/url?q=...
                    // But sometimes it's direct.
                    const googleLinks = googleHtml.match(/\/url\?q=(https?:\/\/[^&"]+)/g) || [];

                    // If that fails, try a more aggressive regex for any absolute links
                    if (googleLinks.length === 0) {
                        const hrefMatches = googleHtml.match(/href="(https?:\/\/[^"]+)"/g) || [];
                        for (const m of hrefMatches) {
                            const url = m.match(/href="([^"]+)"/)[1];
                            if (!url.includes('google.com') && !url.includes('gstatic.com')) {
                                googleLinks.push(url);
                            }
                        }
                    }

                    for (const match of googleLinks) {
                        let resultUrl = match.replace('/url?q=', '');
                        try { resultUrl = decodeURIComponent(resultUrl); } catch { continue; }

                        console.log('[SPY] Google raw link:', resultUrl);

                        // Store facebook as a fallback
                        if (resultUrl.includes('facebook.com') && !resultUrl.includes('sharer') && !fallbackUrl) {
                            fallbackUrl = resultUrl;
                        }

                        if (resultUrl.startsWith('http') &&
                            !resultUrl.includes('google.com') &&
                            !resultUrl.includes('facebook.com') &&
                            !resultUrl.includes('yelp.com') &&
                            !resultUrl.includes('youtube.com') &&
                            !resultUrl.includes('wikipedia.org')) {
                            foundUrl = resultUrl;
                            break;
                        }
                    }
                } catch (gErr) {
                    console.log('[SPY] Google also failed:', gErr.message);
                }
            }

            // --- Apply Fallback if everything failed ---
            if (!foundUrl && fallbackUrl) {
                console.log('[SPY] Official website not found. Using fallback URL:', fallbackUrl);
                foundUrl = fallbackUrl;
            }

            if (!foundUrl) {
                console.log('[SPY] No URL found from any search engine or fallback.');
                return sendJSON(200, { success: false, error: 'Could not find a website or Facebook page for "' + businessName + '". The name might be too vague — try adding a city or state (e.g. "' + businessName + ' Dallas TX").' });
            }

            console.log('[SPY] Found website:', foundUrl);

            // Step 2: Fetch the actual business website
            const pageHtml = await fetchUrl(foundUrl);

            // Step 3: Strip HTML, extract text
            const textContent = pageHtml
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&[a-zA-Z]+;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 8000);

            console.log('[SPY] Extracted text length:', textContent.length);

            // Step 4: Send to Gemini for structured extraction
            const config = loadConfig();
            const geminiKey = config.geminiApiKey;

            if (!geminiKey) return sendJSON(400, { error: 'Gemini API key not set. Go to Settings.' });

            const extractionPrompt = `You are a data extraction expert. Below is scraped text from a business website (${foundUrl}). The user searched for: "${businessName}".

Extract business info and return ONLY valid JSON (no markdown, no backticks). If you cannot find a value, make your best guess based on the niche. Only use "Not found" as a last resort.

Return this exact JSON:
{
  "businessName": "",
  "cityState": "",
  "primaryService": "",
  "secondaryServices": "",
  "yearsInBusiness": "",
  "licensedInsured": "",
  "usp": "",
  "idealCustomer": "",
  "avgProjectSize": "",
  "financing": "",
  "phone": "",
  "serviceAreas": "",
  "existingColors": "",
  "visualDirection": ""
}

For "usp", write a compelling unique selling proposition.
For "idealCustomer", infer the target audience from services.
For "visualDirection", suggest "Dark/Moody" or "Vibrant/Deep" based on the niche.
For "existingColors", extract or infer brand colors.
For "secondaryServices", list up to 5 separated by commas.
For "serviceAreas", list cities/areas separated by commas.

WEBSITE TEXT:
${textContent}

Return ONLY the JSON object.`;

            console.log('[SPY] Using Gemini for extraction...');
            try {
                const geminiPayload = JSON.stringify({
                    contents: [{ parts: [{ text: extractionPrompt }] }]
                });
                const gResult = await new Promise((resolve, reject) => {
                    const gReq = https.request({
                        hostname: 'generativelanguage.googleapis.com',
                        path: `/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`,
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    }, (gRes) => {
                        let b = '';
                        gRes.on('data', c => b += c);
                        gRes.on('end', () => {
                            try { resolve({ status: gRes.statusCode, body: JSON.parse(b) }); }
                            catch (e) { resolve({ status: gRes.statusCode, body: b }); }
                        });
                    });
                    gReq.on('error', reject);
                    gReq.write(geminiPayload);
                    gReq.end();
                });

                if (gResult.status === 200) {
                    let raw = gResult.body.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (!raw) {
                        console.log('[SPY] Gemini returned no text. Safety block?', JSON.stringify(gResult.body));
                        return sendJSON(500, { error: 'Gemini returned an empty response. Likely a safety block.' });
                    }
                    raw = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                    const extracted = JSON.parse(raw);
                    console.log('[SPY] Successfully extracted business info from', foundUrl);
                    return sendJSON(200, { success: true, data: extracted, sourceUrl: foundUrl });
                } else {
                    console.error('[SPY] Gemini extraction failed:', gResult.body);
                    return sendJSON(500, { error: 'Gemini extraction failed. Check API key or quotas.' });
                }
            } catch (err) {
                console.error('[SPY] Gemini extraction crashed:', err.message);
                return sendJSON(500, { error: 'AI extraction error' });
            }
        } catch (err) {
            console.error('[SPY ERROR]', err.message);
            return sendJSON(500, { error: 'Spy failed: ' + err.message });
        }
    }

    // --- ImgBB Upload Proxy ---
    if (req.method === 'POST' && req.url === '/api/upload-image') {
        const data = await getBody();
        const config = loadConfig();
        const apiKey = config.imgbbApiKey;

        if (!apiKey) return sendJSON(400, { error: 'ImgBB API key not set. Go to Settings.' });

        try {
            // data.image should be base64 string
            const formBody = \`key=\${apiKey}&image=\${encodeURIComponent(data.image)}&name=\${encodeURIComponent(data.name || 'website-image')}\`;

            const result = await httpsRequest({
                hostname: 'api.imgbb.com',
                path: '/1/upload',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(formBody),
                }
            }, formBody);

            if (result.status === 200 && result.body.success) {
                return sendJSON(200, {
                    success: true,
                    url: result.body.data.url,
                    display_url: result.body.data.display_url,
                    delete_url: result.body.data.delete_url,
                    thumb: result.body.data.thumb?.url
                });
            } else {
                return sendJSON(400, { error: 'ImgBB upload failed', details: result.body });
            }
        } catch (err) {
            return sendJSON(500, { error: err.message });
        }
    }

    // --- Generate Site Folder ---
    if (req.method === 'POST' && req.url === '/api/generate') {
        const data = await getBody();
        try {
            const folderName = data.businessName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const siteDir = path.join(OUTPUT_DIR, folderName);
            const cssDir = path.join(siteDir, 'css');
            const jsDir = path.join(siteDir, 'js');

            [siteDir, cssDir, jsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

            // 1. Load Master Shell
            const templatePath = path.join(TEMPLATES_DIR, 'master.html');
            let htmlTemplate = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, 'utf8') : getDefaultTemplate();

            // 2. Load Global CSS
            const cssTemplatePath = path.join(TEMPLATES_DIR, 'global.css');
            let allCss = fs.existsSync(cssTemplatePath) ? fs.readFileSync(cssTemplatePath, 'utf8') : getDefaultCss();

            // 3. Loop through selected templates and stitch together
            let bodyContent = '';
            const templates = data.templates || [];

            for (const tId of templates) {
                const parts = tId.split('/');
                if (parts.length === 2) {
                    const tPath = path.join(TEMPLATES_DIR, parts[0], parts[1]);

                    // Add HTML
                    const hFile = path.join(tPath, 'index.html');
                    if (fs.existsSync(hFile)) {
                        bodyContent += fs.readFileSync(hFile, 'utf8') + '\n\n';
                    }

                    // Add CSS
                    const cFile = path.join(tPath, 'style.css');
                    if (fs.existsSync(cFile)) {
                        allCss += fs.readFileSync(cFile, 'utf8') + '\n\n';
                    }
                }
            }

            // Inject body content into master
            if (htmlTemplate.includes('<!-- TEMPLATES_INJECT -->')) {
                htmlTemplate = htmlTemplate.replace('<!-- TEMPLATES_INJECT -->', bodyContent);
            } else {
                // fallback if master doesn't have the comment
                htmlTemplate = htmlTemplate.replace('</body>', bodyContent + '\n</body>');
            }

            // 4. Global Variables Injection
            const ans = data.data || {};
            const replacements = {
                '{{BUSINESS_NAME}}': ans.businessName || data.businessName || '',
                '{{PRIMARY_SERVICE}}': ans.primaryService || data.niche || '',
                '{{NICHE}}': ans.primaryService || data.niche || '',
                '{{CITY}}': ans.cityState || data.city || '',
                '{{CITY_STATE}}': ans.cityState || data.city || '',
                '{{PHONE}}': ans.phone || '',
                '{{YEARS}}': ans.yearsInBusiness || '10',
                '{{USP}}': ans.usp || '',
                '{{ADDRESS}}': ans.cityState || ''
            };

            // Allow injecting secondary services (SERVICE_1, SERVICE_2, etc.)
            if (ans.secondaryServices) {
                const secs = ans.secondaryServices.split(',').map(s => s.trim()).filter(Boolean);
                secs.forEach((srv, i) => {
                    replacements[\`{{SERVICE_\${i + 1}}}\`] = srv;
                });
            }
            // Allow injecting service areas (CITY_1, CITY_2, etc.)
            if (ans.serviceAreas) {
                const areas = ans.serviceAreas.split(',').map(s => s.trim()).filter(Boolean);
                areas.forEach((area, i) => {
                    replacements[\`{{CITY_\${i + 1}}}\`] = area;
                });
            }

            // Do replacement
            for (const [k, v] of Object.entries(replacements)) {
                const regex = new RegExp(k.replace(/[{}]/g, '\\\\$&'), 'g');
                htmlTemplate = htmlTemplate.replace(regex, v);
                allCss = allCss.replace(regex, v);
            }

            // Fallback clear remaining unfilled macros
            htmlTemplate = htmlTemplate.replace(/{{[A-Z0-9_]+}}/g, 'Service');

            // 5. Write final files
            fs.writeFileSync(path.join(siteDir, 'index.html'), htmlTemplate);
            fs.writeFileSync(path.join(cssDir, 'style.css'), allCss);
            fs.writeFileSync(path.join(jsDir, 'main.js'), \`// Main JS for \${data.businessName}\\nconsole.log('Site initialized.');\`);

            return sendJSON(200, { success: true, folder: folderName, previewUrl: \`/output/\${folderName}/index.html\` });
        } catch (err) {
            console.error('[GENERATE ERROR]', err);
            return sendJSON(500, { success: false, message: err.message });
        }
    }

    // ==========================================
    // STATIC FILE SERVING
    // ==========================================
    if (req.method === 'GET') {
        let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
        let extname = path.extname(filePath);

        let fileLocation = path.join(PUBLIC_DIR, filePath);
        if (filePath.startsWith('/output')) {
            fileLocation = path.join(__dirname, filePath);
            extname = path.extname(fileLocation) || '.html';
            if (!path.extname(fileLocation)) fileLocation += '/index.html';
        }

        fs.readFile(fileLocation, (error, content) => {
            if (error) {
                if (error.code == 'ENOENT') { res.writeHead(404); res.end('Not found'); }
                else { res.writeHead(500); res.end('Server error'); }
            } else {
                res.writeHead(200, { 'Content-Type': mimeTypes[extname] || 'application/octet-stream' });
                res.end(content);
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║   HaydeSites OS — Engine Running     ║');
    console.log(\`  ║   http://localhost:\${PORT}              ║\`);
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
});

function getDefaultTemplate() {
    return \`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{{BUSINESS_NAME}}</title><link rel="stylesheet" href="css/style.css"></head><body><h1>{{BUSINESS_NAME}}</h1><p>{{NICHE}} in {{CITY}}</p><a href="tel:{{PHONE}}">Call {{PHONE}}</a><script src="js/main.js"></script></body></html>\`;
}

function getDefaultCss() {
    return \`:root{--primary:{{COLOR_PRIMARY}};--accent:{{COLOR_ACCENT}};--bg:{{COLOR_BG}};--text:{{COLOR_TEXT}};}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);}\`;
}
