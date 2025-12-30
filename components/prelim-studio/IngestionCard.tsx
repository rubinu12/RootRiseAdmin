"use client";

import React, { useState } from "react";
import { 
  Trash2, Check, X, Network, AlertTriangle, 
  Loader2, ChevronRight, Edit3, Hash, Search, 
  Save, ArrowRight, Info, HelpCircle
} from "lucide-react";
import { createTopicBranch, searchTopicsBySubject } from "@/app/actions/prelim-actions";

interface TopicMatch {
  id: string | null;
  name: string;
  score: number;
  isMatched: boolean;
}

interface IngestionCardProps {
  question: any;
  displayId: number;
  onUpdate?: (id: string, updates: any) => void;
}

export function IngestionCard({ question, displayId, onUpdate }: IngestionCardProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Helper for conditional styling based on match score
  const getStatusColor = (isMatched: boolean, score: number) => {
    if (isMatched) return "bg-green-50 text-green-700 border-green-200";
    if (score > 0.7) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-red-50 text-red-700 border-red-200";
  };

  const handleCreateAndLink = async () => {
    setIsCreating(true);
    try {
      // Trigger the creation of L3 and L4 nodes using hierarchical logic
      const res = await createTopicBranch(question.l2Id, question.suggestedL3, question.suggestedL4);
      if (res.success) {
        onUpdate?.(question.id, { 
          topicId: res.topicId, 
          isBranchGrowthNeeded: false,
          l3Match: { ...question.l3Match, isMatched: true },
          l4Match: { ...question.l4Match, isMatched: true }
        });
      } else {
        alert("Growth failed: " + res.error);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleManualSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchTopicsBySubject(question.subject, val);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className={`max-w-4xl mx-auto bg-white rounded-[32px] border transition-all duration-300 shadow-xl ${question.hasError ? 'border-red-400' : 'border-slate-200'}`}>
      
      {/* 1. CARD HEADER */}
      <div className={`px-8 py-4 border-b flex justify-between items-center rounded-t-[31px] ${question.hasError ? 'bg-red-50' : 'bg-slate-50/50'}`}>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-white border border-slate-200 rounded-xl flex items-center gap-2 shadow-sm">
            <Hash size={12} className="text-indigo-600" />
            <span className="text-xs font-black text-slate-700 uppercase">Q{displayId}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{question.paper} | {question.year}</span>
          </div>
          {question.hasError && (
            <div className="flex items-center gap-2 text-red-600 font-black uppercase text-[10px] animate-pulse">
              <AlertTriangle size={14} />
              {question.errorMessage}
            </div>
          )}
        </div>
        <div className="flex gap-4 text-slate-400">
          <Edit3 size={18} className="hover:text-indigo-600 cursor-pointer transition-colors" />
          <Trash2 size={18} className="hover:text-red-500 cursor-pointer transition-colors" />
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* 2. QUESTION CONTENT */}
        <div className="space-y-4">
          <p className="text-[17px] font-bold text-slate-800 italic leading-relaxed">
            {question.questionText}
          </p>
          
          {/* Statements */}
          <div className="grid grid-cols-1 gap-3">
            {question.statements?.map((s: any, i: number) => (
              <div key={i} className={`flex items-start gap-4 px-5 py-3 rounded-2xl text-sm font-semibold border ${s.correctTruth ? 'bg-green-50/30 border-green-100 text-green-800' : 'bg-red-50/30 border-red-100 text-red-800'}`}>
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${s.correctTruth ? 'bg-green-100' : 'bg-red-100'}`}>
                  {s.correctTruth ? <Check size={12} /> : <X size={12} />}
                </div>
                <span>{s.statementText}</span>
              </div>
            ))}
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {Object.entries(question.options || {}).map(([label, text]: [any, any]) => (
              <div key={label} className={`px-4 py-3 rounded-xl border text-xs font-bold flex gap-3 items-center ${question.correctOption === label ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                <span className="w-6 h-6 rounded bg-white border border-inherit flex items-center justify-center shrink-0">{label}</span>
                <span className="truncate">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. TOPIC RESOLUTION ENGINE (L3 & L4 Independent Check) */}
        <div className="pt-8 border-t border-slate-100 space-y-6">
          <div className="flex items-center gap-3 mb-2">
             <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                <Network size={16} />
             </div>
             <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Spinal Cord Resolution</h4>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* L3 Analysis */}
            <div className={`p-5 rounded-3xl border transition-all ${getStatusColor(question.l3Match?.isMatched, question.l3Match?.score)}`}>
              <div className="flex justify-between items-start mb-3">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Level 3: {question.suggestedL3}</p>
                <div className="px-2 py-0.5 rounded-full bg-white/50 text-[10px] font-bold">
                  {Math.round((question.l3Match?.score || 0) * 100)}% Match
                </div>
              </div>
              <div className="flex items-center gap-2">
                {question.l3Match?.isMatched ? <Check size={14} className="text-green-600" /> : <AlertTriangle size={14} className="text-amber-600" />}
                <p className="text-xs font-black uppercase truncate">{question.l3Match?.name || "No Match Found"}</p>
              </div>
            </div>

            {/* L4 Analysis */}
            <div className={`p-5 rounded-3xl border transition-all ${getStatusColor(question.l4Match?.isMatched, question.l4Match?.score)}`}>
              <div className="flex justify-between items-start mb-3">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Level 4: {question.suggestedL4 || "N/A"}</p>
                <div className="px-2 py-0.5 rounded-full bg-white/50 text-[10px] font-bold">
                  {Math.round((question.l4Match?.score || 0) * 100)}% Match
                </div>
              </div>
              <div className="flex items-center gap-2">
                {question.l4Match?.isMatched ? <Check size={14} className="text-green-600" /> : <HelpCircle size={14} className="text-amber-600" />}
                <p className="text-xs font-black uppercase truncate">{question.l4Match?.name || (question.suggestedL4 ? "Growth Required" : "Not Provided")}</p>
              </div>
            </div>
          </div>

          {/* Manual Selection Search */}
          <div className="relative group">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50 transition-all">
              <Search size={18} className="text-slate-400" />
              <input 
                value={searchQuery}
                onChange={(e) => handleManualSearch(e.target.value)}
                placeholder={`Override: Search for a different node in ${question.subject}...`}
                className="bg-transparent border-none outline-none text-xs font-bold w-full text-slate-700 uppercase placeholder:text-slate-300"
              />
              {isSearching && <Loader2 size={16} className="animate-spin text-indigo-600" />}
            </div>

            {/* Manual Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-3 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 max-h-64 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-2 duration-200">
                <div className="sticky top-0 bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Canonical Node</span>
                  <X size={14} className="text-slate-400 cursor-pointer" onClick={() => setSearchResults([])} />
                </div>
                {searchResults.map((node) => (
                  <button 
                    key={node.id}
                    onClick={() => {
                      onUpdate?.(question.id, { 
                        topicId: node.id, 
                        isBranchGrowthNeeded: false,
                        l3Match: { ...question.l3Match, isMatched: true, name: node.name, score: 1.0 },
                        l4Match: { ...question.l4Match, isMatched: true, name: "MANUAL", score: 1.0 }
                      });
                      setSearchResults([]);
                      setSearchQuery("");
                    }}
                    className="w-full text-left px-6 py-4 hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex justify-between items-center group/item"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-800 group-hover/item:text-indigo-700 transition-colors uppercase">{node.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-tighter mt-1 italic">{node.ancestryPath}</p>
                    </div>
                    <ArrowRight size={14} className="text-slate-300 group-hover/item:text-indigo-500 transition-all transform group-hover/item:translate-x-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. GROWTH RECOMMENDATION ACTION */}
        {question.isBranchGrowthNeeded && (
          <div className="bg-indigo-700 rounded-3xl p-6 flex items-center justify-between shadow-xl shadow-indigo-200 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
                <Network size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-1">Growth Action</span>
                <span className="text-xs font-bold text-white uppercase italic">Create new branch for &quot;{question.suggestedL3}&quot;?</span>
              </div>
            </div>
            <button 
              onClick={handleCreateAndLink}
              disabled={isCreating}
              className="bg-white text-indigo-700 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isCreating ? "Growing Tree..." : "Create & Link"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}