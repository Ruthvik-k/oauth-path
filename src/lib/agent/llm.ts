/**
 * Provider-neutral LLM layer. The agent needs two capabilities:
 *  - webResearch: answer a prompt using live web search, returning text plus the URLs actually used
 *  - structured: produce JSON that validates against a Zod schema
 * Google Gemini (free tier with Google Search grounding) and OpenAI (Responses API + web_search) both implement them.
 */
import { GoogleGenAI, ThinkingLevel, type GroundingMetadata } from "@google/genai";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

export type Provider = "gemini" | "openai";
export type Citation = { url: string; title: string };

export function provider(): Provider | null {
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  if (forced === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (forced === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

function requireProvider(): Provider {
  const p = provider();
  if (!p) throw new Error("No LLM is configured on the server. Set GEMINI_API_KEY (free) or OPENAI_API_KEY.");
  return p;
}

/**
 * Whether research uses the provider's built-in web search. Gemini's Google Search grounding has no free-tier quota
 * on many projects, so by default Gemini research runs our own search-and-read loop instead (set GEMINI_GROUNDING=1 to opt in).
 */
export function nativeSearch(): boolean {
  return requireProvider() === "openai" || process.env.GEMINI_GROUNDING === "1";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries rate-limit and transient errors; free tiers have low per-minute quotas. */
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const err = e as { status?: number; message?: string };
      const status = err.status ?? Number(/\b(429|500|502|503|504)\b/.exec(err.message ?? "")?.[1] ?? 0);
      const network = /Incomplete JSON segment|fetch failed|terminated|ECONNRESET|socket hang up|other side closed/i.test(err.message ?? "");
      if ((!network && ![429, 500, 502, 503, 504].includes(status)) || i === attempts - 1) throw e;
      const hinted = /retry(?:Delay)?["':\s]+(\d+(?:\.\d+)?)s/i.exec(err.message ?? "");
      const wait = Math.min(hinted ? Number(hinted[1]) * 1000 + 500 : 2000 * 2 ** i, 40_000);
      console.warn(`[llm] ${label}: ${network ? "connection dropped" : `HTTP ${status}`}, retrying in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
  throw last;
}

// ───────────────────────── Gemini ─────────────────────────

let gemini: GoogleGenAI | null = null;
const geminiClient = () => (gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

let geminiModels: Promise<{ main: string; fast: string }> | null = null;

/**
 * Picks models unless GEMINI_MODEL / GEMINI_FAST_MODEL are set. Speed matters for a live demo: in our benchmark
 * gemini-3.5-flash answered a research prompt in ~9s vs ~150s for gemini-3.8-flash, so we prefer known-fast models
 * and fall back to the newest available Flash / Flash-Lite.
 */
function pickGeminiModels(): Promise<{ main: string; fast: string }> {
  geminiModels ??= (async () => {
    const fallback = { main: "gemini-flash-latest", fast: "gemini-flash-lite-latest" };
    let names: string[] = [];
    try {
      const pager = await geminiClient().models.list({ config: { pageSize: 200 } });
      for await (const m of pager) {
        if (m.name && (m.supportedActions ?? ["generateContent"]).includes("generateContent")) names.push(m.name.replace(/^models\//, ""));
      }
    } catch {
      names = [];
    }
    const preferred = (list: string[]) => list.find((n) => names.includes(n));
    const best = (re: RegExp) =>
      names
        .map((n) => ({ n, m: re.exec(n) }))
        .filter((x): x is { n: string; m: RegExpExecArray } => !!x.m)
        .sort((a, b) => Number(b.m[1]) - Number(a.m[1]))[0]?.n;
    return {
      main:
        process.env.GEMINI_MODEL ||
        preferred(["gemini-3.5-flash", "gemini-flash-latest"]) ||
        best(/^gemini-(\d+(?:\.\d+)?)-flash$/) ||
        fallback.main,
      fast:
        process.env.GEMINI_FAST_MODEL ||
        preferred(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"]) ||
        best(/^gemini-(\d+(?:\.\d+)?)-flash-lite$/) ||
        fallback.fast,
    };
  })();
  return geminiModels;
}

/** Gemini 3 Flash models think by default; low thinking keeps latency demo-friendly. Lite models don't need it. */
function thinking(model: string) {
  return /^gemini-3/.test(model) && !/lite/.test(model) ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {};
}

/** Google Search grounding returns vertexaisearch redirect links; resolve them to the real page URL. */
async function resolveRedirect(uri: string): Promise<string> {
  if (!uri.includes("grounding-api-redirect")) return uri;
  try {
    const res = await fetch(uri, { redirect: "manual", signal: AbortSignal.timeout(8_000) });
    return res.headers.get("location") ?? uri;
  } catch {
    return uri;
  }
}

async function geminiResearch(opts: ResearchOptions): Promise<ResearchOutput> {
  const { main, fast } = await pickGeminiModels();
  const model = opts.fast ? fast : main;
  const metas: GroundingMetadata[] = [];
  let text = "";
  const seenQueries = new Set<string>();
  await withRetry(async () => {
    text = "";
    metas.length = 0;
    const stream = await geminiClient().models.generateContentStream({
      model,
      contents: opts.prompt,
      config: { systemInstruction: opts.system, tools: [{ googleSearch: {} }], temperature: 0.2, ...thinking(model) },
    });
    for await (const chunk of stream) {
      text += chunk.text ?? "";
      const meta = chunk.candidates?.[0]?.groundingMetadata;
      if (meta) {
        metas.push(meta);
        const fresh = (meta.webSearchQueries ?? []).filter((q) => !seenQueries.has(q));
        fresh.forEach((q) => seenQueries.add(q));
        if (fresh.length) opts.onAction?.(`Searched “${fresh.join("”, “")}”`);
      }
    }
  }, "research");

  // Resolve every grounding chunk to a real URL, then annotate the supported sentences with those URLs.
  const citations = new Map<string, Citation>();
  const inserts: { segment: string; urls: string[] }[] = [];
  for (const meta of metas) {
    const chunkUrls = await Promise.all(
      (meta.groundingChunks ?? []).map(async (c) => {
        if (!c.web?.uri) return null;
        const url = await resolveRedirect(c.web.uri);
        if (!citations.has(url)) {
          citations.set(url, { url, title: c.web.title || new URL(url).host });
          opts.onAction?.(`Read ${new URL(url).host}${new URL(url).pathname.slice(0, 40)}`);
        }
        return url;
      }),
    );
    for (const s of meta.groundingSupports ?? []) {
      const urls = (s.groundingChunkIndices ?? []).map((i) => chunkUrls[i]).filter((u): u is string => !!u);
      if (s.segment?.text && urls.length) inserts.push({ segment: s.segment.text, urls: [...new Set(urls)] });
    }
  }
  for (const ins of inserts) {
    const at = text.indexOf(ins.segment);
    if (at < 0) continue;
    const end = at + ins.segment.length;
    text = `${text.slice(0, end)} (${ins.urls.join(" ; ")})${text.slice(end)}`;
  }
  return { text, citations: [...citations.values()], model };
}

/** Gemini's JSON-schema support is a subset of JSON Schema; strip keywords it rejects. */
function toGeminiSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema" || k === "additionalProperties" || k === "minimum" || k === "maximum") continue;
      out[k] = strip(v);
    }
    return out;
  };
  return strip(json);
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("Model did not return JSON");
  }
}

async function geminiStructured<T>(opts: StructuredOptions<T>): Promise<T> {
  const { main, fast } = await pickGeminiModels();
  const primary = opts.fast ? fast : main;
  try {
    return await geminiStructuredWith(primary, opts);
  } catch (e) {
    const backup = primary === main ? fast : main;
    if (!isOverloaded(e) || backup === primary) throw e;
    console.warn(`[llm] ${opts.name}: ${primary} overloaded, falling back to ${backup}`);
    return geminiStructuredWith(backup, opts);
  }
}

const isOverloaded = (e: unknown) =>
  [429, 500, 503].includes((e as { status?: number }).status ?? 0) || /Incomplete JSON segment|fetch failed/i.test((e as Error).message ?? "");

async function geminiGenerate(opts: GenerateOptions): Promise<string> {
  const { main, fast } = await pickGeminiModels();
  const run = (model: string) =>
    withRetry(async () => {
      const res = await geminiClient().models.generateContent({
        model,
        contents: opts.user,
        config: { systemInstruction: opts.system, maxOutputTokens: opts.maxOutputTokens ?? 8192, temperature: 0.2, ...thinking(model) },
      });
      return res.text ?? "";
    }, "generate");
  const primary = opts.fast ? fast : main;
  try {
    return await run(primary);
  } catch (e) {
    const backup = primary === main ? fast : main;
    if (!isOverloaded(e) || backup === primary) throw e;
    console.warn(`[llm] generate: ${primary} overloaded, falling back to ${backup}`);
    return run(backup);
  }
}

async function geminiStructuredWith<T>(model: string, opts: StructuredOptions<T>): Promise<T> {
  const schemaJson = toGeminiSchema(opts.schema);
  let useSchemaParam = true;
  let feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const user =
      opts.user +
      (useSchemaParam ? "" : `\n\nReturn ONLY JSON matching this JSON Schema:\n${JSON.stringify(schemaJson)}`) +
      feedback;
    let text = "";
    try {
      await withRetry(async () => {
        text = "";
        const stream = await geminiClient().models.generateContentStream({
          model,
          contents: user,
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            ...(useSchemaParam ? { responseJsonSchema: schemaJson } : {}),
            maxOutputTokens: opts.maxOutputTokens ?? 32_768,
            temperature: 0.2,
            ...thinking(model),
          },
        });
        for await (const chunk of stream) {
          text += chunk.text ?? "";
          opts.onProgress?.(text.length);
        }
      }, opts.name);
    } catch (e) {
      const err = e as { status?: number };
      // Some models reject complex schemas; fall back to describing the schema in the prompt.
      if (err.status === 400 && useSchemaParam) {
        useSchemaParam = false;
        continue;
      }
      throw e;
    }
    try {
      return opts.schema.parse(extractJson(text));
    } catch (e) {
      feedback = `\n\nYour previous answer was invalid (${(e as Error).message.slice(0, 600)}). Return corrected, complete JSON.`;
    }
  }
  throw new Error(`Could not get valid ${opts.name} JSON from ${model}`);
}

// ───────────────────────── OpenAI ─────────────────────────

let openaiClient: OpenAI | null = null;
const oa = () => (openaiClient ??= new OpenAI({ timeout: 180_000, maxRetries: 2 }));
const openaiModels = () => ({
  main: process.env.OPENAI_MODEL || "gpt-5.4",
  fast: process.env.OPENAI_FAST_MODEL || "gpt-5.4-mini",
});
const reasoning = (model: string) => (/^(gpt-5|gpt-6|o\d)/.test(model) ? { reasoning: { effort: "low" as const } } : {});

async function openaiResearch(opts: ResearchOptions): Promise<ResearchOutput> {
  const model = opts.fast ? openaiModels().fast : openaiModels().main;
  const stream = oa().responses.stream({
    model,
    ...reasoning(model),
    tools: [{ type: "web_search", search_context_size: opts.fast ? "low" : "medium" }],
    include: ["web_search_call.action.sources"],
    input: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.prompt },
    ],
  });
  for await (const event of stream) {
    if (event.type !== "response.output_item.done" || event.item.type !== "web_search_call") continue;
    const action = event.item.action;
    if (action.type === "search") {
      const queries = action.queries?.length ? action.queries : action.query ? [action.query] : [];
      if (queries.length) opts.onAction?.(`Searched “${queries.join("”, “")}”`);
    } else if (action.type === "open_page" && action.url) {
      opts.onAction?.(`Read ${action.url.replace(/^https?:\/\//, "").slice(0, 60)}`);
    }
  }
  const response = await stream.finalResponse();
  const citations = new Map<string, Citation>();
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const a of part.annotations) {
        if (a.type === "url_citation" && !citations.has(a.url)) citations.set(a.url, { url: a.url, title: a.title || a.url });
      }
    }
  }
  return { text: response.output_text, citations: [...citations.values()], model };
}

async function openaiStructured<T>(opts: StructuredOptions<T>): Promise<T> {
  const model = opts.fast ? openaiModels().fast : openaiModels().main;
  const stream = oa().responses.stream({
    model,
    ...reasoning(model),
    input: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    text: { format: zodTextFormat(opts.schema, opts.name) },
  });
  let chars = 0;
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      chars += event.delta.length;
      opts.onProgress?.(chars);
    }
  }
  const response = await stream.finalResponse();
  return opts.schema.parse(JSON.parse(response.output_text));
}

