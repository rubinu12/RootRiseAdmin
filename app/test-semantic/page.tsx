"use client";

import React, { useState } from "react";
import { runIsolatedSemanticTrace } from "./action";
import { Search, Activity, Target, ChevronDown, ChevronUp } from "lucide-react";

export default function SemanticSandbox() {
  const [form, setForm] = useState({ subject: "Polity", anchor: "", detailed: "" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showComp, setShowComp] = useState<number | null>(null);

  const testSearch = async () => {
    setLoading(true);
    const res = await runIsolatedSemanticTrace(form.subject, form.anchor, form.detailed);
    setData(res);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-700 rounded-3xl flex items-center justify-center text-white shadow-xl">
            <Target size={28} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Competition Debugger</h1>
        </header>

        <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-2xl space-y-8">
          <div className="grid grid-cols-3 gap-8">
            <input className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold uppercase text-xs outline-none" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Subject" />
            <input className="w-full px-6 py-4 border-2 border-indigo-100 rounded-2xl font-bold uppercase text-xs outline-none" value={form.anchor} onChange={e => setForm({...form, anchor: e.target.value})} placeholder="L3 Anchor" />
            <input className="w-full px-6 py-4 border-2 border-indigo-100 rounded-2xl font-bold uppercase text-xs outline-none" value={form.detailed} onChange={e => setForm({...form, detailed: e.target.value})} placeholder="L4 Detailed" />
          </div>
          <button onClick={testSearch} disabled={loading} className="w-full bg-indigo-600 text-white font-black py-5 rounded-[24px] uppercase tracking-widest text-[11px] shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-3 transition-all">
            {loading ? <Activity className="animate-spin" /> : "Analyze Competition"}
          </button>
        </div>

        {data && data.success && (
          <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-6">
            <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl space-y-6">
              <h3 className="text-[11px] font-black text-slate-400 uppercase border-b pb-5 tracking-widest">Semantic Resolution & Competitors</h3>
              <div className="space-y-4">
                {data.trace.map((t: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="flex items-center gap-5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">L{t.level}</div>
                            <div>
                                <p className="text-[13px] font-black text-slate-800 uppercase">{t.name}</p>
                                <p className="text-[9px] font-bold uppercase text-slate-400">{t.status}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <span className="text-sm font-black text-indigo-600">{Math.round(t.score * 100)}% Match</span>
                            {t.competitors && t.competitors.length > 0 && (
                                <button onClick={() => setShowComp(showComp === i ? null : i)} className="p-2 hover:bg-white rounded-lg transition-colors">
                                    {showComp === i ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* COMPETITION LIST */}
                    {showComp === i && t.competitors && (
                        <div className="mx-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2 animate-in slide-in-from-top-2 duration-300">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3 px-2">Other Candidates Considered</p>
                            {t.competitors.map((c: any, ci: number) => (
                                <div key={ci} className="flex justify-between items-center px-4 py-2 bg-white/60 rounded-xl border border-white">
                                    <span className="text-[11px] font-bold text-slate-600 uppercase">{c.name}</span>
                                    <span className="text-[10px] font-black text-indigo-400">{Math.round(c.score * 100)}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}