/**
 * Web search for providers without built-in search (e.g. Gemini free tier, where Google Search grounding has no quota).
 * Uses Tavily when TAVILY_API_KEY is set (free tier, more reliable from cloud hosts), otherwise DuckDuckGo's
 * keyless lite HTML endpoint.
 */
export type SearchResult = { url: string; title: string; snippet: string };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

function decode(s: string) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function tavily(query: string, max: number): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ query, max_results: max, search_depth: "basic" }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Tavily search failed: HTTP ${res.status}`);
  const data = (await res.json()) as { results?: { url: string; title: string; content: string }[] };
  return (data.results ?? []).map((r) => ({ url: r.url, title: r.title, snippet: r.content ?? "" }));
}

let lastDdg = 0;
const DDG_GAP_MS = 2500;
let ddgEmptyStreak = 0;
let ddgBlockedUntil = 0;

async function duckduckgo(query: string, max: number, retry = true): Promise<SearchResult[]> {
  if (Date.now() < ddgBlockedUntil) return [];
  // Space requests out globally; DuckDuckGo silently returns empty pages when it sees bursts.
  const wait = lastDdg + DDG_GAP_MS - Date.now();
  lastDdg = Math.max(Date.now(), lastDdg + DDG_GAP_MS);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
    headers: { "user-agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`DuckDuckGo search failed: HTTP ${res.status}`);
  const html = await res.text();
  const results: SearchResult[] = [];
  const linkRe = /<a[^>]+href="([^"]*uddg=[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets = [...html.matchAll(/<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g)].map((m) => decode(m[1]));
  let i = 0;
  for (const m of html.matchAll(linkRe)) {
    const uddg = /uddg=([^&]+)/.exec(m[1].replace(/&amp;/g, "&"))?.[1];
    if (!uddg) continue;
    const url = decodeURIComponent(uddg);
    if (/duckduckgo\.com\/y\.js|bing\.com\/aclick/.test(url)) continue;
    results.push({ url, title: decode(m[2]) || url, snippet: snippets[i] ?? "" });
    i++;
    if (results.length >= max) break;
  }
  if (results.length) {
    ddgEmptyStreak = 0;
    return results;
  }
  // Repeated empty pages mean we're being throttled; back off for a while instead of hammering.
  if (++ddgEmptyStreak >= 3) {
    ddgBlockedUntil = Date.now() + 5 * 60_000;
    return [];
  }
  if (retry) {
    lastDdg = Date.now() + 4000;
    return duckduckgo(query, max, false);
  }
  return results;
}

export function searchBackend(): "tavily" | "duckduckgo" {
  return process.env.TAVILY_API_KEY ? "tavily" : "duckduckgo";
}

export async function searchWeb(query: string, max = 6): Promise<SearchResult[]> {
  try {
    return searchBackend() === "tavily" ? await tavily(query, max) : await duckduckgo(query, max);
  } catch {
    return [];
  }
}