async function openaiGenerate(opts: GenerateOptions): Promise<string> {
  const model = opts.fast ? openaiModels().fast : openaiModels().main;
  const res = await oa().responses.create({
    model,
    ...reasoning(model),
    input: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return res.output_text;
}

// ───────────────────────── Public API ─────────────────────────

export type ResearchOptions = { system: string; prompt: string; fast?: boolean; onAction?: (message: string) => void };
export type ResearchOutput = { text: string; citations: Citation[]; model: string };
export type GenerateOptions = { system: string; user: string; fast?: boolean; maxOutputTokens?: number };
export type StructuredOptions<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  name: string;
  fast?: boolean;
  maxOutputTokens?: number;
  onProgress?: (chars: number) => void;
};

export function webResearch(opts: ResearchOptions): Promise<ResearchOutput> {
  return requireProvider() === "gemini" ? geminiResearch(opts) : openaiResearch(opts);
}

export function structured<T>(opts: StructuredOptions<T>): Promise<T> {
  return requireProvider() === "gemini" ? geminiStructured(opts) : openaiStructured(opts);
}

export function generate(opts: GenerateOptions): Promise<string> {
  return requireProvider() === "gemini" ? geminiGenerate(opts) : openaiGenerate(opts);
}

export async function modelLabel(): Promise<string> {
  const p = requireProvider();
  if (p === "gemini") {
    const m = await pickGeminiModels();
    const search = nativeSearch() ? "Google Search grounding" : `agent search via ${process.env.TAVILY_API_KEY ? "Tavily" : "DuckDuckGo"}`;
    return `${m.main} + ${m.fast} (Gemini, ${search})`;
  }
  const m = openaiModels();
  return `${m.main} + ${m.fast} (OpenAI, web_search)`;
}
