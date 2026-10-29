import type { Emit } from "./events";
import { MODEL, openai, reasoning } from "./openai";
import { RESEARCH_TRACKS, researchSystemPrompt, type ResolvedApp, type TrackId } from "./prompts";
import { normalizeUrl } from "./web";

export type Citation = { url: string; title: string };

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

async function runTrack(app: ResolvedApp, track: (typeof RESEARCH_TRACKS)[number], emit: Emit): Promise<ResearchResult> {
  const stream = openai().responses.stream({
    model: MODEL,
    ...reasoning(MODEL, "low"),
    tools: [{ type: "web_search", search_context_size: "medium" }],
    include: ["web_search_call.action.sources"],
    input: [
      { role: "system", content: researchSystemPrompt(app) },
      { role: "user", content: track.prompt(app) },
    ],
  });

  const citations = new Map<string, Citation>();
  for await (const event of stream) {
    if (event.type !== "response.output_item.done" || event.item.type !== "web_search_call") continue;
    const action = event.item.action;
    if (action.type === "search") {
      const queries = action.queries?.length ? action.queries : action.query ? [action.query] : [];
      if (queries.length) emit({ type: "log", stage: "research", track: track.label, message: `Searched “${queries.join("”, “")}”` });
    } else if (action.type === "open_page" && action.url) {
      emit({ type: "log", stage: "research", track: track.label, message: `Read ${short(action.url)}` });
    } else if (action.type === "find_in_page") {
      emit({ type: "log", stage: "research", track: track.label, message: `Looked for “${action.pattern}” in ${short(action.url)}` });
    }
  }
  const response = await stream.finalResponse();

  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const a of part.annotations) {
        if (a.type === "url_citation") {
          const url = normalizeUrl(a.url);
          if (!citations.has(url)) citations.set(url, { url, title: a.title || short(url) });
        }
      }
    }
  }
  const notes = response.output_text;
  // Research notes also cite URLs inline; keep those so the writer may cite them.
  for (const m of notes.matchAll(/https?:\/\/[^\s)\]>"']+/g)) {
    const url = normalizeUrl(m[0].replace(/[.,;]+$/, ""));
    if (!citations.has(url)) citations.set(url, { url, title: short(url) });
  }
  return { track: track.id, label: track.label, notes, citations: [...citations.values()] };
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
