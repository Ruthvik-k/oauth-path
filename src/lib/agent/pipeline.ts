import { z } from "zod";
import { findCatalogApp, slugify } from "../catalog";
import { lookupComposio, type ComposioStatus } from "../composio";
import { GuideContentSchema, type Confidence, type Guide, type GuideContent } from "../guide-schema";
import { getCuratedGuide, getGeneratedGuide, saveGeneratedGuide } from "../store";
import type { Emit } from "./events";
import { modelLabel, nativeSearch, provider, structured, webResearch } from "./llm";
import { runProbes } from "./probes";
import { searchWeb } from "./search";
import { RESOLVE_SYSTEM, synthesisSystemPrompt, type ResolvedApp } from "./prompts";
import { research, type ResearchResult } from "./research";
import { verifyClaims } from "./verify";
import { normalizeUrl } from "./web";

const ResolveSchema = z.object({
  recognized: z.boolean(),
  name: z.string(),
  website: z.string(),
  category: z.string(),
  aliases: z.array(z.string()),
  offersThirdPartyOAuth: z.boolean(),
  note: z.string(),
});

export function cleanQuery(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f<>`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function resolveApp(query: string, emit: Emit): Promise<{ app: ResolvedApp; catalogSlug: string | null; composioNames: string[] }> {
  const match = findCatalogApp(query);
  if (match) {
    emit({ type: "log", stage: "resolve", message: `Matched “${match.name}” in the 100-app library` });
    return {
      app: { name: match.name, website: match.website, category: match.category, aliases: [match.composioSlug] },
      catalogSlug: match.slug,
      composioNames: [match.composioSlug, match.name],
    };
  }
  emit({ type: "log", stage: "resolve", message: `“${query}” is not in the library. Looking it up on the web…` });
  if (!provider()) throw new Error(`“${query}” isn't in the library, and live generation isn't configured on this server (no GEMINI_API_KEY or OPENAI_API_KEY).`);
  const found = nativeSearch()
    ? (
        await webResearch({
          fast: true,
          system: RESOLVE_SYSTEM,
          prompt: `The developer typed: "${query}". Identify the product, its official website, what it does, and whether it offers OAuth 2.0 for third-party developers (name the developer docs page if you find it).`,
        })
      ).text
    : (
        await Promise.all([searchWeb(`${query} official site`, 5), searchWeb(`${query} OAuth developer API`, 5)])
      )
        .flat()
        .map((r) => `- ${r.title} | ${r.url} | ${r.snippet}`)
        .join("\n");
  const r = await structured({
    fast: true,
    name: "resolved_app",
    schema: ResolveSchema,
    system: RESOLVE_SYSTEM,
    user: `The developer typed: "${query}"\n\nWeb findings:\n${found}\n\nReturn the identification as JSON.`,
    maxOutputTokens: 2048,
  });
  if (!r.recognized || !r.name.trim()) {
    throw new Error(`Couldn't identify an app called “${query}”. Try its full name or website.`);
  }
  emit({
    type: "log",
    stage: "resolve",
    message: `Identified ${r.name} (${r.website}). ${r.offersThirdPartyOAuth ? "It offers OAuth for third-party apps." : "OAuth for third parties is unclear or not offered."}`,
  });
  return {
    app: { name: r.name, website: r.website, category: r.category, aliases: r.aliases },
    catalogSlug: null,
    composioNames: [r.name, ...r.aliases],
  };
}

