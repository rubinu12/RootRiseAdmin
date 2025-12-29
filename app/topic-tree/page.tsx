"use client";

import React, { useState } from "react";
import { VsCodeTree } from "@/components/topic-tree/TopicTree";
import { BulkSeeder } from "@/components/topic-tree/BulkSeeder";

export default function TopicTreePage() {
  const [activeTab, setActiveTab] = useState<"explorer" | "seeder">("explorer");
  const [selectedNode, setSelectedNode] = useState<any>(null);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      <div className="p-8 pb-4">
        <h1 className="text-3xl font-bold tracking-tight italic">Hierarchy Manager</h1>
      </div>

      <div className="px-8 border-b border-md-outline/10 flex gap-8">
        <button onClick={() => setActiveTab("explorer")} className={`py-4 px-2 uppercase text-xs font-black ${activeTab === "explorer" ? "border-b-4 border-md-primary text-md-primary" : "text-md-on-surface-variant"}`}>Explorer</button>
        <button onClick={() => setActiveTab("seeder")} className={`py-4 px-2 uppercase text-xs font-black ${activeTab === "seeder" ? "border-b-4 border-md-primary text-md-primary" : "text-md-on-surface-variant"}`}>Bulk Seeder</button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <VsCodeTree onSelect={setSelectedNode} selectedId={selectedNode?.id} />
        <main className="flex-1 overflow-y-auto p-10 bg-md-surface">
          {activeTab === "explorer" && selectedNode && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-4xl font-bold text-md-on-surface italic">{selectedNode.name}</h2>
              <p className="mt-4 text-md-on-surface-variant">L{selectedNode.level} Node: {selectedNode.slug}</p>
            </div>
          )}
          {activeTab === "seeder" && <BulkSeeder parentNode={selectedNode} />}
        </main>
      </div>
    </div>
  );
}