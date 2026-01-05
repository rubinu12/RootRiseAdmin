"use client";

import React, { useState } from "react";
import { recursiveVectorSearch } from "@/app/actions/recursive-search";
import { Search, GitMerge, ArrowDown, Target } from "lucide-react";

export default function RecursiveTestPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runTest = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await recursiveVectorSearch(query);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-8">
        
        <div className="text-center">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center justify-center gap-2">
            <GitMerge className="w-8 h-8 text-indigo-600 rotate-90" />
            Trickle Down Search
          </h1>
          <p className="text-slate-500 mt-2">Hierarchical Vector Routing (L1 → L2 → L3)</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input 
            type="text" 
            className="w-full text-lg p-5 pl-14 rounded-2xl border-0 shadow-xl shadow-indigo-100 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
            placeholder="Try: 'Can governor pardon death sentence?'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runTest()}
          />
          <Search className="w-6 h-6 text-slate-400 absolute left-5 top-5" />
          <button 
            onClick={runTest}
            disabled={loading}
            className="absolute right-3 top-3 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {loading ? "Routing..." : "Trace Path"}
          </button>
        </div>

        {/* Results Timeline */}
        {result && result.success && (
          <div className="space-y-0 relative">
            {/* The Vertical Line */}
            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200"></div>

            {result.trace.map((step: any, i: number) => (
              <div key={i} className="relative flex items-start gap-4 animate-in slide-in-from-left-4 fade-in duration-500" style={{ animationDelay: `${i * 150}ms` }}>
                
                {/* Step Circle */}
                <div className="z-10 w-12 h-12 rounded-full bg-white border-4 border-indigo-100 flex items-center justify-center shadow-sm">
                  <span className="text-[10px] font-black text-indigo-600">{i + 1}</span>
                </div>

                {/* Card */}
                <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{step.step}</span>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {(step.score * 100).toFixed(1)}% Match
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{step.winner}</h3>
                </div>
              </div>
            ))}

            {/* Final Target */}
            <div className="relative flex items-start gap-4 animate-in zoom-in duration-500 delay-500">
               <div className="z-10 w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-md">
                   <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Destination Reached</h3>
                   <div className="text-2xl font-black text-emerald-900 leading-none">
                     {result.finalNode.name}
                   </div>
                   {result.candidates && (
                     <div className="mt-4 pt-4 border-t border-emerald-100">
                       <p className="text-[10px] font-bold text-emerald-800 mb-2 uppercase">Contenders:</p>
                       <div className="space-y-1">
                         {result.candidates.map((c: any) => (
                           <div key={c.id} className="flex justify-between text-xs">
                             <span className="text-emerald-700">{c.name}</span>
                             <span className="font-mono opacity-50">{(c.similarity * 100).toFixed(1)}%</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                </div>
            </div>

          </div>
        )}

        {result && !result.success && (
             <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-center text-sm font-medium">
                {result.error}
             </div>
        )}

      </div>
    </div>
  );
}