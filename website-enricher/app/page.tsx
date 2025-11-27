'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { CompanyRow, SearchConfig } from '@/types';

export default function Home() {
  const [companies, setCompanies] = useState<string[]>([]);
  const [results, setResults] = useState<CompanyRow[]>([]);
  const [config, setConfig] = useState<SearchConfig>({
    extraKeywords: '',
    countryHint: '',
    searchTemplate: '{{company}} {{extra}} {{country}}',
  });
  const [textInput, setTextInput] = useState('');
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        const companyNames = data
          .map((row) => row.company_name)
          .filter((name) => name && name.trim() !== '');
        setCompanies(companyNames);
        setTextInput(companyNames.join('\n'));
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
      },
    });
  };

  const handleTextInput = (text: string) => {
    setTextInput(text);
    const names = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
    setCompanies(names);
  };

  const startEnrichment = async () => {
    if (companies.length === 0) {
      alert('Please upload a CSV or paste company names');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: companies.length });
    const newResults: CompanyRow[] = [];

    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, Math.min(i + batchSize, companies.length));

      const batchPromises = batch.map(async (company) => {
        try {
          const response = await fetch('/api/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company,
              config,
            }),
          });

          if (!response.ok) {
            throw new Error('Enrichment failed');
          }

          return await response.json();
        } catch (error) {
          console.error(`Error enriching ${company}:`, error);
          return {
            company_name: company,
            website: '',
            status: 'needs_review',
            search_query: '',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      newResults.push(...batchResults);
      setResults([...newResults]);
      setProgress({ current: newResults.length, total: companies.length });
    }

    setIsProcessing(false);
  };

  const retrySearch = async (index: number) => {
    const company = results[index].company_name;

    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          config,
        }),
      });

      if (!response.ok) {
        throw new Error('Enrichment failed');
      }

      const result = await response.json();
      const newResults = [...results];
      newResults[index] = result;
      setResults(newResults);
    } catch (error) {
      console.error(`Error retrying ${company}:`, error);
      alert(`Failed to retry search for ${company}`);
    }
  };

  const updateWebsite = (index: number, newWebsite: string) => {
    const newResults = [...results];
    newResults[index].website = newWebsite;
    setResults(newResults);
  };

  const downloadCSV = () => {
    const csv = Papa.unparse(filteredResults);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'enriched_companies.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredResults = showNeedsReviewOnly
    ? results.filter((r) => r.status === 'needs_review')
    : results;

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Company Website Enricher</h1>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Input</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload CSV (must have company_name column)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or paste company names (one per line)
            </label>
            <textarea
              value={textInput}
              onChange={(e) => handleTextInput(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Acme Corp&#10;Tech Solutions Inc&#10;Global Industries"
            />
          </div>

          {companies.length > 0 && (
            <p className="text-sm text-gray-600">
              {companies.length} companies loaded
            </p>
          )}
        </div>

        {/* Search Configuration Panel */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Search Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Extra Keywords
              </label>
              <input
                type="text"
                value={config.extraKeywords}
                onChange={(e) => setConfig({ ...config, extraKeywords: e.target.value })}
                placeholder="e.g. accounting, bookkeeping"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country Hint
              </label>
              <input
                type="text"
                value={config.countryHint}
                onChange={(e) => setConfig({ ...config, countryHint: e.target.value })}
                placeholder="e.g. Australia"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Template
              </label>
              <input
                type="text"
                value={config.searchTemplate}
                onChange={(e) => setConfig({ ...config, searchTemplate: e.target.value })}
                placeholder="{{company}} {{extra}} {{country}}"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
          </div>

          <button
            onClick={startEnrichment}
            disabled={isProcessing || companies.length === 0}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {isProcessing ? 'Processing...' : 'Start Enrichment'}
          </button>

          {isProcessing && (
            <p className="mt-2 text-sm text-gray-600">
              {progress.current} / {progress.total} processed
            </p>
          )}
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Results</h2>

              <div className="flex gap-4 items-center">
                <label className="flex items-center text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={showNeedsReviewOnly}
                    onChange={(e) => setShowNeedsReviewOnly(e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  Show only needs review
                </label>

                <button
                  onClick={downloadCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-sm"
                >
                  Download CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Website
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Search Query
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredResults.map((row, index) => {
                    const actualIndex = showNeedsReviewOnly
                      ? results.findIndex(r => r === row)
                      : index;

                    return (
                      <tr key={actualIndex}>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {row.company_name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <input
                            type="text"
                            value={row.website}
                            onChange={(e) => updateWebsite(actualIndex, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              row.status === 'auto'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {row.search_query}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => retrySearch(actualIndex)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Retry Search
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-gray-600">
              Showing {filteredResults.length} of {results.length} results
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
