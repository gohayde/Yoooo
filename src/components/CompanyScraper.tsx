import React, { useState } from 'react';
import { Search, Loader2, Building2, Globe, ArrowRight } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { CompanyData } from '../types';

interface Props {
  onDataScraped: (data: CompanyData) => void;
}

export default function CompanyScraper({ onDataScraped }: Props) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the company or website: "${query}". Provide a detailed profile that would be useful for a web developer to build a competitor or similar website. If it's a well-known company, use your knowledge. If it's a generic term, invent a plausible profile.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              industry: { type: Type.STRING, description: "The industry or niche (e.g., SaaS, E-commerce, Local Bakery)" },
              purpose: { type: Type.STRING, description: "Primary purpose of their website (e.g., Sell products, Collect leads)" },
              targetAudience: { type: Type.STRING, description: "Who they are targeting" },
              keyFeatures: { type: Type.STRING, description: "Key features and sections their website likely has or needs" },
              colorScheme: { type: Type.STRING, description: "Their likely or recommended color scheme" },
              vibe: { type: Type.STRING, description: "Overall vibe or aesthetic (e.g., Modern & Minimalist, Bold & Brutalist)" },
              additionalNotes: { type: Type.STRING, description: "Any other notable details about their online presence or strategy" }
            },
            required: ["industry", "purpose", "targetAudience", "keyFeatures", "colorScheme", "vibe", "additionalNotes"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text) as CompanyData;
        onDataScraped(data);
      } else {
        throw new Error("No data returned from AI.");
      }
    } catch (err) {
      console.error(err);
      setError('Failed to analyze company. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 mb-6 shadow-inner">
          <Search className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900 mb-4">Spy on any company</h2>
        <p className="text-lg text-neutral-600">
          Enter a company name or website URL. Our AI will analyze their online presence and extract their website blueprint.
        </p>
      </div>

      <form onSubmit={handleAnalyze} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Globe className="h-5 w-5 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., stripe.com or Airbnb"
          className="block w-full pl-12 pr-32 py-4 bg-white border-2 border-neutral-200 rounded-2xl text-lg shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
          disabled={isLoading}
        />
        <div className="absolute inset-y-2 right-2 flex items-center">
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2 rounded-xl font-medium transition-colors h-full"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Analyze
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        <div className="p-6 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <Building2 className="w-6 h-6 text-indigo-500 mx-auto mb-3" />
          <h3 className="font-medium text-neutral-900 mb-1">Identify Niche</h3>
          <p className="text-sm text-neutral-500">Extract their exact industry and target audience.</p>
        </div>
        <div className="p-6 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <Search className="w-6 h-6 text-indigo-500 mx-auto mb-3" />
          <h3 className="font-medium text-neutral-900 mb-1">Feature Extraction</h3>
          <p className="text-sm text-neutral-500">Discover the key sections that drive their conversions.</p>
        </div>
        <div className="p-6 rounded-2xl bg-white border border-neutral-100 shadow-sm">
          <Globe className="w-6 h-6 text-indigo-500 mx-auto mb-3" />
          <h3 className="font-medium text-neutral-900 mb-1">Design Vibe</h3>
          <p className="text-sm text-neutral-500">Analyze their color scheme and overall aesthetic.</p>
        </div>
      </div>
    </div>
  );
}
