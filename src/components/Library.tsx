"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogApp } from "@/lib/catalog";
import type { ApprovalTier } from "@/lib/guide-schema";
import { DifficultyMeter, TierBadge, cx } from "./ui";

export type LibraryEntry = CatalogApp & {
  guide: null | {
    slug: string;
    origin: "curated" | "generated";
    difficulty: number;
    approvalTier: ApprovalTier;
    timeToProduction: string;
  };
};

type Filter = "all" | "guides" | "managed" | "byo";

export function Library({ entries }: { entries: LibraryEntry[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("All");

  const categories = useMemo(() => ["All", ...Array.from(new Set(entries.map((e) => e.category))).sort()], [entries]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.category.toLowerCase().includes(needle))
      .filter((e) => category === "All" || e.category === category)
      .filter((e) =>
        filter === "guides" ? e.guide !== null : filter === "managed" ? e.composioManaged : filter === "byo" ? !e.composioManaged : true,
      )
      .sort((a, b) => {
        const rank = (e: LibraryEntry) => (e.guide?.origin === "curated" ? 0 : e.guide ? 1 : 2);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
  }, [entries, q, filter, category]);

  const counts = {
    curated: entries.filter((e) => e.guide?.origin === "curated").length,
    generated: entries.filter((e) => e.guide?.origin === "generated").length,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter 100 apps…"
          aria-label="Filter apps"
          className="h-9 w-56 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {(
          [
            ["all", "All"],
            ["guides", "Has a guide"],
            ["byo", "No Composio-managed app"],
            ["managed", "Composio-managed available"],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cx(
              "h-9 rounded-md px-3 text-sm",
              filter === id ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          {counts.curated} human-verified guides · {counts.generated} agent-generated · {entries.length - counts.curated - counts.generated}{" "}
          on demand
        </span>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((e) => {
          const href = e.guide ? `/guides/${e.guide.slug}` : `/generate?q=${encodeURIComponent(e.name)}`;
          return (
            <li key={e.slug}>
              <Link
                href={href}
                className="flex h-full flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3 hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">{e.name}</div>
                    <div className="text-xs text-slate-500">
                      {e.category} · {e.composioManaged ? "Composio-managed app available" : "Bring your own OAuth app"}
                    </div>
                  </div>
                  {e.guide?.origin === "curated" ? (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                      ✓ Verified
                    </span>
                  ) : e.guide ? (
                    <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-violet-200">
                      🤖 Agent
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                      Generate →
                    </span>
                  )}
                </div>
                {e.guide && (
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    <DifficultyMeter value={e.guide.difficulty} size="sm" />
                    <TierBadge tier={e.guide.approvalTier} className="text-[11px]" />
                    <span className="text-xs text-slate-500">Any user: {e.guide.timeToProduction}</span>
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          No match in the library.{" "}
          <Link className="text-indigo-700 underline" href={`/generate?q=${encodeURIComponent(q)}`}>
            Generate a guide for “{q}”
          </Link>
        </p>
      )}
    </div>
  );
}
