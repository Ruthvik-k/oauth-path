import type { Emit } from "./events";
import { generate, nativeSearch, structured, webResearch, type Citation } from "./llm";
import { RESEARCH_TRACKS, researchSystemPrompt, type ResolvedApp, type TrackId } from "./prompts";
import { searchWeb, type SearchResult } from "./search";
import { fetchLinks, fetchPageText, fetchWithTimeout, normalizeUrl, relevantExcerpt } from "./web";
import { z } from "zod";

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

const PlanSchema = z.object({
  queries: z.array(z.string()).describe("4-6 distinct web search queries, most specific first"),
});

const UrlGuessSchema = z.object({
  urls: z.array(z.string()).describe("Up to 8 full https URLs of official pages, most relevant first"),
});

function brandOf(website: string) {
  try {
    const host = new URL(website).hostname.replace(/^www\./, "");
    return host.split(".").slice(-2, -1)[0] ?? host;
  } catch {
    return "";
  }
}

/** Official pages first (provider's own domain, docs/developer paths), then a few community pages. */
function rankResults(results: SearchResult[], app: ResolvedApp, max: number): SearchResult[] {
  const brand = brandOf(app.website).toLowerCase();
  const score = (r: SearchResult) => {
    let host = "";
    try {
      host = new URL(r.url).hostname.toLowerCase();
    } catch {
      return -1;
    }
    let s = 0;
    if (brand && host.includes(brand)) s += 10;
    if (/(^|\.)(developers?|docs|dev|api|learn|help|support)\./.test(host) || /\/(docs|developers?|api|reference|guides?)\b/.test(r.url)) s += 3;
    if (/oauth|auth|scope|permission|review|verif|publish|marketplace|app/.test(r.url.toLowerCase())) s += 2;
    if (/(stackoverflow|reddit|community\.|forum|devforum|github\.com|medium|dev\.to)/.test(host)) s += 1;
    return s;
  };
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const u = normalizeUrl(r.url);
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
  const sorted = unique.sort((a, b) => score(b) - score(a));
  const official = sorted.filter((r) => score(r) >= 10).slice(0, max - 2);
  const others = sorted.filter((r) => score(r) < 10).slice(0, max - official.length);
  return [...official, ...others];
}

/** Our own search → read → write loop, for providers without built-in web search. */
async function agentTrack(app: ResolvedApp, track: (typeof RESEARCH_TRACKS)[number], emit: Emit) {
  const log = (message: string) => emit({ type: "log", stage: "research", track: track.label, message });
  const plan = await structured({
    fast: true,
    name: "search_plan",
    schema: PlanSchema,
    system:
      "You plan web searches for a researcher. Write short keyword queries (3-7 words) like a developer would type. Never use site: or other operators and never guess domains. Aim at the provider's official developer docs and policy pages; include one query for developer forum reports on timelines or pitfalls.",
    user: `Product: ${app.name} (${app.website})\nResearch task:\n${track.prompt(app)}\n\nReturn 4-5 search queries.`,
    maxOutputTokens: 1024,
  });
  const baseline: Record<TrackId, string[]> = {
    build: [`${app.name} OAuth app developer documentation`],
    approval: [`${app.name} app marketplace review requirements`],
    nuances: [`${app.name} OAuth scopes permissions`],
  };
  const queries = [...baseline[track.id], ...plan.queries.map((q) => q.replace(/\bsite:\S+/gi, "").trim())].filter(Boolean).slice(0, 4);
  const all: SearchResult[] = [];
  for (const q of queries) {
    const res = await searchWeb(q, 6);
    log(`Searched “${q}” (${res.length} results)`);
    all.push(...res);
  }
  if (!all.length) {
    // Search unavailable (throttled or blocked): crawl the provider's own docs sites instead.
    // Start from hosts the model knows (its exact paths are often wrong) plus common developer subdomains,
    // then follow on-site links about OAuth, scopes, limits and review. Only pages that load are used.
    log("Web search unavailable; crawling the provider's documentation sites directly");
    const guess = await structured({
      fast: true,
      name: "known_docs_urls",
      schema: UrlGuessSchema,
      system: "You know the developer documentation of major SaaS products. List the official developer/API documentation entry pages you are confident exist.",
      user: `Product: ${app.name} (${app.website})\nList official developer docs entry pages relevant to:\n${track.prompt(app)}`,
      maxOutputTokens: 1024,
    }).catch(() => ({ urls: [] as string[] }));
    all.push(...(await crawlDocs(app, guess.urls, track.prompt(app), log)));
  }
  const picked = rankResults(all, app, 8);
  const pages = await Promise.all(
    picked.map(async (r) => {
      const text = await fetchPageText(r.url);
      if (text) log(`Read ${r.url.replace(/^https?:\/\//, "").slice(0, 70)}`);
      const body = text ? relevantExcerpt(text, track.prompt(app), 4000) : r.snippet;
      return body ? { ...r, body, fullPage: !!text } : null;
    }),
  );
  const sources = pages
    .filter((p): p is NonNullable<typeof p> => !!p)
    // Broad searches surface generic OAuth pages from other products; keep only pages that mention this app.
    .filter((p) => p.url.toLowerCase().includes(brandOf(app.website).toLowerCase()) || p.body.toLowerCase().includes(app.name.toLowerCase()));
  if (!sources.length) throw new Error(`Web search returned nothing usable for ${app.name}.`);
  const sourceBlock = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.fullPage ? "PAGE EXCERPT" : "SEARCH SNIPPET ONLY"}:\n${s.body}`)
    .join("\n\n---\n\n");
  const text = await generate({
    system: researchSystemPrompt(app),
    user: `${track.prompt(app)}\n\nUse ONLY the sources below (fetched just now). Cite each bullet with the exact source URL in parentheses. If the sources don't answer something, write an UNCLEAR: bullet instead of guessing.\n\nSOURCES:\n\n${sourceBlock}`,
    maxOutputTokens: 6144,
  });
  return { text, citations: sources.map((s) => ({ url: s.url, title: s.title })) };
}

