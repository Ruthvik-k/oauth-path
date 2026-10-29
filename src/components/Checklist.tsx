"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Phase, Source } from "@/lib/guide-schema";
import { ConfidenceBadge, OwnerBadge, SourceChips, cx } from "./ui";

const PHASE_ICON: Record<Phase["id"], string> = { prepare: "1", build: "2", go_live: "3", maintain: "4" };
const CHANGE_EVENT = "oauth-path-progress";

/** Checklist progress lives in localStorage so a developer can come back to where they left off. */
function useProgress(key: string): [Record<string, boolean>, (next: Record<string, boolean>) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (e: StorageEvent) => e.key === key && onChange();
      window.addEventListener("storage", onStorage);
      window.addEventListener(CHANGE_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(CHANGE_EVENT, onChange);
      };
    },
    [key],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key) ?? "{}",
    () => "{}",
  );
  const done = useMemo(() => {
    try {
      return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, [raw]);
  const setDone = useCallback(
    (next: Record<string, boolean>) => {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );
  return [done, setDone];
}

export function Checklist({ slug, phases, sources }: { slug: string; phases: Phase[]; sources: Source[] }) {
  const [done, setDone] = useProgress(`oauth-path:progress:${slug}`);

  const all = useMemo(() => phases.flatMap((p, pi) => p.steps.map((s, si) => ({ id: `${pi}.${si}`, step: s, phase: p }))), [phases]);
  const completed = all.filter((x) => done[x.id]).length;
  const next = all.find((x) => !done[x.id]);

  return (
    <div>
      <div className="no-print sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(completed / Math.max(all.length, 1)) * 100}%` }} />
        </div>
        <span className="text-sm text-slate-600">
          {completed}/{all.length} steps done
        </span>
        {next ? (
          <a href={`#step-${next.id}`} className="text-sm font-medium text-indigo-700 hover:underline">
            Next: {next.step.title} →
          </a>
        ) : (
          <span className="text-sm font-medium text-emerald-700">All steps done 🎉</span>
        )}
        {completed > 0 && (
          <button onClick={() => setDone({})} className="ml-auto text-xs text-slate-500 hover:text-slate-800">
            Reset
          </button>
        )}
      </div>

      <ol className="space-y-6">
        {phases.map((phase, pi) => (
          <li key={pi}>
            <div className="flex items-baseline gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {PHASE_ICON[phase.id] ?? pi + 1}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">
                  {phase.name} <span className="font-normal text-slate-500">· {phase.duration}</span>
                </h3>
                <p className="text-sm text-slate-600">{phase.goal}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-2 border-l-2 border-slate-200 pl-6 ml-3.5">
              {phase.steps.map((s, si) => {
                const id = `${pi}.${si}`;
                const isNext = next?.id === id;
                return (
                  <li
                    key={id}
                    id={`step-${id}`}
                    className={cx(
                      "scroll-mt-24 rounded-lg border bg-white p-3",
                      isNext ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200",
                      done[id] && "opacity-60",
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!!done[id]}
                        onChange={(e) => setDone({ ...done, [id]: e.target.checked })}
                        className="mt-1 h-4 w-4 accent-indigo-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cx("font-medium text-slate-900", done[id] && "line-through")}>{s.title}</span>
                          <OwnerBadge owner={s.owner} />
                          <span className="text-xs text-slate-500">{s.time}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{s.detail}</p>
                        {s.agentHelp && (
                          <p className="mt-2 rounded-md bg-violet-50 px-2 py-1.5 text-sm text-violet-900">
                            <span className="font-medium">🤖 Agent can help:</span> {s.agentHelp}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <ConfidenceBadge value={s.confidence} />
                          <SourceChips ids={s.sourceIds} sources={sources} />
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
