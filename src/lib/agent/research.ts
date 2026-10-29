import type { Emit } from "./events";
import { webResearch, type Citation } from "./llm";
import { RESEARCH_TRACKS, researchSystemPrompt, type ResolvedApp, type TrackId } from "./prompts";
import { fetchWithTimeout, normalizeUrl } from "./web";

export type { Citation };

export type ResearchResult = {
  track: TrackId;
  label: string;
  notes: string;
  citations: Citation[];
};

function short(url: string) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname.length > 40 ? u.pathname.slice(0, 40) + "…" : u.pathname}`;
  } catch {
    return url;
  }
}

/** URLs a model writes into its notes (rather than ones the search tool returned) must actually load. */
async function urlLoads(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, { redirect: "follow" }, 8_000);
    return res.ok || res.status === 403 || res.status === 429;
  } catch {
    return false;
  }
}

async function runTrack(app: ResolvedApp, track: (typeof RESEARCH_TRACKS)[number], emit: Emit): Promise<ResearchResult> {
  const out = await webResearch({
    system: researchSystemPrompt(app),
    prompt: track.prompt(app),
    onAction: (message) => emit({ type: "log", stage: "research", track: track.label, message }),
  });

  const citations = new Map<string, Citation>();
  for (const c of out.citations) {
    const url = normalizeUrl(c.url);
    if (!citations.has(url)) citations.set(url, { url, title: c.title || short(url) });
  }
  const inline = new Set<string>();
  for (const m of out.text.matchAll(/https?:\/\/[^\s)\]>"';]+/g)) {
    const url = normalizeUrl(m[0].replace(/[.,]+$/, ""));
    if (!citations.has(url) && !url.includes("grounding-api-redirect")) inline.add(url);
  }
  const checked = await Promise.all([...inline].map(async (url) => ({ url, ok: await urlLoads(url) })));
  const dead = checked.filter((c) => !c.ok);
  for (const c of checked) if (c.ok) citations.set(c.url, { url: c.url, title: short(c.url) });
  if (dead.length) emit({ type: "log", stage: "research", track: track.label, message: `Dropped ${dead.length} cited URL(s) that don't load` });

  return { track: track.id, label: track.label, notes: out.text, citations: [...citations.values()] };
}

export async function research(app: ResolvedApp, emit: Emit): Promise<ResearchResult[]> {
  const seen = new Set<string>();
  return Promise.all(
    RESEARCH_TRACKS.map(async (track) => {
      emit({ type: "log", stage: "research", track: track.label, message: "Started" });
      const result = await runTrack(app, track, emit);
      for (const c of result.citations) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        emit({ type: "source", url: c.url, title: c.title });
      }
      emit({ type: "log", stage: "research", track: track.label, message: `Finished with ${result.citations.length} sources` });
      return result;
    }),
  );
}
