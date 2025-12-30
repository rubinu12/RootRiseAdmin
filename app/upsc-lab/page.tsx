"use client";

import { useState } from 'react';
import { seedLabTopics, calibrateLabDNA, runDualSearch, clearLab } from './actions';

export default function LabPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [seedText, setSeedText] = useState("");
  
  // LENS A: Still Manual (You define what to kill)
  const [noiseA, setNoiseA] = useState("Constitution Government India Law Authority Public Office");
  
  // LENS B: No state needed, it is auto-calculated on server
  
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<{standard: any[], pureA: any[], pureB: any[]} | null>(null);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const handleSeed = async () => {
    setLoading(true);
    addLog("Injecting topics...");
    const res = await seedLabTopics(seedText.split('\n'));
    if(res.success) addLog(`✅ Added ${res.count} topics.`);
    else addLog(`❌ Error: ${res.error}`);
    setLoading(false);
  };

  const handleCalibrate = async () => {
    setLoading(true);
    addLog("🧪 Calculating PC1 Mode & Stripping...");
    // Update: We only pass noiseA. NoiseB is now math.
    const res = await calibrateLabDNA(noiseA); 
    if(res.success) addLog(`✅ ${res.message}`);
    else addLog(`❌ Error: ${res.error}`);
    setLoading(false);
  };

  const handleSearch = async () => {
    setLoading(true);
    setResults(null);
    addLog(`🔍 Searching: "${queryText}"`);
    const res = await runDualSearch(queryText);
    if(res.success && res.standard) {
      setResults({ standard: res.standard, pureA: res.pureA, pureB: res.pureB });
      addLog("✅ Complete.");
    } else {
      addLog(`❌ Error: ${res.error}`);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-mono bg-neutral-50 min-h-screen text-neutral-800 text-sm">
      <div className="mb-6 border-b pb-4">
         <h1 className="text-2xl font-bold">🧬 Multi-Lens Laboratory</h1>
         <p className="text-xs text-neutral-500 mt-1">
            Comparing Standard Vector Search vs. Orthogonal Rejection (Manual & Auto-Mode)
         </p>
         <div className="flex gap-4 mt-4">
            <button onClick={handleSeed} disabled={loading} className="bg-black text-white px-3 py-1 rounded hover:bg-neutral-800">1. Inject Data</button>
            <button onClick={handleCalibrate} disabled={loading} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">2. Calibrate</button>
            <button onClick={() => clearLab()} className="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200">Clear</button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: CONTROLS */}
        <div className="lg:col-span-3 space-y-4">
           <div>
             <label className="font-bold block mb-1">Data Intake</label>
             <textarea value={seedText} onChange={e => setSeedText(e.target.value)} className="w-full h-24 p-2 border rounded font-sans" placeholder="Paste 40 topics..." />
           </div>
           
           {/* LENS A CONTROL */}
           <div className="p-3 bg-blue-50 border border-blue-100 rounded">
             <label className="font-bold block mb-1 text-blue-700 text-xs">LENS A: MANUAL FILTER</label>
             <p className="text-[10px] text-blue-600 mb-2">Removes specific words you define below.</p>
             <textarea value={noiseA} onChange={e => setNoiseA(e.target.value)} className="w-full h-16 p-2 border border-blue-200 bg-white rounded text-xs" />
           </div>
           
           {/* LENS B INFO (No Input) */}
           <div className="p-3 bg-purple-50 border border-purple-100 rounded">
             <label className="font-bold block mb-1 text-purple-700 text-xs">LENS B: AUTO-MODE (PC1)</label>
             <div className="text-xs text-purple-800 italic">
               The engine will mathematically find the "Dominant Direction" (Mode) of your 40 topics and strip it.
               <br/><br/>
               <span className="font-bold">Status:</span> {loading ? "Computing..." : "Ready to Auto-Calculate"}
             </div>
           </div>

           <div>
             <label className="font-bold block mb-1">Test Query</label>
             <input type="text" value={queryText} onChange={e => setQueryText(e.target.value)} className="w-full p-2 border rounded" placeholder="Search..." />
             <button onClick={handleSearch} disabled={loading} className="w-full bg-green-600 text-white mt-2 py-2 rounded hover:bg-green-700">Run Experiment</button>
           </div>
           
           <div className="h-32 overflow-auto bg-neutral-900 text-green-400 p-2 rounded text-xs">
             {logs.map((l, i) => <div key={i}>{l}</div>)}
           </div>
        </div>

        {/* RIGHT: RESULTS (3 COLUMNS) */}
        <div className="lg:col-span-9">
          {!results && <div className="h-full flex items-center justify-center text-neutral-400 border-2 border-dashed">No results yet.</div>}
          
          {results && (
            <div className="grid grid-cols-3 gap-4">
              
              {/* COL 1: STANDARD */}
              <div className="bg-white p-3 rounded border shadow-sm">
                <div className="font-bold text-red-600 border-b pb-2 mb-2 text-xs">STANDARD (Blurry)</div>
                {results.standard.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between py-1 border-b text-xs">
                    <span className="truncate w-32" title={item.name}>{item.name}</span>
                    <span className="font-bold text-neutral-600">{(item.similarity * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              {/* COL 2: LENS A */}
              <div className="bg-blue-50 p-3 rounded border border-blue-100 shadow-sm">
                <div className="font-bold text-blue-600 border-b pb-2 mb-2 text-xs">LENS A (No "Polity")</div>
                {results.pureA.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between py-1 border-b text-xs border-blue-100">
                    <span className="truncate w-32 font-semibold" title={item.name}>{item.name}</span>
                    <span className="font-bold text-blue-700">{(item.similarity * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              {/* COL 3: LENS B */}
              <div className="bg-purple-50 p-3 rounded border border-purple-100 shadow-sm">
                <div className="font-bold text-purple-600 border-b pb-2 mb-2 text-xs">LENS B (No "Mode")</div>
                {results.pureB.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between py-1 border-b text-xs border-purple-100">
                    <span className="truncate w-32 font-semibold" title={item.name}>{item.name}</span>
                    <span className="font-bold text-purple-700">{(item.similarity * 100).toFixed(1)}%</span>
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