/** Breadth-1 crawl of the provider's docs hosts, keeping links whose URL or anchor text matches the research topic. */
async function crawlDocs(app: ResolvedApp, guesses: string[], topic: string, log: (m: string) => void): Promise<SearchResult[]> {
  let domain = "";
  try {
    domain = new URL(app.website).hostname.replace(/^www\./, "");
  } catch {
    return [];
  }
  const roots = new Set<string>([`https://developers.${domain}/`, `https://developer.${domain}/`, `https://docs.${domain}/`, `https://${domain}/developers`]);
  for (const g of guesses) {
    try {
      const u = new URL(g);
      if (!u.hostname.endsWith(domain.split(".").slice(-2).join("."))) continue;
      roots.add(g);
      const parts = u.pathname.split("/").filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) roots.add(`${u.origin}/${parts.slice(0, i).join("/")}${i ? "/" : ""}`);
    } catch {
      // ignore bad guesses
    }
  }
  const registrable = domain.split(".").slice(-2).join(".");
  const keywords = ["oauth", "auth", "scope", "permission", "token", "rate", "limit", "app", "partner", "marketplace", "review", "certif", "publish", "terms", "policy", "developer", "api"];
  const topicWords = topic.toLowerCase().match(/[a-z]{5,}/g) ?? [];
  const found = new Map<string, SearchResult & { score: number }>();
  const pages = await Promise.all([...roots].slice(0, 12).map((r) => fetchLinks(r)));
  for (const page of pages) {
    if (!page) continue;
    found.set(page.finalUrl, { url: page.finalUrl, title: page.finalUrl.replace(/^https?:\/\//, ""), snippet: "", score: 1 });
    for (const l of page.links) {
      let host = "";
      try {
        host = new URL(l.url).hostname;
      } catch {
        continue;
      }
      if (!host.endsWith(registrable)) continue;
      const hay = `${l.url} ${l.text}`.toLowerCase();
      const score = keywords.filter((k) => hay.includes(k)).length + topicWords.filter((w) => hay.includes(w)).length * 0.5;
      if (score < 2) continue;
      const prev = found.get(l.url);
      if (!prev || prev.score < score) found.set(l.url, { url: l.url, title: l.text || l.url, snippet: "", score });
    }
  }
  const ranked = [...found.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  log(`Crawled ${pages.filter(Boolean).length} docs entry pages, found ${ranked.length} relevant links`);
  return ranked;
}

async function runTrack(app: ResolvedApp, track: (typeof RESEARCH_TRACKS)[number], emit: Emit): Promise<ResearchResult> {
  const out = nativeSearch()
    ? await webResearch({
        system: researchSystemPrompt(app),
        prompt: track.prompt(app),
        onAction: (message) => emit({ type: "log", stage: "research", track: track.label, message }),
      })
    : await agentTrack(app, track, emit);

  const citations = new Map<string, Citation>();
  for (const c of out.citations) {
    const url = normalizeUrl(c.url);
    if (!citations.has(url)) citations.set(url, { url, title: c.title || short(url) });
  }
  // With native search, URLs the model typed are kept only if they load. In agent mode only pages we read count.
  const inline = new Set<string>();
  if (nativeSearch()) {
    for (const m of out.text.matchAll(/https?:\/\/[^\s)\]>"';]+/g)) {
      const url = normalizeUrl(m[0].replace(/[.,]+$/, ""));
      if (!citations.has(url) && !url.includes("grounding-api-redirect")) inline.add(url);
    }
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
