"use client";

import React, { useState, useEffect } from "react";
import { Search, Hash, ChevronRight, Loader2 } from "lucide-react";
import { searchTopicsBySubject } from "@/app/actions/prelim-actions";

export function IngestionSearch({ currentSubject, onSelect }: { currentSubject: string, onSelect: (node: any) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setLoading(true);
        const data = await searchTopicsBySubject(currentSubject, query);
        setResults(data);
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [query, currentSubject]);

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-3 bg-md-surface border border-md-primary/20 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-md-primary/20 transition-all">
        {loading ? <Loader2 size={16} className="animate-spin text-md-primary" /> : <Search size={16} className="text-md-primary/40" />}
        <input 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${currentSubject} Anchors...`}
          className="bg-transparent border-none outline-none text-xs font-medium w-full text-md-on-surface"
        />
      </div>

      {query.length > 2 && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-md-surface border border-md-outline/20 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {results.map((node) => (
            <button 
              key={node.id}
              onClick={() => { onSelect(node); setQuery(""); }}
              className="w-full flex items-center gap-3 p-4 hover:bg-md-primary-container/30 border-b border-md-outline/5 last:border-0"
            >
              <Hash size={14} className="text-md-primary" />
              <div className="text-left">
                <p className="text-xs font-bold text-md-on-surface">{node.name}</p>
                <p className="text-[10px] text-md-on-surface-variant uppercase">{node.ancestryPath}</p>
              </div>
              <ChevronRight size={14} className="ml-auto text-md-outline" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}