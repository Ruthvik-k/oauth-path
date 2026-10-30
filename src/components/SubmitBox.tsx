"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { findCatalogApp } from "@/lib/catalog";

const EXAMPLES = ["Notion", "QuickBooks", "Shopify", "https://www.xero.com", "Calendly"];

export function SubmitBox({ curatedSlugs }: { curatedSlugs: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(query: string) {
    const q = query.trim();
    if (!q) return;
    const match = findCatalogApp(q);
    if (match?.guideSlug && curatedSlugs.includes(match.guideSlug)) {
      router.push(`/guides/${match.guideSlug}`);
      return;
    }
    router.push(`/generate?q=${encodeURIComponent(q)}`);
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="App name or website, e.g. Pipedrive or pipedrive.com"
          aria-label="App name or website"
          className="h-12 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-base shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="submit"
          className="h-12 rounded-lg bg-indigo-600 px-5 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          disabled={!value.trim()}
        >
          Get the guide
        </button>
      </form>
      <p className="mt-2 text-sm text-slate-500">
        Not in the library? An agent researches it live (about a minute).{" "}
        <span className="whitespace-nowrap">Try:</span>{" "}
        {EXAMPLES.map((ex, i) => (
          <span key={ex}>
            <button type="button" onClick={() => go(ex)} className="text-indigo-700 underline-offset-2 hover:underline">
              {ex}
            </button>
            {i < EXAMPLES.length - 1 ? ", " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}
