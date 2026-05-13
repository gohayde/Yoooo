import React from 'react';
import { Sparkles, Search, PenTool } from 'lucide-react';

interface HeaderProps {
  activeTab: 'scraper' | 'generator';
  setActiveTab: (tab: 'scraper' | 'generator') => void;
}

export default function Header({ activeTab, setActiveTab }: HeaderProps) {
  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-600">
          <Sparkles className="w-6 h-6" />
          <h1 className="font-semibold text-lg tracking-tight text-neutral-900">WebSpy & Gen</h1>
        </div>
        <nav className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('scraper')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'scraper' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
            }`}
          >
            <Search className="w-4 h-4" />
            Company Spy
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'generator' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
            }`}
          >
            <PenTool className="w-4 h-4" />
            Prompt Generator
          </button>
        </nav>
      </div>
    </header>
  );
}
