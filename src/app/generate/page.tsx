import type { Metadata } from "next";
import { Suspense } from "react";
import { GenerateView } from "@/components/GenerateView";

export const metadata: Metadata = { title: "Generating guide" };

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-slate-500">Starting the agent…</div>}>
      <GenerateView />
    </Suspense>
  );
}
