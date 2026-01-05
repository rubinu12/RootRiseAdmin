"use client";

import React, { useState } from "react";
import { smartBulkSeed } from "@/app/actions/topic-tree-actions";
import { AlertTriangle, CheckCircle2, Terminal, Info, ChevronRight, Hash, Code2, Zap } from "lucide-react";

export function BulkSeeder({
  parentNode,
}: {
  parentNode: { id: string; name: string; level: number; slug: string } | null;
}) {
  const [bulkText, setBulkText] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const [res, setResult] = useState<{
    created: number;
    errors: string[];
  } | null>(null);

  const handleSync = async () => {
    if (!parentNode || !bulkText) return;
    setIsSeeding(true);
    setResult(null);
    
    // Call the Server Action
    const response = await smartBulkSeed(parentNode.id, bulkText);
    
    setIsSeeding(false);
    if (response.success && "created" in response) {
      setResult({ created: response.created, errors: response.errors || [] });
      setBulkText("");
    } else {
      setResult({ created: 0, errors: Array.isArray(response.errors) ? response.errors : [response.errors || "Unknown error"] });
    }
  };

  // 1. Dynamic Placeholder Logic (Updated for Booster Syntax)
  const getPlaceholder = () => {
    if (!parentNode) return "";
    
    // If inside GS Paper (L1) -> Show L2 examples
    if (parentNode.level === 1) {
      return `// You are inside a GS Paper (L1).
// Add Subjects (L2) using '+'

+ Indian Polity
+ Governance \\ Role of State
+ Social Justice
+ International Relations`;
    }
    
    // If inside Subject (L2) -> Show L3/L4 examples with Booster/Scalpel
    return `// You are inside ${parentNode.name} (L${parentNode.level}).
// Use '\\' to BOOST the signal (Add Context)
// Use '|' to CUT the noise (Remove Context)

- Governor \\ Head of State Agent of Centre | President
-- Discretionary Powers \\ Article 163 | Council Aid
-- Pardoning Power \\ Article 161 | Death Sentence Martial Law

- Union Executive
-- President \\ First Citizen | Governor`;
  };

  // 2. Empty State
  if (!parentNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
          <ChevronRight className="w-8 h-8 text-slate-300" />
        </div>
        <p className="font-bold text-sm uppercase tracking-widest mb-1">No Connection</p>
        <p className="text-xs">Select a node from the Spinal Cord to begin seeding.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* --- HEADER: Context Information --- */}
      <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 flex items-start gap-4 shadow-sm">
        <div className="p-3 bg-white rounded-xl shadow-sm border border-indigo-50 text-indigo-600">
          <Hash className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-1">
            Active Injection Point
          </h3>
          <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
            <span>Seeding into:</span>
            <span className="bg-white px-3 py-1 rounded-lg border border-indigo-100 font-bold text-indigo-700 shadow-sm">
              {parentNode.name}
            </span>
            <span className="text-xs text-slate-400 font-mono">(L{parentNode.level})</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed max-w-xl">
            The system will automatically generate <strong>Sharp Vectors</strong> (Child - Parent) 
            and apply <strong>Semantic Boosting</strong> if you use the <code>\</code> syntax.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- LEFT COL: The Terminal Input --- */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative group rounded-2xl shadow-xl overflow-hidden">
            {/* Terminal Bar */}
            <div className="bg-slate-900 h-9 flex items-center px-4 gap-1.5 border-b border-slate-700">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
              <div className="ml-4 flex items-center gap-2 opacity-50">
                <Code2 className="w-3 h-3 text-slate-300" />
                <span className="text-[10px] font-mono text-slate-300">SCALPEL-INPUT-MODE</span>
              </div>
            </div>
            
            {/* Text Editor */}
            <textarea
              className="w-full h-[500px] bg-slate-800 text-slate-200 border-0 p-6 font-mono text-xs leading-loose focus:ring-0 resize-none outline-none"
              placeholder={getPlaceholder()}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              spellCheck={false}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSync}
              disabled={isSeeding || !bulkText}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              {isSeeding ? (
                <>
                  <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>
                  Synthesizing Vectors...
                </>
              ) : (
                <>
                  <Terminal className="w-4 h-4" />
                  Execute Injection
                </>
              )}
            </button>
          </div>
        </div>

        {/* --- RIGHT COL: The Syntax Guide (Cheat Sheet) --- */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-800 border-b border-slate-100 pb-2">
              <Info className="w-4 h-4" />
              <h4 className="font-bold text-xs uppercase tracking-wider">Syntax Guide</h4>
            </div>
            
            <div className="space-y-4">
              {/* Hierarchy Guide */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Hierarchy Levels</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <code className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-purple-600 font-bold">+</code>
                    <span className="text-[10px] text-slate-600">Level 2 (Subject)</span>
                  </div>
                  <div className="flex gap-2">
                    <code className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-blue-600 font-bold">-</code>
                    <span className="text-[10px] text-slate-600">Level 3 (Topic)</span>
                  </div>
                  <div className="flex gap-2">
                    <code className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-600 font-bold">--</code>
                    <span className="text-[10px] text-slate-600">Level 4 (Sub-Topic)</span>
                  </div>
                </div>
              </div>

              {/* NEW: Booster Guide */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center gap-1 mb-1">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <p className="text-[10px] font-bold text-amber-500 uppercase">The Booster ( \ )</p>
                </div>
                <p className="text-[10px] text-amber-800 leading-snug mb-2">
                  Add positive context to the vector without changing the topic name.
                </p>
                <code className="block text-[10px] font-mono text-amber-900 bg-white px-2 py-1 rounded border border-amber-100">
                  Topic \ Keywords Index
                </code>
              </div>

              {/* Scalpel Guide */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-[10px] font-bold text-blue-400 uppercase mb-2">The Scalpel ( | )</p>
                <p className="text-[10px] text-blue-800 leading-relaxed mb-2">
                  Use the pipe symbol to define what a topic is <span className="font-bold">NOT</span>.
                </p>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <code className="block text-[10px] font-mono text-slate-500 mb-1">// Example:</code>
                  <code className="block text-[10px] font-mono text-blue-900 font-bold">
                    Governor | President
                  </code>
                </div>
                <p className="text-[9px] text-blue-600 mt-2 italic">
                  *Subtracts "President" vector from "Governor" to remove ambiguity.
                </p>
              </div>
            </div>
          </div>

          {/* --- RESULTS FEEDBACK --- */}
          {res && (
            <div className={`p-5 rounded-2xl border animate-in zoom-in-95 duration-300 ${
              res.created > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {res.created > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600"/> : <AlertTriangle className="w-4 h-4 text-red-600"/>}
                <span className={`text-xs font-bold uppercase ${res.created > 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                  Operation Complete
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600 mb-2">
                Successfully injected <span className="font-bold text-slate-900">{res.created}</span> nodes.
              </p>
              {res.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-red-200 bg-red-50/50 rounded">
                  {res.errors.map((err, i) => (
                    <p key={i} className="text-[10px] text-red-600 font-mono py-0.5 px-2">
                      • {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}