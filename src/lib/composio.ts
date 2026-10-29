/**
 * Looks up whether Composio provides a managed OAuth app for a toolkit, using the
 * public directory at https://docs.composio.dev/toolkits/managed-auth (no API key needed).
 */
const DIRECTORY_URL = "https://docs.composio.dev/toolkits/managed-auth.md";

type Directory = { managed: Map<string, string>; byo: Map<string, string>; fetchedAt: number };
let cached: Directory | null = null;

function norm(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function loadDirectory(): Promise<Directory | null> {
  if (cached && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000) return cached;
  try {
    const res = await fetch(DIRECTORY_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return cached;
    const text = await res.text();
    const sections = text.split(/^## /m).slice(1);
    const managed = new Map<string, string>();
    const byo = new Map<string, string>();
    for (const section of sections) {
      const target = section.startsWith("Composio-managed") ? managed : section.startsWith("Bring your own") ? byo : null;
      if (!target) continue;
      for (const m of section.matchAll(/^\| \[(.+?)\]\(.+?\) \| `(.+?)` \|/gm)) {
        target.set(norm(m[1]), m[2]);
        target.set(norm(m[2]), m[2]);
      }
    }
    cached = { managed, byo, fetchedAt: Date.now() };
    return cached;
  } catch {
    return cached;
  }
}

export type ComposioStatus = {
  toolkitSlug: string | null;
  managed: boolean | null;
  note: string;
};

export async function lookupComposio(names: string[]): Promise<ComposioStatus> {
  const dir = await loadDirectory();
  if (!dir) {
    return { toolkitSlug: null, managed: null, note: "Could not reach the Composio managed-auth directory." };
  }
  for (const name of names) {
    const key = norm(name);
    if (!key) continue;
    const m = dir.managed.get(key);
    if (m) {
      return {
        toolkitSlug: m,
        managed: true,
        note: `Composio provides a managed OAuth app for ${m}, so you can prototype without registering your own. You still need your own app for your branding on the consent screen, custom scopes, dedicated rate limits, or enterprise customers.`,
      };
    }
    const b = dir.byo.get(key);
    if (b) {
      return {
        toolkitSlug: b,
        managed: false,
        note: `Composio lists ${b} as "bring your own OAuth app": you must register an OAuth app with the provider and give Composio its client ID and secret.`,
      };
    }
  }
  return {
    toolkitSlug: null,
    managed: null,
    note: "Not found in Composio's OAuth toolkit directory. You would register your own OAuth app (and may need a custom integration).",
  };
}
