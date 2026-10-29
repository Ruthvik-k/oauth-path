import type { Metadata } from "next";
import Link from "next/link";
import { DifficultyMeter, TierBadge, cx } from "@/components/ui";
import { listCuratedGuides } from "@/lib/store";
import { verificationLog } from "@/lib/verification";

export const metadata: Metadata = { title: "Verification report" };

const OUTCOME_STYLE: Record<string, string> = {
  succeeded: "bg-emerald-100 text-emerald-800",
  partially: "bg-amber-100 text-amber-800",
  blocked: "bg-rose-100 text-rose-800",
  not_attempted: "bg-slate-100 text-slate-600",
};

export default function VerificationPage() {
  const guides = listCuratedGuides().sort((a, b) => a.verdict.difficulty - b.verdict.difficulty);
  const log = verificationLog;
  const totals = guides.reduce(
    (acc, g) => {
      acc.official += g.sources.filter((s) => s.kind === "official").length;
      acc.community += g.sources.filter((s) => s.kind === "community").length;
      acc.attempts += g.verification.setupAttempts.filter((a) => a.outcome !== "not_attempted").length;
      acc.corrections += g.verification.corrections.length;
      acc.claims += g.verification.claimChecks.length;
      acc.open += g.openQuestions.length;
      return acc;
    },
    { official: 0, community: 0, attempts: 0, corrections: 0, claims: 0, open: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Verification report</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        What we tested by hand, what sources support, what the agent got wrong, and what is still uncertain. Every guide uses the same
        evidence labels:{" "}
        <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-medium text-white">Tested</span>{" "}
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800">Official docs</span>{" "}
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">Community-reported</span>{" "}
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700">Inferred</span>
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Curated guides", guides.length],
          ["Official sources", totals.official],
          ["Community sources", totals.community],
          ["Hands-on attempts", totals.attempts],
          ["Corrections made", totals.corrections + log.comparisons.reduce((n, c) => n + c.wrong.length, 0)],
          ["Open questions", totals.open],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-2xl font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">How each guide is checked</h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            [
              "1. Sourced and quoted",
              "Research agents collect facts with the exact URL and a verbatim quote. A claim with no source is shown as Inferred. Source URLs the agent did not actually see during research are removed automatically.",
            ],
            [
              "2. Probed and re-read",
              "Code probes the live OAuth endpoint with a fake client_id, looks for OAuth/OIDC discovery metadata, and checks every cited link. A fact-checker re-reads the cited page for each key claim and downgrades claims the page doesn't support.",
            ],
            [
              "3. Tried by a human",
              "For curated guides, a person registers a real app with free accounts, goes as far as possible without a paid plan or real review, and records what differed from the docs.",
            ],
          ].map(([t, d]) => (
            <li key={t} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="font-medium text-slate-900">{t}</div>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Curated guides: evidence at a glance</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">App</th>
                <th className="px-3 py-2">Verdict</th>
                <th className="px-3 py-2">Hands-on attempt</th>
                <th className="px-3 py-2">Sources (official / community)</th>
                <th className="px-3 py-2">Probes passed</th>
                <th className="px-3 py-2">Open questions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guides.map((g) => {
                const attempt = g.verification.setupAttempts[0];
                return (
                  <tr key={g.slug} className="align-top">
                    <td className="px-3 py-2">
                      <Link href={`/guides/${g.slug}#evidence`} className="font-medium text-indigo-700 hover:underline">
                        {g.app.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <DifficultyMeter value={g.verdict.difficulty} size="sm" />
                        <TierBadge tier={g.verdict.approvalTier} className="w-fit text-[11px]" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {attempt ? (
                        <div>
                          <span className={cx("rounded px-1.5 py-0.5 text-xs font-medium", OUTCOME_STYLE[attempt.outcome])}>
                            {attempt.outcome.replace("_", " ")}
                          </span>
                          <div className="mt-1 text-xs text-slate-500">
                            {attempt.date}, {attempt.findings.length} findings
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Docs only, not tried hands-on</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {g.sources.filter((s) => s.kind === "official").length} / {g.sources.filter((s) => s.kind === "community").length}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {g.verification.probes.length ? `${g.verification.probes.filter((p) => p.ok).length}/${g.verification.probes.length}` : "–"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{g.openQuestions.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {log.comparisons.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Agent alone vs. human-verified</h2>
          <p className="mt-1 text-sm text-slate-500">
            We ran the live agent on the curated apps with no help and compared its guide with the verified one. This shows how far to
            trust an agent-generated guide for an app nobody has checked.
          </p>
          <div className="mt-3 space-y-3">
            {log.comparisons.map((c) => (
              <div key={c.slug} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/guides/${c.slug}`} className="font-medium text-indigo-700 hover:underline">
                    {c.app}
                  </Link>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                    <span>
                      Agent: {c.agent.difficulty}/5 · {c.agent.approvalTier.replace(/_/g, " ")} · {c.agent.timeToProduction}
                    </span>
                    <span>
                      Verified: {c.curated.difficulty}/5 · {c.curated.approvalTier.replace(/_/g, " ")} · {c.curated.timeToProduction}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                  {(
                    [
                      ["Agent got right", c.agreed, "text-emerald-700"],
                      ["Agent missed", c.missed, "text-amber-700"],
                      ["Agent got wrong", c.wrong, "text-rose-700"],
                    ] as const
                  ).map(([label, items, color]) => (
                    <div key={label}>
                      <div className={cx("text-xs font-semibold uppercase", color)}>{label}</div>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                        {items.length ? items.map((x, i) => <li key={i}>{x}</li>) : <li className="list-none text-slate-400">Nothing</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(log.learnings.length > 0 || guides.some((g) => g.verification.corrections.length)) && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">What we learned and corrected</h2>
          <ul className="mt-3 space-y-2">
            {log.learnings.map((l, i) => (
              <li key={i} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="font-medium text-slate-900">{l.title}</div>
                <p className="mt-0.5 text-slate-700">{l.detail}</p>
              </li>
            ))}
            {guides.flatMap((g) =>
              g.verification.corrections.map((c, i) => (
                <li key={`${g.slug}-${i}`} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <div className="text-xs font-medium text-slate-500">{g.app.name}</div>
                  <p className="text-slate-500 line-through decoration-rose-400">{c.original}</p>
                  <p className="mt-0.5 text-slate-900">{c.corrected}</p>
                  <p className="mt-0.5 text-xs text-slate-500">How we found out: {c.how}</p>
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">What remains uncertain</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {guides
            .filter((g) => g.openQuestions.length)
            .map((g) => (
              <div key={g.slug} className="rounded-lg border border-slate-200 bg-white p-3">
                <Link href={`/guides/${g.slug}#evidence`} className="text-sm font-medium text-indigo-700 hover:underline">
                  {g.app.name}
                </Link>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-slate-700">
                  {g.openQuestions.slice(0, 4).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                  {g.openQuestions.length > 4 && <li className="list-none text-xs text-slate-500">+{g.openQuestions.length - 4} more in the guide</li>}
                </ul>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
