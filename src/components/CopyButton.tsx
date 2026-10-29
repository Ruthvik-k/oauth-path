"use client";

import { useEffect, useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string | (() => string);
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
        setDone(true);
      }}
      className={
        className ??
        "rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      }
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

export function ShareBar({
  slug,
  appName,
  markdown,
  origin,
}: {
  slug: string;
  appName: string;
  markdown: string;
  origin: "curated" | "generated";
}) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <CopyButton text={() => window.location.href.split("#")[0]} label="Copy share link" />
      <CopyButton text={markdown} label="Copy as Markdown" />
      <a
        href={`/guides/${slug}/markdown`}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Download .md
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Print / PDF
      </button>
      {origin === "generated" && (
        <a
          href={`/generate?q=${encodeURIComponent(appName)}&force=1`}
          className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100"
        >
          Re-run agent
        </a>
      )}
    </div>
  );
}
