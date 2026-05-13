/* ============================================
   HaydeSite OS — App Logic v2.0
   Premium SaaS Edition
   Quiz + Ollama + ImgBB + Toast Notifications
   ============================================ */

// ===== TOAST SYSTEM =====
const TOAST_ICONS = {
    success: `<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===== MODAL SYSTEM =====
function showModal(title, bodyText, onConfirm) {
    const overlay = document.getElementById('modalOverlay');
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>${title}</h3>
            </div>
            <div class="modal-body">
                ${bodyText}
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost btn-sm" id="modalCancel">Cancel</button>
                <button class="btn btn-danger btn-sm" id="modalConfirm">Delete</button>
            </div>
        </div>
    `;

    overlay.classList.add('active');

    const close = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.innerHTML = '', 300);
    };

    document.getElementById('modalCancel').addEventListener('click', close);
    document.getElementById('modalConfirm').addEventListener('click', () => {
        onConfirm();
        close();
    });
}

// ===== SIDEBAR =====
const sidebar = document.getElementById('sidebar');
document.getElementById('sidebarToggle').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
});
if (localStorage.getItem('sidebarCollapsed') === 'true') {
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
}

// ===== THEME =====
const html = document.documentElement;
const themeLabel = document.getElementById('themeLabel');
function setTheme(t) {
    html.setAttribute('data-theme', t);
    localStorage.setItem('haydeSiteTheme', t);
    if (themeLabel) themeLabel.textContent = t === 'dark' ? 'Light Mode' : 'Dark Mode';
}
document.getElementById('themeToggle').addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
});
const savedTheme = localStorage.getItem('haydeSiteTheme');
if (savedTheme) setTheme(savedTheme);

// ===== NAV WITH PAGE TRANSITIONS =====
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

function navigateTo(p) {
    const currentPage = document.querySelector('.page.active');
    const targetPage = document.getElementById('page-' + p);

    if (currentPage === targetPage) return;

    navItems.forEach(n => n.classList.remove('active'));
    const t = document.querySelector(`.nav-item[data-page="${p}"]`);
    if (t) t.classList.add('active');

    // Animate out current page
    if (currentPage) {
        currentPage.style.animation = 'pageOut 0.2s ease forwards';
        setTimeout(() => {
            currentPage.classList.remove('active');
            currentPage.style.animation = '';
            // Animate in new page
            targetPage.classList.add('active');
            targetPage.style.animation = 'pageIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards';
        }, 180);
    } else {
        targetPage.classList.add('active');
    }
}

navItems.forEach(i => i.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(i.getAttribute('data-page'));
    if (i.getAttribute('data-page') === 'new-build') resetWizard();
}));
document.getElementById('brandLink').addEventListener('click', e => {
    e.preventDefault();
    navigateTo('new-build');
    resetWizard();
});

// Add pageOut keyframes dynamically
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes pageOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-8px); }
    }
