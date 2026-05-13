import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Copy, Sparkles, Layout, Palette, Users, Settings, CheckCircle2, RefreshCw, PenTool } from 'lucide-react';
import { CompanyData } from '../types';

interface Props {
  initialData: CompanyData;
  onUpdateData: (data: CompanyData) => void;
}

export default function PromptGenerator({ initialData, onUpdateData }: Props) {
  const [formData, setFormData] = useState<CompanyData>(initialData);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Update local state if initialData changes (e.g., from scraper)
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    onUpdateData(newData);
  };

  const generatePrompt = () => {
    const prompt = `Act as an expert web developer and UI/UX designer. I need you to build a complete, single-page React application using Tailwind CSS.

Here are the specific requirements for the website:

1.  **Industry/Niche:** ${formData.industry || 'Not specified'}
2.  **Primary Purpose:** ${formData.purpose || 'Not specified'}
3.  **Target Audience:** ${formData.targetAudience || 'Not specified'}
4.  **Key Features & Sections Needed:** ${formData.keyFeatures || 'Standard landing page sections (Hero, About, Features, Contact)'}
5.  **Color Scheme:** ${formData.colorScheme || 'Modern and clean'}
6.  **Overall Vibe/Aesthetic:** ${formData.vibe || 'Professional and trustworthy'}
7.  **Additional Notes:** ${formData.additionalNotes || 'None'}

**Technical Requirements:**
*   Use React functional components and hooks.
*   Use Tailwind CSS for all styling. Ensure the design is fully responsive (mobile-first approach).
*   Include modern UI patterns (e.g., glassmorphism, subtle shadows, rounded corners where appropriate).
*   Use Lucide React for icons.
*   Ensure good accessibility (contrast, aria labels where necessary).
*   Provide the complete, runnable code in a single file if possible, or clearly separate the components.

Please generate the code for this website.`;

    setGeneratedPrompt(prompt);
    setIsCopied(false);
  };

  const copyToClipboard = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Form Section */}
      <div className="lg:col-span-5 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Define your website</h2>
          <p className="text-neutral-500 text-sm">Review the scraped details or fill them in manually to generate your prompt.</p>
        </div>

        <div className="space-y-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          {/* Industry */}
          <div className="space-y-1.5">
            <label htmlFor="industry" className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              <Layout className="w-4 h-4 text-neutral-400" />
              Industry / Niche
            </label>
            <input
              type="text"
              id="industry"
              name="industry"
              placeholder="e.g., SaaS, Local Bakery, Portfolio"
              value={formData.industry}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          {/* Purpose */}
          <div className="space-y-1.5">
            <label htmlFor="purpose" className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              <Settings className="w-4 h-4 text-neutral-400" />
              Primary Purpose
            </label>
            <input
              type="text"
              id="purpose"
              name="purpose"
              placeholder="e.g., Sell products, Collect leads"
              value={formData.purpose}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          {/* Target Audience */}
          <div className="space-y-1.5">
            <label htmlFor="targetAudience" className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              <Users className="w-4 h-4 text-neutral-400" />
              Target Audience
            </label>
            <input
              type="text"
              id="targetAudience"
              name="targetAudience"
              placeholder="e.g., Tech-savvy millennials"
              value={formData.targetAudience}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          {/* Key Features */}
          <div className="space-y-1.5">
            <label htmlFor="keyFeatures" className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              <Layout className="w-4 h-4 text-neutral-400" />
              Key Features & Sections
            </label>
            <textarea
              id="keyFeatures"
              name="keyFeatures"
              rows={3}
              placeholder="e.g., Hero section with email capture, Pricing table"
              value={formData.keyFeatures}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm resize-none"
            />
          </div>

          {/* Design & Vibe */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="colorScheme" className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <Palette className="w-4 h-4 text-neutral-400" />
                Color Scheme
              </label>
              <input
                type="text"
                id="colorScheme"
                name="colorScheme"
                placeholder="e.g., Dark mode with neon green"
                value={formData.colorScheme}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="vibe" className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <Sparkles className="w-4 h-4 text-neutral-400" />
                Vibe / Aesthetic
              </label>
              <input
                type="text"
                id="vibe"
                name="vibe"
                placeholder="e.g., Modern & Minimalist"
                value={formData.vibe}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label htmlFor="additionalNotes" className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              Additional Notes
            </label>
            <textarea
              id="additionalNotes"
              name="additionalNotes"
              rows={2}
              placeholder="Any specific libraries, animations, or constraints?"
              value={formData.additionalNotes}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm resize-none"
            />
          </div>

          <button
            onClick={generatePrompt}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-2"
          >
            <RefreshCw className="w-4 h-4" />
            Generate Prompt
          </button>
        </div>
      </div>

      {/* Result Section */}
      <div className="lg:col-span-7">
        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col min-h-[600px]">
          <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
            <h3 className="font-medium text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Generated Prompt
            </h3>
            <button
              onClick={copyToClipboard}
              disabled={!generatedPrompt}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                !generatedPrompt 
                  ? 'text-neutral-400 cursor-not-allowed' 
                  : isCopied 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900 shadow-sm'
              }`}
            >
              {isCopied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </>
              )}
            </button>
          </div>
          
          <div className="p-6 flex-grow bg-neutral-50/30 relative overflow-y-auto">
            {!generatedPrompt ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400">
                <PenTool className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">Review details and click generate</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-sm max-w-none"
              >
                <pre className="whitespace-pre-wrap font-mono text-sm text-neutral-700 bg-transparent border-none p-0 m-0 leading-relaxed">
                  {generatedPrompt}
                </pre>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