function guessKind(url: string, app: ResolvedApp): "official" | "community" | "composio" {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "community";
  }
  if (host.includes("composio.dev")) return "composio";
  const appHost = (() => {
    try {
      return new URL(app.website).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const brand = appHost.split(".").slice(-2, -1)[0] ?? "";
  const community = /(stackoverflow|reddit|medium|dev\.to|github\.com|community\.|forum|devforum|discuss|quora|hashnode|substack|youtube)/;
  if (community.test(host)) return "community";
  if (brand && host.includes(brand)) return "official";
  return "community";
}

async function synthesize(
  app: ResolvedApp,
  notes: ResearchResult[],
  sourceList: { id: string; url: string; title: string; kind: string }[],
  composio: ComposioStatus,
  emit: Emit,
): Promise<GuideContent> {
  const userPrompt = [
    `APP: ${app.name} (${app.website}), category: ${app.category}`,
    `COMPOSIO MANAGED AUTH STATUS: ${composio.note}`,
    `SOURCE LIST (kind is a heuristic guess from the domain; correct it if wrong):`,
    ...sourceList.map((s) => `${s.id} | ${s.kind} | ${s.title} | ${s.url}`),
    "",
    ...notes.flatMap((n) => [`=== RESEARCH NOTES: ${n.label} ===`, n.notes, ""]),
  ].join("\n");

  let lastEmit = 0;
  return structured({
    name: "oauth_setup_guide",
    schema: GuideContentSchema,
    system: synthesisSystemPrompt(),
    user: userPrompt,
    maxOutputTokens: 65_536,
    onProgress: (chars) => {
      if (Date.now() - lastEmit < 1500) return;
      lastEmit = Date.now();
      emit({ type: "progress", stage: "synthesize", message: `Writing… ${Math.round(chars / 1000)}k characters` });
    },
  });
}

/**
 * Evidence hygiene the model can't be trusted to do: drop sources that never appeared in
 * research, drop dangling citations, and downgrade claims with no remaining support.
 */
function sanitize(content: GuideContent, allowedUrls: Set<string>): { dropped: number } {
  const before = content.sources.length;
  content.sources = content.sources.filter((s) => allowedUrls.has(normalizeUrl(s.url)));
  const kinds = new Map(content.sources.map((s) => [s.id, s.kind]));
  const fix = <T extends { sourceIds: string[]; confidence: Confidence }>(item: T) => {
    item.sourceIds = item.sourceIds.filter((id) => kinds.has(id));
    const k = item.sourceIds.map((id) => kinds.get(id));
    if (!item.sourceIds.length) item.confidence = "inferred";
    else if (item.confidence === "tested" || item.confidence === "official")
      item.confidence = k.includes("official") ? "official" : k.includes("community") ? "community" : "inferred";
  };
  content.phases.forEach((p) => p.steps.forEach(fix));
  content.requirements.forEach(fix);
  content.permissions.forEach(fix);
  content.nuances.forEach(fix);
  content.blockers.forEach(fix);
  content.verdict.difficulty = Math.min(5, Math.max(1, Math.round(content.verdict.difficulty)));
  return { dropped: before - content.sources.length };
}

export type BuildInput = { app: ResolvedApp; slug: string; query: string; composio: ComposioStatus };

/** Research → write → probe → fact-check. Returns a guide without saving it. */
export async function buildGuide({ app, slug, query, composio }: BuildInput, emit: Emit): Promise<Guide> {
  // 2. Research
  emit({ type: "stage", stage: "research", status: "start" });
  const notes = await research(app, emit);
  const allCitations = new Map<string, { url: string; title: string }>();
  for (const n of notes) for (const c of n.citations) if (!allCitations.has(c.url)) allCitations.set(c.url, c);
  const sourceList = [...allCitations.values()].slice(0, 40).map((c, i) => ({ id: `s${i + 1}`, url: c.url, title: c.title, kind: guessKind(c.url, app) }));
  emit({ type: "stage", stage: "research", status: "done", message: `${sourceList.length} sources collected` });

  // 3. Synthesize
  emit({ type: "stage", stage: "synthesize", status: "start" });
  const content = await synthesize(app, notes, sourceList, composio, emit);
  const { dropped } = sanitize(content, new Set(sourceList.map((s) => normalizeUrl(s.url))));
  if (dropped) emit({ type: "log", stage: "synthesize", message: `Removed ${dropped} source(s) that never appeared in research` });
  emit({ type: "stage", stage: "synthesize", status: "done", message: `${content.phases.reduce((n, p) => n + p.steps.length, 0)} steps, ${content.sources.length} sources` });

  // 4 + 5. Probe and verify in parallel
  emit({ type: "stage", stage: "probe", status: "start" });
  emit({ type: "stage", stage: "verify", status: "start" });
  const [probes, claimChecks] = await Promise.all([
    runProbes(content, composio, emit).then((r) => {
      emit({ type: "stage", stage: "probe", status: "done", message: `${r.filter((p) => p.ok).length}/${r.length} probes passed` });
      return r;
    }),
    verifyClaims(content, emit).then((r) => {
      const ok = r.filter((c) => c.verdict === "supported" || c.verdict === "partially_supported").length;
      emit({ type: "stage", stage: "verify", status: "done", message: `${ok}/${r.length} checked claims supported` });
      return r;
    }),
  ]);

  const now = new Date().toISOString();
  const count = (v: string) => claimChecks.filter((c) => c.verdict === v).length;
  return {
    ...content,
    slug,
    origin: "generated",
    createdAt: now,
    lastCheckedAt: now,
    model: await modelLabel(),
    query,
    composio,
    verification: {
      summary: `Agent-generated from ${content.sources.length} sources. The fact-check re-read the cited pages for ${claimChecks.length} key claims: ${count("supported")} supported, ${count("partially_supported")} partially supported, ${count("not_supported")} not supported (downgraded to inferred), ${count("unreachable")} could not be fetched. No human has tried this setup yet.`,
      probes,
      claimChecks,
      setupAttempts: [],
      corrections: [],
    },
  };
}

export async function resolveForBuild(rawQuery: string, emit: Emit) {
  const query = cleanQuery(rawQuery);
  if (query.length < 2) throw new Error("Enter an app name or website.");
  const resolved = await resolveApp(query, emit);
  return { query, ...resolved };
}

export async function generateGuide(rawQuery: string, emit: Emit, opts: { force?: boolean } = {}): Promise<string> {
  // 1. Resolve
  emit({ type: "stage", stage: "resolve", status: "start" });
  const { query, app, catalogSlug, composioNames } = await resolveForBuild(rawQuery, emit);
  const catalogMatch = catalogSlug ? findCatalogApp(catalogSlug) : null;
  if (catalogMatch?.guideSlug && getCuratedGuide(catalogMatch.guideSlug)) {
    emit({ type: "stage", stage: "resolve", status: "done", message: "A human-verified guide already exists." });
    emit({ type: "done", slug: catalogMatch.guideSlug, cached: true, name: app.name });
    return catalogMatch.guideSlug;
  }
  const slug = catalogSlug ?? slugify(app.name);
  if (getCuratedGuide(slug)) {
    emit({ type: "stage", stage: "resolve", status: "done", message: "A human-verified guide already exists." });
    emit({ type: "done", slug, cached: true, name: app.name });
    return slug;
  }
  if (!opts.force && (await getGeneratedGuide(slug))) {
    emit({ type: "stage", stage: "resolve", status: "done", message: "An agent-generated guide already exists." });
    emit({ type: "done", slug, cached: true, name: app.name });
    return slug;
  }
  if (!provider()) {
    throw new Error(`There's no guide for ${app.name} yet, and live generation isn't configured on this server (no GEMINI_API_KEY or OPENAI_API_KEY).`);
  }
  const composio = await lookupComposio(composioNames);
  emit({ type: "log", stage: "resolve", message: composio.note });
  emit({ type: "stage", stage: "resolve", status: "done", message: app.name });

  const guide = await buildGuide({ app, slug, query, composio }, emit);

  // 6. Publish
  emit({ type: "stage", stage: "publish", status: "start" });
  await saveGeneratedGuide(guide);
  emit({ type: "stage", stage: "publish", status: "done", message: `/guides/${slug}` });
  emit({ type: "done", slug, cached: false, name: app.name });
  return slug;
}