`;
document.head.appendChild(styleSheet);


// ============================================
// QUIZ ENGINE
// ============================================
const QUESTIONS = [
    { key: 'businessName', question: 'What is the business name?', hint: 'Exact name as it appears on the website.', skip: false },
    { key: 'cityState', question: 'City and State?', hint: 'Where the business is primarily located.', skip: false },
    { key: 'primaryService', question: 'Primary service?', hint: 'e.g. Custom Decks, Roofing, Epoxy Flooring.', skip: false },
    { key: 'secondaryServices', question: 'Secondary services?', hint: 'Up to 5, separated by commas.', skip: false },
    { key: 'yearsInBusiness', question: 'Years in business?', hint: 'How long they have been operating.', skip: false },
    { key: 'licensedInsured', question: 'Licensed and insured?', hint: 'Yes or No.', skip: false },
    { key: 'usp', question: 'What makes them better than competitors?', hint: 'Their unique selling proposition.', skip: false },
    { key: 'idealCustomer', question: 'Who is their ideal customer?', hint: 'e.g. Homeowners, luxury market, remodelers.', skip: false },
    { key: 'avgProjectSize', question: 'Average project size or price range?', hint: 'Optional. Typical cost of a project.', skip: true },
    { key: 'financing', question: 'Do they offer financing?', hint: 'Yes or No.', skip: false },
    { key: 'phone', question: 'Phone number?', hint: 'Primary contact number.', skip: false },
    { key: 'serviceAreas', question: 'Service areas?', hint: 'Cities they serve, separated by commas.', skip: false },
    { key: 'existingColors', question: 'Do you have an existing logo or specific brand colors?', hint: 'Provide HEX codes, describe the logo, or type "None".', skip: false },
    { key: 'visualDirection', question: 'Visual Direction: Main color?', hint: 'Dark/Moody or Vibrant/Deep? (No white/light-gray)', skip: false },
];

const TOTAL = QUESTIONS.length;
let step = 0, answers = {};

// Template Selection Variables
let phase = 1; // 1 = Info, 2 = Templates
let templateStep = 0;
const REQUIRED_CATEGORIES = ['header', 'hero', 'services', 'reviews', 'faq', 'cta', 'footer'];
let selectedTemplates = {};
let availableTemplates = {};

const quizContainer = document.getElementById('quizContainer');
const quizBody = document.getElementById('quizBody');
const quizQ = document.getElementById('quizQuestion');
const quizH = document.getElementById('quizHint');
const inputEl = document.getElementById('wizardInput');
const skipBtn = document.getElementById('skipBtn');
const stepNum = document.getElementById('quizStepNum');
const stepTotal = document.getElementById('quizStepTotal');
const progressFill = document.getElementById('progressFill');
const outputArea = document.getElementById('outputArea');
const outputCode = document.getElementById('outputCode');

const pad = n => n < 10 ? '0' + n : '' + n;

function showQuestion() {
    const q = QUESTIONS[step];
    quizBody.style.animation = 'none';
    quizBody.offsetHeight;
    quizBody.style.animation = 'quizIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards';
    quizQ.textContent = q.question;
    quizH.textContent = q.hint;
    stepNum.textContent = pad(step + 1);
    stepTotal.textContent = pad(TOTAL);
    progressFill.style.width = (((step) / TOTAL) * 100) + '%';
    skipBtn.style.display = q.skip ? 'inline-flex' : 'none';
    inputEl.style.display = 'block';
    inputEl.value = '';
    inputEl.focus();

    // Remove old template grids if any
    const oldGrid = document.getElementById('quizTemplateGrid');
    if (oldGrid) oldGrid.remove();
}

function submitAnswer(v) {
    if (!v && !QUESTIONS[step].skip) return;
    answers[QUESTIONS[step].key] = v || 'Not specified';
    step++;
    if (step < TOTAL) {
        showQuestion();
    } else {
        // FINISHED THE QUIZ - Generate AI Prompt
        progressFill.style.width = '100%';
        quizContainer.style.display = 'none';
        generateAIPrompt();
    }
}

document.getElementById('wizardSend').addEventListener('click', () => {
    submitAnswer(inputEl.value.trim());
});
skipBtn.addEventListener('click', () => {
    submitAnswer('');
});
inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') submitAnswer(inputEl.value.trim()); });

function resetWizard() {
    step = 0;
    phase = 1;
    templateStep = 0;
    answers = {};
    selectedTemplates = {};
    quizContainer.style.display = 'flex';
    outputArea.style.display = 'none';
    document.getElementById('claudeResponse')?.style.setProperty('display', 'none');
    inputEl.style.display = 'block';

    showQuestion();
}
document.getElementById('resetWizard').addEventListener('click', resetWizard);
document.getElementById('startOver').addEventListener('click', resetWizard);


// ============================================
// GENERATOR ENGINE (Pure AI Prompt)
// ============================================
function generateAIPrompt() {
    outputArea.style.display = 'block';

    const docTitle = document.querySelector('.output-header h2');
    if (docTitle) docTitle.textContent = 'Master System Prompt';

    const aiCode = document.getElementById('outputCode');
    aiCode.textContent = "Generating prompt via AI. This may take a moment...";

    const promptText = `ROLE & MINDSET

You are a Senior Product Designer, Full-Stack Architect, Conversion Copywriter, and Systems Expert combined.

Your task is to build a complete, production-ready website. You have FULL CREATIVE AND TECHNICAL FREEDOM. Use whatever language, framework, stack, or tools you believe will produce the best possible result. There are NO restrictions on technology choices — pick what works best for this project.

