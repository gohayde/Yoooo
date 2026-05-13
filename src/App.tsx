/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Header from './components/Header';
import CompanyScraper from './components/CompanyScraper';
import PromptGenerator from './components/PromptGenerator';
import { CompanyData } from './types';

const initialData: CompanyData = {
  industry: '',
  purpose: '',
  targetAudience: '',
  keyFeatures: '',
  colorScheme: '',
  vibe: '',
  additionalNotes: ''
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'scraper' | 'generator'>('scraper');
  const [companyData, setCompanyData] = useState<CompanyData>(initialData);

  const handleDataScraped = (data: CompanyData) => {
    setCompanyData(data);
    setActiveTab('generator');
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 flex flex-col">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-grow max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'scraper' ? (
          <CompanyScraper onDataScraped={handleDataScraped} />
        ) : (
          <PromptGenerator 
            initialData={companyData} 
            onUpdateData={setCompanyData} 
          />
        )}
      </main>
    </div>
  );
}

