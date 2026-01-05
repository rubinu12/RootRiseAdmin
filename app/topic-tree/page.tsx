"use client";

import React, { useState } from "react";
import { TopicTree } from "@/components/topic-tree/TopicTree";
import { BulkSeeder } from "@/components/topic-tree/BulkSeeder";
import { Network, Database } from "lucide-react";

export default function TopicTreePage() {
  const [activeTab, setActiveTab] = useState<"explorer" | "seeder">("seeder");
  const [selectedNode, setSelectedNode] = useState<any>(null);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 font-sans">
      
      {/* Header */}
      <header className="px-8 py-6 bg-white border-b border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight italic flex items-center gap-3">
            <Network className="w-6 h-6 text-indigo-600" />
            Spinal Cord Manager
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Master Hierarchy & Vector Definition Studio
          </p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab("explorer")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "explorer" ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Explorer
          </button>
          <button 
            onClick={() => setActiveTab("seeder")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "seeder" ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Bulk Injection
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: The Spinal Cord Tree */}
        <TopicTree onSelect={setSelectedNode} selectedId={selectedNode?.id} />

        {/* Right: The Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
          
          {/* Default State */}
          {!selectedNode && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
              <Database className="w-16 h-16 mb-4 text-slate-300" />
              <p className="font-black text-lg uppercase tracking-widest text-slate-300">No Node Selected</p>
            </div>
          )}

          {/* Seeder Mode */}
          {activeTab === "seeder" && selectedNode && (
            <BulkSeeder parentNode={selectedNode} />
          )}

          {/* Explorer Mode (Placeholder for future detail view) */}
          {activeTab === "explorer" && selectedNode && (
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 px-2 py-1 rounded">
                Active Node
              </span>
              <h2 className="text-3xl font-bold text-slate-900 mt-4 mb-2">{selectedNode.name}</h2>
              <div className="font-mono text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                ID: {selectedNode.id}
                <br />
                SLUG: {selectedNode.slug}
                <br />
                LEVEL: {selectedNode.level}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}