You think strategically, not literally.
You add missing best-practice features automatically, even if the user didn't mention them.

BUSINESS DETAILS
• Business Name: ${answers.businessName}
• Niche: ${answers.primaryService} (${answers.secondaryServices})
• Goal: Lead generation, Sales, and high-conversion Bookings
• Target Audience: ${answers.idealCustomer}
• Brand Tone & Style: Auto-derive the most effective brand personality and design style based purely on this industry niche: ${answers.primaryService}. Visual Direction: ${answers.visualDirection}
• Core USP: ${answers.usp}
• Location: ${answers.cityState} (Service Areas: ${answers.serviceAreas})
• Credibility: ${answers.yearsInBusiness} years in business, ${answers.licensedInsured} licensed/insured. Offers financing: ${answers.financing}.
• Contact: Phone ${answers.phone}
• Existing Brand Assets: ${answers.existingColors}

WHAT TO BUILD

1. FRONTEND
Build a professional, conversion-optimized website appropriate for this niche. Include at minimum:
• Hero section with a value-driven headline + CTA
• Trust indicators (badges, stats, testimonials)
• Services & features showcase
• Benefits section highlighting the USP
• Social proof / reviews
• FAQ
• Strong call-to-action block
• Professional footer with navigation, social links, and contact info

You decide the best section order, layout structure, and visual approach. The site must include pages for: Home, About, Services, Contact/Booking, and legal pages.

2. BACKEND & ADMIN
Build an admin dashboard with:
• Content management — create, edit, delete pages, services, testimonials
• Media library for images and assets
• SEO controls per page (title, description, slug)
• Design customization (colors, fonts, layouts, toggle sections)
• Navigation & menu editor
• Form submissions storage
• Pre-populated placeholder content so the site works immediately

The admin must be intuitive for non-technical business users.

3. FORMS & BOOKINGS
• Contact / quote request forms
• Booking system with date & time selection, customer details, and admin confirmation
• Email notifications for both admin and customer

4. DESIGN & UX
• Fully responsive across all devices
• Niche-specific visual DNA matching ${answers.primaryService}
• Smooth animations and micro-interactions
• Mobile-optimized: sticky header, click-to-call, touch-friendly targets, swipeable galleries, single-column stacking
• Fast loading performance

5. SEO & INTEGRATIONS
• On-page SEO best practices built in
• Local Business schema markup
• Social media integration ready
• Analytics-ready structure

