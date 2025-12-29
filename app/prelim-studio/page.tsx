"use client";

import React, { useState } from "react";
import { ValidationRail } from "@/components/prelim-studio/ValidationRail";
import { IngestionCard } from "@/components/prelim-studio/IngestionCard";
import { IngestionActions } from "@/components/prelim-studio/IngestionActions";
import { previewBatchIngestion, commitBatch } from "@/app/actions/prelim-actions";
import { Layers, Play, Loader2, Database, Info } from "lucide-react";

export default function PrelimIngestionPage() {
  const [rawJson, setRawJson] = useState("");
  const [stagedData, setStagedData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const handlePreview = async () => {
    if (!rawJson.trim()) return;
    setIsProcessing(true);
    try {
      const result = await previewBatchIngestion(rawJson);
      if (result.success) setStagedData(result.data || []);
      else alert(result.error);
    } catch (err) {
      console.error("Preview failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateQuestionState = (id: string, updates: any) => {
    setStagedData((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const handleFinalCommit = async () => {
    if (stagedData.length === 0) return;
    setIsCommitting(true);
    try {
      const result = await commitBatch(stagedData);
      if (result.success) {
        alert("Batch Committed Successfully!");
        setStagedData([]);
        setRawJson("");
      } else {
        alert("Commit failed: " + result.error);
      }
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#f8fafc]">
      {/* 1. M3 STATION HEADER */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-10 z-50 shadow-sm sticky top-0">
        <div className="flex items-center gap-5">
          <div className="w-11 h-11 bg-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
            <Layers size={22} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black text-indigo-900 uppercase tracking-[0.3em] leading-none mb-1">Precision Studio</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase italic">
              {stagedData.length > 0 ? `${stagedData.length} Items Loaded` : "Ready for JSON Batch"}
            </span>
          </div>
        </div>

        <div className="flex gap-5 items-center">
          {stagedData.length > 0 ? (
            <IngestionActions 
              count={stagedData.length} 
              isCommitting={isCommitting} 
              onCommit={handleFinalCommit} 
              onReset={() => confirm("Discard batch?") && setStagedData([])} 
            />
          ) : (
            <button onClick={handlePreview} disabled={isProcessing || !rawJson} className="bg-indigo-700 text-white px-10 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-indigo-800 transition-all active:scale-95 disabled:opacity-50">
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : "Process Batch"}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 2. COMPACT TRACKER */}
        <ValidationRail 
          items={stagedData.map((q, idx) => ({
            id: idx + 1,
            scrollId: q.id,
            title: q.questionText?.substring(0, 35) + "...",
            status: q.hasError ? "error" : q.isBranchGrowthNeeded ? "pending" : "verified"
          }))} 
        />
        
        {/* 3. WORKSTATION CANVAS */}
        <main className="flex-1 overflow-y-auto p-10 space-y-6 no-scrollbar scroll-smooth">
          {stagedData.length === 0 ? (
            <div className="max-w-4xl mx-auto mt-10 animate-in fade-in duration-700">
                <div className="flex items-center gap-4 mb-8 bg-indigo-50/50 p-6 rounded-3xl border-2 border-indigo-100/50 border-dashed">
                    <Info size={24} className="text-indigo-600" />
                    <p className="text-sm font-black text-indigo-900 uppercase tracking-widest">Paste your UPSC Prelims JSON key below to begin ingestion.</p>
                </div>
                <textarea 
                  className="w-full h-[600px] bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-12 font-mono text-[13px] leading-relaxed focus:ring-8 focus:ring-indigo-100 transition-all outline-none shadow-2xl shadow-indigo-100/20"
                  placeholder="[ { 'meta': {...}, 'question': {...}, 'topics': [...] } ]"
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                />
            </div>
          ) : (
            <div className="space-y-6 pb-32">
              {stagedData.map((question, idx) => (
                <IngestionCard key={question.id} displayId={idx + 1} question={question} onUpdate={updateQuestionState} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}