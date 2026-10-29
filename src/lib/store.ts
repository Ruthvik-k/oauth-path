import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { get, put } from "@vercel/blob";
import { curatedGuides } from "@/data/guides";
import { seedGeneratedGuides } from "@/data/generated";
import type { ApprovalTier, Guide } from "./guide-schema";

export type GuideSummary = {
  slug: string;
  name: string;
  category: string;
  difficulty: number;
  approvalTier: ApprovalTier;
  timeToProduction: string;
  origin: Guide["origin"];
  createdAt: string;
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
const INDEX_PATH = "guides/_index.json";

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Local development stores generated guides on disk. On Vercel without Blob configured,
// only /tmp is writable, so guides survive just for the lifetime of the instance.
const localDir = () =>
  process.env.VERCEL ? path.join(os.tmpdir(), "oauth-path") : path.join(process.cwd(), ".data");

async function readJson<T>(pathname: string): Promise<T | null> {
  if (blobEnabled()) {
    try {
      const res = await get(pathname, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return null;
      return JSON.parse(await new Response(res.stream).text()) as T;
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(await fs.readFile(path.join(localDir(), pathname), "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(pathname: string, value: unknown) {
  const body = JSON.stringify(value, null, 2);
  if (blobEnabled()) {
    await put(pathname, body, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    return;
  }
  const file = path.join(localDir(), pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body, "utf8");
}

export function summarize(guide: Guide): GuideSummary {
  return {
    slug: guide.slug,
    name: guide.app.name,
    category: guide.app.category,
    difficulty: guide.verdict.difficulty,
    approvalTier: guide.verdict.approvalTier,
    timeToProduction: guide.verdict.timeToProductionShort,
    origin: guide.origin,
    createdAt: guide.createdAt,
  };
}

export function getCuratedGuide(slug: string): Guide | null {
  return curatedGuides[slug] ?? null;
}

export function listCuratedGuides(): Guide[] {
  return Object.values(curatedGuides);
}

export async function getGeneratedGuide(slug: string): Promise<Guide | null> {
  if (!SLUG_RE.test(slug)) return null;
  return (await readJson<Guide>(`guides/${slug}.json`)) ?? seedGeneratedGuides[slug] ?? null;
}

export async function getGuide(slug: string): Promise<Guide | null> {
  return getCuratedGuide(slug) ?? (await getGeneratedGuide(slug));
}

export async function listGeneratedGuides(): Promise<GuideSummary[]> {
  const stored = (await readJson<GuideSummary[]>(INDEX_PATH)) ?? [];
  const storedSlugs = new Set(stored.map((g) => g.slug));
  const seeds = Object.values(seedGeneratedGuides)
    .filter((g) => !storedSlugs.has(g.slug))
    .map(summarize);
  return [...stored, ...seeds];
}

export async function saveGeneratedGuide(guide: Guide): Promise<void> {
  if (!SLUG_RE.test(guide.slug)) throw new Error(`Invalid slug: ${guide.slug}`);
  if (getCuratedGuide(guide.slug)) throw new Error(`Refusing to overwrite curated guide ${guide.slug}`);
  await writeJson(`guides/${guide.slug}.json`, guide);
  const index = (await listGeneratedGuides()).filter((g) => g.slug !== guide.slug);
  index.unshift(summarize(guide));
  await writeJson(INDEX_PATH, index);
}

export const storageMode = () => (blobEnabled() ? "vercel-blob" : process.env.VERCEL ? "ephemeral-tmp" : "local-disk");
