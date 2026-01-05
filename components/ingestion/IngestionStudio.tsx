"use client";

import React, { useState } from "react";
import {
  analyzeQuestionJson,
  createTopicFromJson,
  saveFinalQuestion,
  manualSearchTopic,
} from "@/app/actions/ingest-actions";
import {
  ArrowRight,
  Save,
  Database,
  Sparkles,
  Search,
  Plus,
  Check,
} from "lucide-react";

export function IngestionStudio() {
  const [jsonInput, setJsonInput] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Manual Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      const parsed = JSON.parse(jsonInput);
      const res = await analyzeQuestionJson(parsed);
      if (res.success && res.data) {
        setAnalysis(res.data);
        // Auto-select Exact Match if available, else AI suggestion
        if (res.data.exactTopicMatch)
          setSelectedTopic(res.data.exactTopicMatch);
        else if (res.data.aiSuggestion) setSelectedTopic(res.data.aiSuggestion);
      }
    } catch (e) {
      alert("Invalid JSON Format");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!analysis) return;
    const tData = analysis.parsedData.topics[0];
    setLoading(true);
    const res = await createTopicFromJson(
      tData.subject,
      tData.anchor,
      tData.detailed
    );
    setLoading(false);
    if (res.success) {
      setSelectedTopic(res.topic);
      setAnalysis({
        ...analysis,
        exactTopicMatch: res.topic,
        isNewTopic: false,
      }); // Update UI
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleManualSearch = async () => {
    const res = await manualSearchTopic(searchQuery);
    setSearchResults(res);
  };

  const handleSave = async () => {
    if (!selectedTopic || !analysis) return;
    setLoading(true);
    const res = await saveFinalQuestion({
      json: analysis.parsedData,
      topicId: selectedTopic.id,
    });
    setLoading(false);
    if (res.success) {
      alert(`Question Saved! ID: ${res.questionId}`);
      setJsonInput("");
      setAnalysis(null);
      setSelectedTopic(null);
    } else {
      alert("Save Failed: " + res.error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-screen p-6 bg-slate-50 overflow-hidden">
      {/* LEFT: JSON INPUT */}
      <div className="flex flex-col gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <h2 className="font-bold text-slate-700 font-mono text-sm">
            JSON Payload
          </h2>
          <button
            onClick={handleAnalyze}
            disabled={loading || !jsonInput}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          >
            {loading ? (
              "Processing..."
            ) : (
              <>
                Process JSON <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
        <textarea
          className="flex-1 w-full p-6 rounded-xl border border-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Paste JSON here..."
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />
      </div>

      {/* RIGHT: DECISION STUDIO */}
      {analysis ? (
        <div className="flex flex-col gap-4 overflow-y-auto pr-2">
          {/* 1. TOPIC LINKING ZONE */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              Topic Linkage
            </h3>

            {/* A. JSON PATH */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">
                  Requested Topic (JSON)
                </p>
                <p className="text-sm font-bold text-slate-800">
                  {analysis.parsedData.topics[0]?.detailed || "None specified"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {analysis.parsedData.topics[0]?.subject} /{" "}
                  {analysis.parsedData.topics[0]?.anchor}
                </p>
              </div>

              {analysis.exactTopicMatch ? (
                <button
                  onClick={() => setSelectedTopic(analysis.exactTopicMatch)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold border ${
                    selectedTopic?.id === analysis.exactTopicMatch.id
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-emerald-600 border-emerald-200"
                  }`}
                >
                  {selectedTopic?.id === analysis.exactTopicMatch.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    "Select Exact"
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCreateTopic}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100"
                >
                  <Plus className="w-3 h-3" /> Create Node
                </button>
              )}
            </div>

            {/* B. AI SUGGESTION */}
            {analysis.aiSuggestion && (
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-amber-600 font-bold uppercase">
                      AI Recommendation
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {analysis.aiSuggestion.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTopic(analysis.aiSuggestion)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold border ${
                    selectedTopic?.id === analysis.aiSuggestion.id
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-amber-600 border-amber-200"
                  }`}
                >
                  Use AI Match
                </button>
              </div>
            )}

            {/* C. MANUAL SEARCH */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                Manual Override
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Search tree..."
                  className="flex-1 text-xs p-2 border border-slate-200 rounded-md"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  onClick={handleManualSearch}
                  className="p-2 bg-slate-100 rounded-md"
                >
                  <Search className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTopic(t)}
                      className={`text-xs p-2 rounded cursor-pointer flex justify-between ${
                        selectedTopic?.id === t.id
                          ? "bg-slate-800 text-white"
                          : "hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <span>{t.name}</span>
                      <span className="opacity-50 text-[10px]">
                        {t.ancestryPath}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. SUMMARY & SAVE */}
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase mb-1">
                  Target Node
                </p>
                <h2 className="text-xl font-bold">
                  {selectedTopic ? selectedTopic.name : "No Topic Selected"}
                </h2>
                <p className="text-slate-500 text-xs font-mono">
                  {selectedTopic?.slug}
                </p>
              </div>
              {selectedTopic && (
                <div className="p-2 bg-emerald-500 rounded-full">
                  <Check className="w-5 h-5" />
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={!selectedTopic || loading}
              className="w-full py-4 bg-white text-slate-900 rounded-lg font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-slate-100 transition-colors"
            >
              {loading ? "Saving..." : "Confirm & Ingest"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
          <Database className="w-12 h-12 mb-2 opacity-20" />
          <p className="text-sm font-medium">Waiting for JSON Payload...</p>
        </div>
      )}
    </div>
  );
}
