"use client";

import React, { useState } from "react";
import { smartBulkSeed } from "@/app/actions/topic-tree-actions";

export function BulkSeeder({
  parentNode,
}: {
  parentNode: { id: string; name: string } | null;
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
    const res = await smartBulkSeed(parentNode.id, bulkText);
    setIsSeeding(false);
    if (res.success && "created" in res) {
      setResult({ created: res.created, errors: res.errors || [] });
      setBulkText("");
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="p-6 bg-md-primary-container/30 rounded-2xl border border-md-primary/10">
        <h3 className="text-sm font-bold text-md-primary uppercase tracking-widest mb-2">
          Smart Context Loader
        </h3>
        <p className="text-sm font-medium">
          Seeding under:{" "}
          <span className="font-bold italic text-md-on-surface">
            {parentNode?.name || "None"}
          </span>
        </p>
      </div>
      <textarea
        className="w-full h-80 bg-md-surface-variant border border-md-outline/20 rounded-2xl p-6 font-mono text-sm focus:outline-none transition-all resize-none"
        placeholder={`+ Subject | Hint\n- Anchor | Hint\n-- Topic | Hint`}
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
        disabled={!parentNode}
      />
      <button
        onClick={handleSync}
        disabled={isSeeding || !parentNode}
        className="bg-md-primary text-md-on-primary px-10 py-4 rounded-xl font-bold uppercase tracking-widest disabled:opacity-40 transition-all"
      >
        {isSeeding ? "Syncing..." : "Sync Hierarchy"}
      </button>
      {res && (
        <div className="p-6 bg-md-surface-variant rounded-2xl border border-md-outline/20">
          <p className="text-xs font-bold text-md-primary">
            Success: {res.created} synced.
          </p>
          {res.errors.map((err, i) => (
            <p
              key={i}
              className="text-[10px] text-md-error font-bold leading-relaxed"
            >
              ⚠️ {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
