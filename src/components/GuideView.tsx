import Link from "next/link";
import { Checklist } from "./Checklist";
import { CopyButton, ShareBar } from "./CopyButton";
import { ConfidenceBadge, DifficultyMeter, OriginBadge, Section, SourceChips, TierBadge, cx } from "./ui";
import { guideToMarkdown } from "@/lib/markdown";
import type { Guide } from "@/lib/guide-schema";

const IMPACT_STYLE = { high: "bg-rose-100 text-rose-800", medium: "bg-amber-100 text-amber-800", low: "bg-slate-100 text-slate-700" };
const TIER_PERM_STYLE: Record<string, string> = {
  basic: "bg-emerald-50 text-emerald-800",
  sensitive: "bg-amber-50 text-amber-800",
  restricted: "bg-rose-50 text-rose-800",
  admin_consent: "bg-orange-50 text-orange-800",
  partner_only: "bg-rose-100 text-rose-900",
};
const VERDICT_STYLE = {
  supported: "text-emerald-700",
  partially_supported: "text-amber-700",
  not_supported: "text-rose-700",
  unreachable: "text-slate-500",
};

const TOC = [
  ["verdict", "At a glance"],
  ["own-app", "Do you need your own app?"],
  ["path", "Step by step"],
  ["agent-vs-you", "Agent vs. you"],
  ["requirements", "Requirements"],
  ["permissions", "Permissions"],
  ["nuances", "Nuances"],
  ["blockers", "If you get blocked"],
  ["drafts", "Drafts"],
  ["evidence", "Evidence"],
];

