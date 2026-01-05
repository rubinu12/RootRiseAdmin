"use client";

import React, { useState } from "react";
import { testVectorSearch } from "@/app/actions/lab-actions";
import { Search, Beaker, Shield, Microscope, Crown } from "lucide-react";

export default function VectorLabPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runTest = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const res = await testVectorSearch(query);
    setResults(res);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
          <Beaker className="w-8 h-8 text-indigo-600" />
          Vector Laboratory
        </h1>
        <p className="text-slate-500 font-medium mt-1">
          Testing the <span className="text-indigo-600 font-bold">Hybrid Search Algorithm</span> (Raw 70% + Pure 30%)
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-3xl mx-auto mb-12 relative">
        <input 
          type="text" 
          className="w-full text-lg p-6 pl-16 rounded-2xl border-0 shadow-xl shadow-indigo-100 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
          placeholder="Test Query (e.g., 'Pardon Death Sentence')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runTest()}
        />
        <Search className="w-6 h-6 text-slate-400 absolute left-6 top-7" />
        <button 
          onClick={runTest}
          disabled={loading}
          className="absolute right-4 top-4 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Run Experiment"}
        </button>
      </div>

      {/* Results Grid */}
      {results && results.success && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column 1: RAW */}
          <ResultColumn 
            icon={<Shield className="w-5 h-5" />}
            title="Raw Vector"
            subtitle="Baseline (Standard AI)"
            color="slate"
            data={results.raw}
          />

          {/* Column 2: PURE */}
          <ResultColumn 
            icon={<Microscope className="w-5 h-5" />}
            title="Pure Vector"
            subtitle="Extreme Disambiguation"
            color="blue"
            data={results.pure}
          />

          {/* Column 3: HYBRID (Winner) */}
          <ResultColumn 
            icon={<Crown className="w-5 h-5" />}
            title="Hybrid Score"
            subtitle="Weighted (0.7 Raw + 0.3 Pure)"
            color="emerald"
            data={results.hybrid}
            isWinner={true}
          />

        </div>
      )}
    </div>
  );
}

function ResultColumn({ icon, title, subtitle, color, data, isWinner }: any) {
  const colors = {
    slate: "bg-white border-slate-200 text-slate-600",
    blue: "bg-blue-50/50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-500 shadow-xl shadow-emerald-100 text-emerald-800"
  };

  const barColors = {
    slate: "bg-slate-200",
    blue: "bg-blue-400",
    emerald: "bg-emerald-500"
  };

  return (
    <div className={`p-6 rounded-3xl border-2 ${colors[color as keyof typeof colors]} relative overflow-hidden transition-all duration-500`}>
      {isWinner && (
        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-widest">
          Production Ready
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className={`p-2 rounded-lg bg-white shadow-sm ring-1 ring-black/5`}>{icon}</div>
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
          <p className="text-[10px] opacity-70 font-medium">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-3 relative z-10">
        {data.length === 0 ? (
          <p className="text-xs italic opacity-50 text-center py-4">No Data Available</p>
        ) : (
          data.map((item: any, i: number) => (
            <div key={i} className="bg-white/90 p-3 rounded-xl shadow-sm border border-black/5 hover:scale-[1.02] transition-transform">
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-xs text-slate-800 line-clamp-1">{item.name}</span>
                <span className="font-mono text-[10px] font-bold opacity-60">
                  {(item.similarity * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mb-2 truncate">
                {item.path}
              </p>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${barColors[color as keyof typeof barColors]}`} 
                  style={{ width: `${item.similarity * 100}%` }}
                ></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}