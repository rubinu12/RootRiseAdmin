"use client";

import { useState } from 'react';
import { seedLabTopics, runDualSearch, clearLab } from './actions';

export default function LabPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [seedText, setSeedText] = useState("");
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<{standard: any[], sculpted: any[]} | null>(null);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const handleInject = async () => {
    setLoading(true);
    addLog("🔪 Sculpting & Injecting vectors...");
    const list = seedText.split('\n');
    const res = await seedLabTopics(list);
    if(res.success) addLog(`✅ Processed ${res.count} contrastive topics.`);
    else addLog(`❌ Error: ${res.error}`);
    setLoading(false);
  };

  const handleSearch = async () => {
    setLoading(true);
    setResults(null);
    addLog(`🔍 Searching: "${queryText}"`);
    const res = await runDualSearch(queryText);
    if(res.success && res.standard && res.sculpted) {
      setResults({ standard: res.standard, sculpted: res.sculpted });
      addLog("✅ Search Complete.");
    } else {
      addLog(`❌ Error: ${res.error}`);
    }
    setLoading(false);
  };

  const handleClear = async () => {
    await clearLab();
    addLog("⚠️ Database Cleared.");
    setResults(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto font-mono bg-neutral-50 min-h-screen text-neutral-800">
      <div className="border-b pb-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">🧬 Contrastive Vector Engine</h1>
        <p className="text-neutral-500 text-sm">
          Define topics by what they are <span className="font-bold text-red-600">NOT</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT: CONTROLS */}
        <div className="space-y-6">
          
          {/* INPUT */}
          <div className="bg-white p-4 rounded border shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <label className="font-bold">1. Contrastive Definition</label>
              <button onClick={handleClear} className="text-xs text-red-500 hover:underline">Clear DB</button>
            </div>
            <p className="text-xs text-neutral-500 mb-2">Format: <span className="bg-neutral-100 px-1 rounded">Topic Name | Context to Remove</span></p>
            <textarea 
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              className="w-full h-40 p-3 text-sm border rounded font-sans"
              placeholder={`Supreme Court | Legislature Parliament\nLok Sabha | Vidhan Sabha State\nArticle 32 | Parliament`}
            />
            <button 
              onClick={handleInject} 
              disabled={loading}
              className="w-full mt-2 bg-black text-white px-4 py-2 rounded hover:bg-neutral-800 disabled:opacity-50"
            >
              Inject & Sculpt Vectors
            </button>
          </div>

          {/* SEARCH */}
          <div className="bg-white p-4 rounded border shadow-sm">
            <label className="font-bold block mb-2">2. Test Query</label>
            <div className="flex gap-2">
              <input 
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="e.g. Article 32"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button 
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Search
              </button>
            </div>
          </div>

          {/* LOGS */}
          <div className="bg-neutral-900 text-green-400 p-4 rounded h-32 overflow-y-auto text-xs font-mono">
            {logs.length === 0 ? "System Ready." : logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>

        {/* RIGHT: RESULTS */}
        <div>
          <h2 className="font-bold mb-4 text-xl">🔬 Lab Results</h2>
          
          {!results && (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-neutral-300 rounded text-neutral-400">
              Waiting for experiment...
            </div>
          )}

          {results && (
            <div className="grid grid-cols-2 gap-4">
              {/* STANDARD */}
              <div className="bg-white p-4 rounded border border-red-100 shadow-sm opacity-75">
                <div className="text-red-600 font-bold mb-3 text-xs uppercase tracking-wider border-b pb-2">
                  Standard (Blurry)
                </div>
                {results.standard.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm mb-2 pb-2 border-b border-neutral-50 last:border-0">
                    <span className="truncate w-32">{item.name}</span>
                    <span className="font-mono text-xs text-neutral-500">{(item.similarity * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              {/* SCULPTED */}
              <div className="bg-blue-50 p-4 rounded border border-blue-200 shadow-md">
                <div className="text-blue-700 font-bold mb-3 text-xs uppercase tracking-wider border-b border-blue-200 pb-2">
                  Sculpted (Clear)
                </div>
                {results.sculpted.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm mb-2 pb-2 border-b border-blue-100 last:border-0">
                    <span className="font-semibold truncate w-32 text-blue-900">{item.name}</span>
                    <span className="font-mono text-xs bg-white text-blue-700 px-1 rounded shadow-sm">
                      {(item.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}