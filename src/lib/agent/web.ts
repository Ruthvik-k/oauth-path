const UA = "Mozilla/5.0 (compatible; OAuthPathBot/1.0; +https://github.com/) research agent";

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 10_000) {
  return fetch(url, {
    ...init,
    headers: { "user-agent": UA, accept: "text/html,application/json;q=0.9,*/*;q=0.8", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(ms),
  });
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const pageCache = new Map<string, Promise<string | null>>();

/** Fetches a page and returns readable text, or null if blocked / JS-only / unreachable. */
export function fetchPageText(url: string): Promise<string | null> {
  if (!pageCache.has(url)) {
    pageCache.set(
      url,
      (async () => {
        try {
          const res = await fetchWithTimeout(url, {}, 12_000);
          if (!res.ok) return null;
          const type = res.headers.get("content-type") ?? "";
          const body = await res.text();
          const text = type.includes("html") ? htmlToText(body) : body;
          return text.length > 400 ? text : null;
        } catch {
          return null;
        }
      })(),
    );
  }
  return pageCache.get(url)!;
}

/** Picks the paragraphs of a long page most related to a claim, keeping page order. */
export function relevantExcerpt(text: string, claim: string, maxChars = 12_000): string {
  if (text.length <= maxChars) return text;
  const words = new Set(
    claim
      .toLowerCase()
      .split(/[^a-z0-9.]+/)
      .filter((w) => w.length > 3),
  );
  const paras = text.split(/\n+/).map((p, i) => {
    const lw = p.toLowerCase();
    let score = 0;
    for (const w of words) if (lw.includes(w)) score++;
    return { i, p, score };
  });
  const picked = [...paras].sort((a, b) => b.score - a.score);
  const keep = new Set<number>();
  let total = 0;
  for (const para of picked) {
    if (total > maxChars) break;
    for (const j of [para.i - 1, para.i, para.i + 1]) {
      if (j >= 0 && j < paras.length && !keep.has(j)) {
        keep.add(j);
        total += paras[j].p.length;
      }
    }
  }
  return paras
    .filter((p) => keep.has(p.i))
    .map((p) => p.p)
    .join("\n")
    .slice(0, maxChars);
}

/** Fetches an HTML page and returns its links (absolute URLs + anchor text). Used when web search is unavailable. */
export async function fetchLinks(url: string): Promise<{ finalUrl: string; links: { url: string; text: string }[] } | null> {
  try {
    const res = await fetchWithTimeout(url, { redirect: "follow" }, 10_000);
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const html = await res.text();
    const links: { url: string; text: string }[] = [];
    for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      try {
        const abs = new URL(m[1], res.url);
        if (!/^https?:$/.test(abs.protocol)) continue;
        links.push({ url: abs.toString(), text: htmlToText(m[2]).slice(0, 120) });
      } catch {
        // skip malformed hrefs
      }
    }
    return { finalUrl: res.url, links };
  } catch {
    return null;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (key.startsWith("utm_")) u.searchParams.delete(key);
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}