FINAL INSTRUCTION
Build this complete website using whatever technology, framework, and approach you determine is the absolute best fit. The result must be fully functional, professional, production-ready, and fully editable by the business owner through the admin dashboard.`;
    aiCode.textContent = "";

    fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
    })
        .then(async response => {
            if (!response.ok) throw new Error('Ollama connection failed');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                aiCode.textContent = fullText;

                // Auto-scroll to bottom of code area
                outputArea.scrollTop = outputArea.scrollHeight;
            }

            saveBuild(answers, fullText);
            showToast('AI system generated successfully!');
        })
        .catch(err => {
            aiCode.textContent = 'Error: ' + err.message + '. Please check your Gemini API key in Settings.';
            showToast('Generation failed', 'error');
        });
}


// ============================================
// COPY / BUILDS / SETTINGS
// ============================================
document.getElementById('copyPrompt').addEventListener('click', () => {
    navigator.clipboard.writeText(outputCode.textContent).then(() => {
        showToast('Prompt copied to clipboard');
    });
});

function getBuilds() { try { return JSON.parse(localStorage.getItem('haydeSiteBuilds') || '[]'); } catch { return []; } }

function saveBuild(ans, prompt) {
    const builds = getBuilds();
    builds.unshift({ id: Date.now(), name: ans.businessName || 'Unnamed Build', niche: ans.primaryService || 'Unknown Service', city: ans.cityState || 'Unknown Location', date: new Date().toLocaleDateString(), prompt, answers: ans });
    localStorage.setItem('haydeSiteBuilds', JSON.stringify(builds));
    renderBuilds();
}

function renderBuilds() {
    const grid = document.getElementById('buildsGrid');
    const builds = getBuilds();
    if (!builds.length) { grid.innerHTML = '<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><h3>No builds yet</h3><p>Generate your first website to see it here.</p></div>'; return; }
    grid.innerHTML = builds.map(b => `<div class="build-card" data-id="${b.id}"><h4>${b.name}</h4><p>${b.niche} &mdash; ${b.city}</p><div class="build-card-meta"><span class="build-tag">${b.date}</span></div></div>`).join('');
    grid.querySelectorAll('.build-card').forEach(c => c.addEventListener('click', () => {
        const build = builds.find(b => b.id === parseInt(c.getAttribute('data-id')));
        if (build) { navigateTo('new-build'); quizContainer.style.display = 'none'; outputCode.textContent = build.prompt; outputArea.style.display = 'block'; }
    }));
}

// Settings — Save Keys
document.getElementById('saveGeminiKey').addEventListener('click', async () => {
    const key = document.getElementById('geminiApiKeyInput').value.trim();
    if (!key) return;
    const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geminiApiKey: key }) });
    if (res.ok) {
        document.getElementById('geminiStatus').textContent = 'Key Saved ✅';
        document.getElementById('geminiStatus').className = 'key-status success';
        showToast('Gemini API key saved');
    } else {
        showToast('Failed to save key', 'error');
    }
});



document.getElementById('exportBuilds').addEventListener('click', () => {
    const builds = getBuilds();
    if (!builds.length) { showToast('No builds to export', 'error'); return; }
    const blob = new Blob([JSON.stringify(builds, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'haydesite-builds.json'; a.click();
    showToast('Builds exported successfully');
});

document.getElementById('clearData').addEventListener('click', () => {
    showModal(
        'Clear All Saved Builds?',
        'Are you sure you want to delete all generated website configurations? This action cannot be undone.',
        () => {
            localStorage.removeItem('haydeSiteBuilds');
            renderBuilds();
            showToast('All builds cleared successfully');
        }
    );
});

// Load config status on Settings page
async function loadConfigStatus() {
    try {
        const res = await fetch('/api/config');
        const cfg = await res.json();
        if (cfg.geminiApiKey) {
            document.getElementById('geminiApiKeyInput').value = cfg.geminiApiKey;
            document.getElementById('geminiStatus').textContent = 'Key Active ✅';
            document.getElementById('geminiStatus').className = 'key-status success';
        }
    } catch { }
}


// ============================================
// TEMPLATES ENGINE (Frontend UI)
// ============================================
async function loadTemplates() {
    try {
        const res = await fetch('/api/templates');
        const data = await res.json();
        availableTemplates = data;
        renderTemplatesPage();
    } catch {
        showToast('Failed to load templates', 'error');
    }
}

function renderTemplatesPage() {
    const container = document.getElementById('templatesCategories');
    if (!container) return;

    container.innerHTML = '';

    // Sort categories logic if needed, here just iterate
    for (const [cat, templates] of Object.entries(availableTemplates)) {
        if (templates.length === 0) continue;

        const catDiv = document.createElement('div');
        catDiv.innerHTML = `
        <div class="template-category-header">
            <h3 class="template-category-title">${cat}</h3>
        </div>
        <div class="templates-grid">
            ${templates.map(t => `
                    <div class="template-card">
                        <div class="template-card-preview">
                            ${t.preview ? `<img src="${t.preview}" alt="${t.name}">` : `<span>No Image</span>`}
                        </div>
                        <div class="template-card-info">
                            <span class="template-card-title">${t.name}</span>
                            <span style="font-size:0.75rem; color:var(--text-3); font-family:monospace;">${t.id}</span>
                        </div>
                    </div>
                `).join('')}
        </div>
    `;
        container.appendChild(catDiv);
    }

    if (container.innerHTML === '') {
        container.innerHTML = `<div class="empty-state"><h3>No Templates Installed</h3><p>Upload templates in the templates directory.</p></div>`;
    }
}

// ===== TEMPLATES FILTERING =====
const categoryPills = document.querySelectorAll('.category-pill');
const templateCards = document.querySelectorAll('.template-card');

categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
        // Remove active from all
        categoryPills.forEach(p => p.classList.remove('active'));
        // Add active to clicked
        pill.classList.add('active');

        const category = pill.getAttribute('data-category');

        templateCards.forEach(card => {
            if (category === 'all' || card.getAttribute('data-category') === category) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// ============================================
// INFO SPY ENGINE
// ============================================
const SPY_FIELDS = [
    { key: 'businessName', label: 'Business Name' },
    { key: 'cityState', label: 'City & State' },
    { key: 'primaryService', label: 'Primary Service' },
    { key: 'secondaryServices', label: 'Secondary Services' },
    { key: 'yearsInBusiness', label: 'Years in Business' },
    { key: 'licensedInsured', label: 'Licensed & Insured' },
    { key: 'usp', label: 'Unique Selling Proposition' },
    { key: 'idealCustomer', label: 'Ideal Customer' },
    { key: 'avgProjectSize', label: 'Avg Project Size' },
    { key: 'financing', label: 'Financing' },
    { key: 'phone', label: 'Phone' },
    { key: 'serviceAreas', label: 'Service Areas' },
    { key: 'existingColors', label: 'Brand Colors' },
    { key: 'visualDirection', label: 'Visual Direction' },
];

let spyData = {};

document.getElementById('spyBtn').addEventListener('click', () => spyBusiness());
document.getElementById('spyUrlInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') spyBusiness();
});

document.getElementById('spyGenerate').addEventListener('click', () => {
    // Read the editable fields back into answers
    SPY_FIELDS.forEach(f => {
        const el = document.getElementById('spy-field-' + f.key);
        if (el) answers[f.key] = el.value || 'Not specified';
    });
    // Navigate to New Build page and skip the quiz
    navigateTo('new-build');
    quizContainer.style.display = 'none';
    generateAIPrompt();
    showToast('Spy data loaded — generating prompt!');
});

document.getElementById('spyReset').addEventListener('click', () => {
    spyData = {};
    document.getElementById('spyResults').style.display = 'none';
    document.getElementById('spyStatus').style.display = 'none';
    document.getElementById('spyUrlInput').value = '';
    document.getElementById('spyUrlInput').focus();
});

async function spyBusiness() {
    const query = document.getElementById('spyUrlInput').value.trim();
    if (!query) { showToast('Enter a business name', 'error'); return; }

    const statusEl = document.getElementById('spyStatus');
    const statusText = document.getElementById('spyStatusText');
    const resultsEl = document.getElementById('spyResults');
    const fieldsEl = document.getElementById('spyFields');
    const spyBtn = document.getElementById('spyBtn');

    // Show loading
    statusEl.style.display = 'flex';
    resultsEl.style.display = 'none';
    statusText.textContent = 'Searching Google for the business...';
    spyBtn.classList.add('loading');
    spyBtn.disabled = true;

    try {
        statusText.textContent = 'Found website. Extracting details with AI...';
        const res = await fetch('/api/spy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const rawText = await res.text();
        let result;
        try {
            result = JSON.parse(rawText);
        } catch {
            throw new Error('Server returned invalid response. Please check your Gemini API key.');
        }

        if (result.success && result.data) {
            spyData = result.data;
            statusEl.style.display = 'none';

            // Render editable fields
            fieldsEl.innerHTML = SPY_FIELDS.map(f => `
                <div class="spy-field">
                    <label class="spy-field-label" for="spy-field-${f.key}">${f.label}</label>
                    <input type="text" id="spy-field-${f.key}" class="spy-field-input" value="${(spyData[f.key] || 'Not found').replace(/"/g, '&quot;')}">
                </div>
            `).join('');

            resultsEl.style.display = 'block';
            showToast('Business info extracted from ' + (result.sourceUrl || 'website') + '!');
        } else {
            statusText.textContent = (result.error || 'Failed to extract info.');
            if (result.raw) {
                statusText.textContent += ' AI returned unstructured data.';
            }
            showToast(result.error || 'Extraction failed', 'error');
        }
    } catch (err) {
        statusText.textContent = 'Connection error: ' + err.message;
        showToast('Failed to connect to server', 'error');
    } finally {
        spyBtn.classList.remove('loading');
        spyBtn.disabled = false;
    }
}

// Init
loadTemplates();
showQuestion();
renderBuilds();
loadConfigStatus();
