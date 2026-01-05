import React from "react";
import { IngestionStudio } from "@/components/ingestion/IngestionStudio";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Question Ingestion Studio | Admin Console",
  description: "AI-assisted ingestion and tagging engine for UPSC Prelims questions.",
};

export default function PrelimStudioPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <IngestionStudio />
    </main>
  );
}