export function GuideView({ guide: g }: { guide: Guide }) {
  const v = g.verdict;
  const markdown = guideToMarkdown(g);
  const nuances = [...g.nuances].sort((a, b) => ["high", "medium", "low"].indexOf(a.impact) - ["high", "medium", "low"].indexOf(b.impact));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/#library" className="hover:text-slate-800">
              Library
            </Link>
            <span>/</span>
            <span>{g.app.category}</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{g.app.name} OAuth app: setup &amp; approval</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <OriginBadge origin={g.origin} />
            <span>Last checked {g.lastCheckedAt.slice(0, 10)}</span>
            {g.app.developerPortalUrl && (
              <a href={g.app.developerPortalUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                Developer portal ↗
              </a>
            )}
            {g.app.docsUrl && (
              <a href={g.app.docsUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                OAuth docs ↗
              </a>
            )}
          </div>
        </div>
        <ShareBar slug={g.slug} appName={g.app.name} markdown={markdown} origin={g.origin} />
      </div>

      {g.origin === "generated" && (
        <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          An AI research agent wrote this guide from public sources on {g.createdAt.slice(0, 10)}. Before it was published, an automated
          check re-read the cited pages for the key claims and probed the live endpoints (see{" "}
          <a href="#evidence" className="underline">
            Evidence
          </a>
          ). No human has tried this setup yet, so check the evidence labels before you rely on it.
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav className="no-print hidden lg:block">
          <ul className="sticky top-6 space-y-1 text-sm">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-10">
          {/* Verdict */}
          <section id="verdict" className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-medium text-slate-900">{v.headline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <DifficultyMeter value={v.difficulty} />
              <TierBadge tier={v.approvalTier} />
            </div>
            <dl className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                ["First working connection", v.timeToFirstConnectionShort, v.timeToFirstConnection],
                ["Ready for any user", v.timeToProductionShort, v.timeToProduction],
                ["Hands-on effort", null, v.handsOnEffort],
                ["Cost", null, v.cost],
              ].map(([label, short, detail]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                  {short && <dd className="mt-1 text-lg font-semibold text-slate-900">{short}</dd>}
                  <dd className="mt-1 text-sm text-slate-700">{detail}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              <span className="font-semibold">Biggest risk:</span> {v.biggestRisk}
            </div>
          </section>

          <Section id="own-app" title="Do you need your own OAuth app?">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-800">{g.ownAppDecision.summary}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {g.ownAppDecision.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p
                className={cx(
                  "mt-3 rounded-md px-3 py-2 text-sm",
                  g.composio.managed ? "bg-emerald-50 text-emerald-900" : "bg-slate-100 text-slate-800",
                )}
              >
                <span className="font-medium">Composio:</span> {g.composio.note}
              </p>
            </div>
          </Section>

          <Section
            id="path"
            title="Step by step"
            subtitle="Check off steps as you go. Progress is saved in this browser. 🤖 = an agent can do it, 👤 = you must, ⏳ = waiting on the provider."
          >
            <Checklist slug={g.slug} phases={g.phases} sources={g.sources} />
          </Section>

          <Section id="agent-vs-you" title="What an agent can do vs. where you take over">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
                <h3 className="font-medium text-violet-900">🤖 An agent can</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-violet-950">
                  {g.agentVsYou.agentCan.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-300 bg-white p-4">
                <h3 className="font-medium text-slate-900">👤 You must</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                  {g.agentVsYou.youMust.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {g.requirements.length > 0 && (
            <Section id="requirements" title="Requirements" subtitle="What the provider asks for, and when.">
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Requirement</th>
                      <th className="px-3 py-2">Needed for</th>
                      <th className="px-3 py-2">Detail</th>
                      <th className="px-3 py-2">Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {g.requirements.map((r, i) => (
                      <tr key={i} className="align-top">
                        <td className="px-3 py-2 font-medium text-slate-900">{r.item}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.neededFor.replace("_", " ")}</td>
                        <td className="px-3 py-2 text-slate-700">{r.detail}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <ConfidenceBadge value={r.confidence} />
                            <SourceChips ids={r.sourceIds} sources={g.sources} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {g.permissions.length > 0 && (
            <Section id="permissions" title="Permissions an agent typically needs" subtitle="The scopes you request set how much review you face.">
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Scope</th>
                      <th className="px-3 py-2">Tier</th>
                      <th className="px-3 py-2">Used for</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {g.permissions.map((p, i) => (
                      <tr key={i} className="align-top">
                        <td className="px-3 py-2 font-mono text-xs text-slate-900">{p.name}</td>
                        <td className="px-3 py-2">
                          <span className={cx("whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium", TIER_PERM_STYLE[p.tier])}>
                            {p.tier.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{p.purpose}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {p.notes}
                          <div className="mt-1 flex flex-wrap gap-1">
                            <ConfidenceBadge value={p.confidence} />
                            <SourceChips ids={p.sourceIds} sources={g.sources} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {nuances.length > 0 && (
            <Section id="nuances" title="Nuances that could affect your setup">
              <ul className="space-y-2">
                {nuances.map((n, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase", IMPACT_STYLE[n.impact])}>{n.impact}</span>
                      <span className="font-medium text-slate-900">{n.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{n.detail}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <ConfidenceBadge value={n.confidence} />
                      <SourceChips ids={n.sourceIds} sources={g.sources} />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {g.blockers.length > 0 && (
            <Section id="blockers" title="If you get blocked" subtitle="What you'll see, and how to get unstuck.">
              <ul className="space-y-2">
                {g.blockers.map((b, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="font-medium text-slate-900">{b.blocker}</div>
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-medium text-slate-700">You&apos;ll see:</span> {b.symptom}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">
                      <span className="font-medium text-emerald-700">What to do:</span> {b.howToProceed}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <ConfidenceBadge value={b.confidence} />
                      <SourceChips ids={b.sourceIds} sources={g.sources} />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {g.drafts.length > 0 && (
            <Section id="drafts" title="Drafts you can adapt" subtitle="Starting text an agent wrote for the slow, wordy parts of the process.">
              <div className="space-y-3">
                {g.drafts.map((d, i) => (
                  <details key={i} className="group rounded-lg border border-slate-200 bg-white" open={i === 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
                      <span>
                        <span className="font-medium text-slate-900">{d.title}</span>
                        <span className="ml-2 text-sm text-slate-500">{d.purpose}</span>
                      </span>
                      <span className="text-slate-400 group-open:rotate-90">›</span>
                    </summary>
                    <div className="border-t border-slate-100 px-4 py-3">
                      <div className="mb-2 flex justify-end">
                        <CopyButton text={d.content} />
                      </div>
                      <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800">{d.content}</pre>
                    </div>
                  </details>
                ))}
              </div>
            </Section>
          )}

          <Section id="evidence" title="Evidence: what we tested, what sources say, what's uncertain">
            <div className="space-y-4">
              <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">{g.verification.summary}</p>

              {g.verification.setupAttempts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Hands-on setup attempts</h3>
                  <ul className="mt-2 space-y-2">
                    {g.verification.setupAttempts.map((a, i) => (
                      <li key={i} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{a.goal}</span>
                          <span className="rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{a.outcome}</span>
                          <span className="text-xs text-slate-500">
                            {a.date} · {a.by}
                          </span>
                        </div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                          {a.findings.map((f, j) => (
                            <li key={j}>{f}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {g.verification.corrections.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Corrections made during verification</h3>
                  <ul className="mt-2 space-y-2">
                    {g.verification.corrections.map((c, i) => (
                      <li key={i} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <p className="text-slate-500 line-through decoration-rose-400">{c.original}</p>
                        <p className="mt-1 text-slate-900">{c.corrected}</p>
                        <p className="mt-1 text-xs text-slate-500">How we found out: {c.how}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {g.verification.probes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Automated probes (no account needed)</h3>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
                    {g.verification.probes.map((p, i) => (
                      <li key={i} className="flex gap-2 px-3 py-2">
                        <span>{p.ok ? "✅" : "⚠️"}</span>
                        <div className="min-w-0">
                          <span className="font-medium text-slate-900">{p.name}</span>
                          <span className="ml-2 break-all text-xs text-slate-400">{p.target}</span>
                          <p className="text-slate-700">{p.result}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {g.verification.claimChecks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Fact-check: key claims re-read against their sources</h3>
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
                    {g.verification.claimChecks.map((c, i) => (
                      <li key={i} className="px-3 py-2">
                        <span className={cx("font-medium", VERDICT_STYLE[c.verdict])}>{c.verdict.replace("_", " ")}</span>
                        <span className="text-slate-800">: {c.claim}</span>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {c.evidence}
                          {c.sourceUrl && (
                            <>
                              {" "}
                              <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                                source ↗
                              </a>
                            </>
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {g.openQuestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Still uncertain</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {g.openQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-slate-900">Sources</h3>
                <ol className="mt-2 space-y-1 text-sm">
                  {g.sources.map((s) => (
                    <li key={s.id} className="flex gap-2">
                      <span className="w-8 shrink-0 text-slate-400">{s.id}</span>
                      <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 break-words text-indigo-700 hover:underline">
                        {s.title}
                      </a>
                      <span
                        className={cx(
                          "shrink-0 rounded px-1 text-[11px]",
                          s.kind === "official" ? "bg-sky-100 text-sky-800" : s.kind === "composio" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800",
                        )}
                      >
                        {s.kind}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
