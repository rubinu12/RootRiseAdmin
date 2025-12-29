// IngestionActions.tsx - Component for managing ingestion actions
"use client";

import React from "react";
import { Save, CheckCircle, RotateCcw, Loader2 } from "lucide-react";

interface IngestionActionsProps {
  onCommit: () => void;
  onReset: () => void;
  isCommitting: boolean;
  count: number;
}

export function IngestionActions({ onCommit, onReset, isCommitting, count }: IngestionActionsProps) {
  return (
    <div className="flex gap-4 items-center">
      {/* COUNTER BOX */}
      <div className="text-right border-r border-md-outline/20 pr-6 mr-2">
        <p className="text-[9px] uppercase font-black text-md-on-surface-variant leading-none">Verified</p>
        <p className="text-sm font-black text-md-primary tracking-tighter">{count} Questions</p>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex gap-2">
        <button 
          onClick={onReset}
          title="Reset Batch"
          className="p-2.5 border-2 border-md-primary/20 rounded-xl text-md-primary hover:bg-md-primary hover:text-white hover:border-md-primary transition-all"
        >
          <RotateCcw size={18} />
        </button>
        <button 
          title="Save Draft"
          className="p-2.5 border-2 border-md-primary/20 rounded-xl text-md-primary hover:bg-md-primary hover:text-white hover:border-md-primary transition-all"
        >
          <Save size={18} />
        </button>
      </div>

      <button 
        onClick={onCommit}
        disabled={isCommitting || count === 0}
        className="bg-md-primary text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl shadow-md-primary/20 flex items-center gap-3 hover:scale-105 active:scale-95 disabled:opacity-40 transition-all"
      >
        {isCommitting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <CheckCircle size={14} />
        )}
        Finalize & Commit
      </button>
    </div>
  );
}