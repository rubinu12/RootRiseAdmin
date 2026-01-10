// app/prelim-studio/page.tsx
import { Metadata } from "next";
import StudioClient from '@/components/prelim-studio/StudioClient';


export const metadata: Metadata = {
  title: "Question Ingestion Studio | Admin Console",
  description: "AI-assisted ingestion and tagging engine for UPSC Prelims questions.",
};

export default function Page() {
  return <StudioClient />;
}