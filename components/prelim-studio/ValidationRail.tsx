"use client";

import React from "react";
import { CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface RailItem {
  id: number;
  scrollId: string;
  title: string;
  status: "verified" | "error" | "pending";
}

export function ValidationRail({ items }: { items: RailItem[] }) {
  return (
    <aside className="w-72 bg-white border-r border-slate-200 h-full overflow-y-auto no-scrollbar scroll-smooth shrink-0">
      <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
        <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.2em]">Validation Rail</h3>
        <span className="text-[10px] font-bold text-slate-400 opacity-50">{items.length} Total</span>
      </div>
      <div className="p-2 space-y-1">
        {items.map((item) => (
          <a 
            key={item.scrollId} 
            href={`#q${item.scrollId}`} 
            className={`flex items-center gap-3 p-3.5 rounded-xl transition-all border group ${
              item.status === 'error' ? 'bg-red-50 border-red-100' : 
              item.status === 'pending' ? 'bg-amber-50 border-amber-200' : 
              'hover:bg-indigo-50 border-transparent'
            }`}
          >
            <span className={`w-7 h-7 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 ${
              item.status === 'verified' ? 'bg-green-100 text-green-700' : 
              item.status === 'error' ? 'bg-red-500 text-white' : 
              'bg-indigo-100 text-indigo-700'
            }`}>
              {item.id}
            </span>
            <span className={`text-[11px] font-bold truncate leading-none ${
              item.status === 'error' ? 'text-red-700' : 'text-slate-600 group-hover:text-indigo-700'
            }`}>
              {item.title}
            </span>
            <div className="ml-auto shrink-0">
              {item.status === 'verified' && <CheckCircle2 size={14} className="text-green-500" />}
              {item.status === 'error' && <AlertCircle size={14} className="text-red-500 animate-pulse" />}
              {item.status === 'pending' && <RefreshCw size={14} className="text-amber-500 animate-spin-slow" />}
            </div>
          </a>
        ))}
      </div>
    </aside>
  );
}