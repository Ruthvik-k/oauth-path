import Link from "next/link";
import { Suspense } from "react";
import { Library, type LibraryEntry } from "@/components/Library";
import { SubmitBox } from "@/components/SubmitBox";
import { DifficultyMeter, TierBadge } from "@/components/ui";
import { catalog } from "@/lib/catalog";
import { listCuratedGuides, listGeneratedGuides, summarize, type GuideSummary } from "@/lib/store";

function toGuideRef(s: GuideSummary): LibraryEntry["guide"] {
  return { slug: s.slug, origin: s.origin, difficulty: s.difficulty, approvalTier: s.approvalTier, timeToProduction: s.timeToProduction };
}

async function LibrarySection() {
  const curated = new Map(listCuratedGuides().map((g) => [g.slug, summarize(g)]));
  const generated = await listGeneratedGuides();
  const generatedBySlug = new Map(generated.map((g) => [g.slug, g]));

  const entries: LibraryEntry[] = catalog.map((app) => {
    const c = app.guideSlug ? curated.get(app.guideSlug) : undefined;
    const gen = generatedBySlug.get(app.slug);
    return { ...app, guide: c ? toGuideRef(c) : gen ? toGuideRef(gen) : null };
  });
  const catalogSlugs = new Set(catalog.map((a) => a.slug));
  for (const g of generated) {
    if (catalogSlugs.has(g.slug) || curated.has(g.slug)) continue;
    entries.push({
      slug: g.slug,
      name: g.name,
      category: g.category,
      website: "",
      composioSlug: "",
      composioManaged: false,
      guideSlug: null,
      guide: toGuideRef(g),
    });
  }
  return <Library entries={entries} />;
}

export default function Home() {
  const curated = listCuratedGuides().sort((a, b) => a.verdict.difficulty - b.verdict.difficulty);

  return (
    <div>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm font-medium text-indigo-700">For developers building AI agents</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900">
            Know what it takes to get your OAuth app approved before you start.
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Creating the app takes minutes. The slow, unpredictable part is what comes after: verification, app review, security
            assessments and partner programs. Each guide tells you how long it takes, what can block you, and which steps an agent can do
            for you.
          </p>
          <div className="mt-6 max-w-2xl">
            <SubmitBox curatedSlugs={curated.map((g) => g.slug)} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Same OAuth spec, very different paths to production</h2>
        <p className="mt-1 text-sm text-slate-500">
          Human-verified guides, ordered from easiest to hardest to get approved.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {curated.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{g.app.name}</span>
                  <DifficultyMeter value={g.verdict.difficulty} size="sm" />
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-slate-600">{g.verdict.headline}</p>
                <div className="mt-auto pt-3">
                  <TierBadge tier={g.verdict.approvalTier} className="text-[11px]" />
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-500">First connection</dt>
                      <dd className="font-medium text-slate-800">{g.verdict.timeToFirstConnectionShort}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Any user</dt>
                      <dd className="font-medium text-slate-800">{g.verdict.timeToProductionShort}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/generate?q=Pipedrive"
              className="flex h-full flex-col justify-center rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-4 text-sm text-indigo-900 hover:bg-indigo-50"
            >
              <span className="font-semibold">Any other app →</span>
              <span className="mt-1 text-indigo-800/80">
                Three research agents read the docs, a writer turns their notes into a guide, and a checker re-reads the cited pages before
                it is published.
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <section id="library" className="mx-auto max-w-6xl scroll-mt-4 px-4 pb-16">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Library: 100 apps that support OAuth</h2>
        <p className="mt-1 text-sm text-slate-500">
          Taken from Composio&apos;s OAuth toolkit directory. Apps without a guide are researched on demand, and the result is saved for the
          next developer.
        </p>
        <div className="mt-4">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-slate-100" />}>
            <LibrarySection />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
