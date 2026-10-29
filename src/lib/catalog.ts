import catalogData from "@/data/catalog.json";

export type CatalogApp = {
  slug: string;
  name: string;
  category: string;
  website: string;
  composioSlug: string;
  composioManaged: boolean;
  /** Slug of a curated guide that covers this app (e.g. Gmail -> google-workspace). */
  guideSlug: string | null;
};

export const catalog = catalogData as CatalogApp[];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function hostOf(input: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!url.hostname.includes(".")) return null;
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Looks the query up in the 100-app catalog by name, slug or website domain. */
export function findCatalogApp(query: string): CatalogApp | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const s = slugify(q);
  const byName = catalog.find(
    (a) => a.name.toLowerCase() === q || a.slug === s || a.composioSlug.toLowerCase() === s.replace(/-/g, "_"),
  );
  if (byName) return byName;
  const host = q.includes(".") ? hostOf(q) : null;
  if (host) {
    return (
      catalog.find((a) => {
        const appHost = hostOf(a.website);
        return appHost !== null && (appHost === host || host.endsWith(`.${appHost}`) || appHost.endsWith(`.${host}`));
      }) ?? null
    );
  }
  return null;
}
