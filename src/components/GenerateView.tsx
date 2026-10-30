"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import { STAGES, type AgentEvent, type StageId } from "@/lib/agent/events";
import type { ClaimCheck, ProbeResult } from "@/lib/guide-schema";
import { cx } from "./ui";

type StageState = { status: "pending" | "running" | "done" | "error"; message?: string; progress?: string };
type Log = { stage: StageId; track?: string; message: string; at: number };
type State = {
  stages: Record<StageId, StageState>;
  logs: Log[];
  sources: { url: string; title: string }[];
  probes: ProbeResult[];
  claims: ClaimCheck[];
  done: { slug: string; cached: boolean; name: string } | null;
  error: string | null;
};

const initial: State = {
  stages: Object.fromEntries(STAGES.map((s) => [s.id, { status: "pending" }])) as Record<StageId, StageState>,
  logs: [],
  sources: [],
  probes: [],
  claims: [],
  done: null,
  error: null,
};

function reducer(state: State, e: AgentEvent): State {
  switch (e.type) {
    case "stage":
      return {
        ...state,
        stages: {
          ...state.stages,
          [e.stage]: { ...state.stages[e.stage], status: e.status === "start" ? "running" : e.status, message: e.message },
        },
      };
    case "log":
      return { ...state, logs: [...state.logs, { stage: e.stage, track: e.track, message: e.message, at: Date.now() }] };
    case "progress":
      if (!e.message) return state;
      return { ...state, stages: { ...state.stages, [e.stage]: { ...state.stages[e.stage], progress: e.message } } };
    case "source":
      return { ...state, sources: [...state.sources, { url: e.url, title: e.title }] };
    case "probe":
      return { ...state, probes: [...state.probes, e.probe] };
    case "claim":
      return { ...state, claims: [...state.claims, e.check] };
    case "done":
      return { ...state, done: e };
    case "error": {
      const running = STAGES.find((s) => state.stages[s.id].status === "running");
      return {
        ...state,
        error: e.message,
        stages: running ? { ...state.stages, [running.id]: { ...state.stages[running.id], status: "error" } } : state.stages,
      };
    }
  }
}

function host(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function GenerateView() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q") ?? "";
  const force = params.get("force") === "1";
  const [state, dispatch] = useReducer(reducer, initial);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !query) return;
    ran.current = true;
    setStarted(Date.now());
    (async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query, force }),
        });
        if (!res.ok || !res.body) throw new Error(`Server responded ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as AgentEvent;
            dispatch(event);
            if (event.type === "done" && event.cached) router.replace(`/guides/${event.slug}`);
          }
        }
      } catch (e) {
        dispatch({ type: "error", message: (e as Error).message });
      }
    })();
  }, [query, force, router]);

  const finished = !!state.done || !!state.error;
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finished]);

  if (!query) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-600">
        Enter an app on the <Link href="/" className="text-indigo-700 underline">home page</Link> to generate a guide.
      </div>
    );
  }

  const elapsed = started ? Math.round((now - started) / 1000) : 0;
  const tracks = Array.from(new Set(state.logs.filter((l) => l.track).map((l) => l.track!)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Live agent run</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Researching the OAuth path for <span className="text-indigo-700">{state.done?.name ?? query}</span>
          </h1>
        </div>
        <div className="text-sm tabular-nums text-slate-500">{finished ? `Finished in ${elapsed}s` : `${elapsed}s elapsed · usually about a minute`}</div>
      </div>

      {state.error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <span className="font-medium">The agent stopped:</span> {state.error}{" "}
          <Link href="/" className="underline">
            Try another app
          </Link>
        </div>
      )}
      {state.done && !state.done.cached && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="text-sm text-emerald-900">The guide is published and ready to share.</span>
          <Link href={`/guides/${state.done.slug}`} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Open the guide →
          </Link>
        </div>
      )}
      {state.done?.cached && <div className="mt-4 text-sm text-slate-600">A guide already exists. Opening it…</div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <ol className="space-y-3">
          {STAGES.map((s) => {
            const st = state.stages[s.id];
            const logs = state.logs.filter((l) => l.stage === s.id);
            return (
              <li
                key={s.id}
                className={cx(
                  "rounded-lg border bg-white p-4",
                  st.status === "running" ? "border-indigo-300 ring-2 ring-indigo-100" : st.status === "error" ? "border-rose-300" : "border-slate-200",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cx(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                      st.status === "done" && "bg-emerald-600 text-white",
                      st.status === "running" && "animate-pulse bg-indigo-600 text-white",
                      st.status === "error" && "bg-rose-600 text-white",
                      st.status === "pending" && "bg-slate-200 text-slate-500",
                    )}
                  >
                    {st.status === "done" ? "✓" : st.status === "error" ? "!" : STAGES.indexOf(s) + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">{s.label}</div>
                    <div className="text-xs text-slate-500">{st.message ?? st.progress ?? s.description}</div>
                  </div>
                </div>

                {s.id === "research" && tracks.length > 0 && (
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {tracks.map((t) => {
                      const tl = logs.filter((l) => l.track === t);
                      const finishedTrack = tl.some((l) => l.message.startsWith("Finished"));
                      return (
                        <div key={t} className="rounded-md bg-slate-50 p-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <span className={cx("h-1.5 w-1.5 rounded-full", finishedTrack ? "bg-emerald-500" : "animate-pulse bg-indigo-500")} />
                            Agent: {t}
                          </div>
                          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-[11px] text-slate-600">
                            {tl.slice(-8).map((l, i) => (
                              <li key={i} className="truncate" title={l.message}>
                                {l.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
                {s.id !== "research" && logs.length > 0 && (
                  <ul className="mt-2 space-y-0.5 pl-9 text-xs text-slate-600">
                    {logs.map((l, i) => (
                      <li key={i}>{l.message}</li>
                    ))}
                  </ul>
                )}
                {s.id === "probe" && state.probes.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-9 text-xs">
                    {state.probes.map((p, i) => (
                      <li key={i} className="text-slate-700">
                        {p.ok ? "✅" : "⚠️"} <span className="font-medium">{p.name}:</span> {p.result}
                      </li>
                    ))}
                  </ul>
                )}
                {s.id === "verify" && state.claims.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-9 text-xs">
                    {state.claims.map((c, i) => (
                      <li key={i} className="text-slate-700">
                        <span
                          className={cx(
                            "font-semibold",
                            c.verdict === "supported" && "text-emerald-700",
                            c.verdict === "partially_supported" && "text-amber-700",
                            c.verdict === "not_supported" && "text-rose-700",
                            c.verdict === "unreachable" && "text-slate-500",
                          )}
                        >
                          {c.verdict.replace("_", " ")}
                        </span>{" "}
                        <span className="line-clamp-1">{c.claim}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Sources found ({state.sources.length})</h2>
          <p className="text-xs text-slate-500">Each claim in the guide must cite one of these.</p>
          <ul className="mt-3 max-h-[560px] space-y-1.5 overflow-y-auto text-xs">
            {state.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="block truncate text-indigo-700 hover:underline" title={s.url}>
                  {s.title}
                </a>
                <span className="text-slate-400">{host(s.url)}</span>
              </li>
            ))}
            {state.sources.length === 0 && <li className="text-slate-400">Waiting for the research agents…</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}
