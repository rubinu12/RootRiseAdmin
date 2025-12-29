"use client";

import React, { useState } from "react";
import { 
  Trash2, Check, X, Network, AlertTriangle, 
  Sparkles, Loader2, ChevronRight, Info, Edit3, 
  Hash, Search, Save
} from "lucide-react";
import { createTopicBranch, searchTopicsBySubject } from "@/app/actions/prelim-actions";

export function IngestionCard({ question, displayId, onUpdate }: { question: any, displayId: number, onUpdate?: any }) {
  const [isCreating, setIsCreating] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const getChipColor = (score: number) => {
    if (score >= 0.95) return "bg-green-50 text-green-700 border-green-200 shadow-md";
    if (score >= 0.70) return "bg-amber-50 text-amber-700 border-amber-200 shadow-md";
    return "bg-red-50 text-red-700 border-red-200 shadow-md";
  };

  const handleDeleteTopic = () => {
    onUpdate?.(question.id, { topicId: null, linkedPath: `${question.subject.toUpperCase()} > ???`, aiMatchScore: 0, isBranchGrowthNeeded: true });
  };

  const handleManualSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 3) return setSearchResults([]);
    setIsSearching(true);
    const results = await searchTopicsBySubject(question.subject, val);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleLink = async () => {
    if (isLinked || isCreating) return;
    setIsCreating(true);
    try {
      const res = await createTopicBranch(question.l2Id, question.suggestedL3, question.suggestedL4);
      if (res.success) {
        setIsLinked(true);
        const newPath = `${question.suggestedL3.toUpperCase()} ${question.suggestedL4 ? ` > ${question.suggestedL4.toUpperCase()}` : ''}`;
        onUpdate?.(question.id, { topicId: res.topicId, isBranchGrowthNeeded: false, aiMatchScore: 1.0, linkedPath: newPath });
      }
    } finally { setIsCreating(false); }
  };

  return (
    <section id={`q${question.id}`} className={`max-w-4xl mx-auto bg-white rounded-[32px] border transition-all duration-300 ${question.hasError ? 'border-red-400 ring-4 ring-red-50 shadow-2xl' : 'border-slate-200 shadow-lg'}`}>
      <div className={`px-8 py-3 flex justify-between items-center border-b rounded-t-[31px] ${question.hasError ? 'bg-red-50' : 'bg-slate-50/50'}`}>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-white border border-slate-200 rounded-xl flex items-center gap-2 shadow-sm">
            <Hash size={12} className="text-indigo-600" />
            <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">Q{displayId < 10 ? `0${displayId}` : displayId}</span>
          </div>
          {question.hasError && <div className="flex items-center gap-2 text-red-600 animate-pulse"><AlertTriangle size={14} /><span className="text-xs font-black uppercase tracking-tight">{question.errorMessage}</span></div>}
        </div>
        <div className="flex gap-2 text-slate-400">
           <Edit3 size={18} className="hover:text-indigo-600 cursor-pointer transition-colors" />
           <Trash2 size={18} className="hover:text-red-500 cursor-pointer transition-colors" />
        </div>
      </div>

      <div className="p-8 space-y-6">
        <p className="text-[17px] font-bold text-slate-800 italic leading-relaxed tracking-tight">{question.questionText}</p>
        
        <div className="grid grid-cols-1 gap-2.5">
          {question.statements?.map((s: any, i: number) => (
            <div key={i} className={`flex items-center gap-4 px-5 py-3 rounded-2xl text-sm font-semibold border transition-all ${s.correctTruth ? 'bg-green-50/50 border-green-200 text-green-800' : 'bg-red-50/50 border-red-100 text-red-800'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${s.correctTruth ? 'bg-green-100' : 'bg-red-100'}`}>{s.correctTruth ? <Check size={16} /> : <X size={16} />}</div>
              <span className="flex-1">{s.statementText}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-5 py-3.5 px-6 bg-indigo-50/40 rounded-[24px] border border-indigo-100 group transition-all hover:bg-indigo-50">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-lg shadow-indigo-200">{question.correctOption || '?'}</div>
          <div className="flex-1 overflow-hidden"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-1.5">Official Solution</p><p className="text-[13px] font-bold text-indigo-900 leading-none">{question.correctAnswerText || "Awaiting JSON mapping..."}</p></div>
        </div>

        {/* 5. RICH TOPIC ATTACHMENT */}
        <div className="pt-6 border-t border-slate-100 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {question.topicId && (
              <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full text-xs font-black uppercase border tracking-widest transition-all hover:scale-[1.02] ${getChipColor(question.aiMatchScore)}`}>
                <Network size={16} className="shrink-0" />
                <span className="leading-none">{question.linkedPath}</span>
                <span className="bg-white/50 px-2 rounded py-0.5 text-[10px]">{question.aiMatchScore}</span>
                <button onClick={handleDeleteTopic} className="ml-1 p-1 hover:bg-black/10 rounded-full transition-colors"><X size={14} /></button>
              </div>
            )}
          </div>

          <div className="relative group/search">
            <div className="flex items-center gap-3 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus-within:border-indigo-200 focus-within:ring-4 focus-within:ring-indigo-50 shadow-inner transition-all">
              <Search size={18} className="text-slate-400" />
              <input value={searchQuery} onChange={(e) => handleManualSearch(e.target.value)} placeholder="Search for existing Level 3 or Level 4 topics..." className="bg-transparent border-none outline-none text-[13px] w-full font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium uppercase" />
              {isSearching && <Loader2 size={16} className="animate-spin text-indigo-600" />}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-3 bg-white border-2 border-slate-100 rounded-3xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto animate-in slide-in-from-bottom-2">
                {searchResults.map((node) => (
                  <button key={node.id} onClick={() => { onUpdate?.(question.id, { topicId: node.id, linkedPath: node.ancestryPath, aiMatchScore: 1.0, isBranchGrowthNeeded: false }); setSearchResults([]); setSearchQuery(""); }} className="w-full text-left px-6 py-4 hover:bg-indigo-50 border-b last:border-0 flex justify-between items-center transition-colors group/item">
                    <div>
                        <p className="text-[13px] font-black text-slate-800 group-hover/item:text-indigo-700 leading-none mb-1">{node.name.toUpperCase()}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">{node.ancestryPath}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover/item:text-indigo-500 transition-transform group-hover/item:translate-x-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 6. GROWTH SUGGESTION BANNER */}
        {(question.isBranchGrowthNeeded || !question.topicId) && !isLinked && !question.hasError && (
          <div className="mt-6 p-6 rounded-[28px] bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 flex items-center justify-between shadow-xl shadow-amber-200/20 animate-in zoom-in-95">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner"><Network size={24} /></div>
              <div>
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-[0.2em] leading-none mb-2">Spinal Cord Growth Needed</p>
                <div className="flex items-center gap-2 text-sm font-black text-amber-900 italic">
                  <span>{question.subject.toUpperCase()}</span>
                  <ChevronRight size={14} className="opacity-30" />
                  <span className="bg-white/60 px-3 py-1 rounded-xl border border-amber-200/50 not-italic text-xs tracking-tighter">{question.suggestedL3.toUpperCase()}</span>
                  {question.suggestedL4 && (
                      <><ChevronRight size={14} className="opacity-30" /><span className="text-amber-700/70">{question.suggestedL4.toUpperCase()}</span></>
                  )}
                </div>
              </div>
            </div>
            <button onClick={handleLink} disabled={isCreating} className="bg-amber-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest shadow-2xl shadow-amber-300 hover:bg-amber-700 active:scale-95 transition-all">
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span className="ml-2">{isCreating ? "Growing..." : "Create & Link"}</span>
            </button>
          </div>
        )}
        {isLinked && <div className="mt-6 p-4 rounded-2xl bg-green-50 border border-green-200 text-green-700 flex items-center justify-center gap-3 text-xs font-black uppercase shadow-lg shadow-green-100 animate-in zoom-in-95"><Check size={18} /> Topic Synced Successfully</div>}
      </div>
    </section>
  );
}