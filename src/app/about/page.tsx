import type { Metadata } from "next";
import Link from "next/link";
import { DifficultyMeter, TierBadge } from "@/components/ui";
import type { ApprovalTier } from "@/lib/guide-schema";

export const metadata: Metadata = { title: "How it works" };

const TIERS: { tier: ApprovalTier; meaning: string; example: string; href?: string }[] = [
  { tier: "self_serve", meaning: "Anyone can authorize as soon as you create the app. The provider doesn't review it.", example: "GitHub", href: "/guides/github" },
  {
    tier: "limited_until_review",
    meaning: "It works now, but with caps, warnings, lower rate limits, or only for some users until you pass a review or verification.",
    example: "Slack, Microsoft 365",
    href: "/guides/slack",
  },
  {
    tier: "review_required",
    meaning: "Real external users can't connect until the provider approves your app, sometimes with a security assessment.",
    example: "Google (Gmail), Meta, Zoom",
    href: "/guides/google-workspace",
  },
  {
    tier: "partner_gated",
    meaning: "The APIs that matter need acceptance into a partner program or a commercial agreement, and approval is not guaranteed.",
    example: "LinkedIn (company pages)",
    href: "/guides/linkedin",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-slate-800">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">How it works</h1>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">The problem</h2>
        <p>
          When your agent acts on a user&apos;s Gmail, Slack or HubSpot, the user clicks <em>Connect</em> and approves an{" "}
          <strong>OAuth app</strong>. That app is registered with the provider and identified by a client ID and secret. Its name is what
          users see on the consent screen. One OAuth app serves your whole integration. Each user who approves it becomes a{" "}
          <strong>connection</strong> with its own tokens.
        </p>
        <p>
          Platforms like Composio can lend you their own managed app, which is fine for prototypes. In production you usually want your
          own: your brand on the consent screen, the scopes you need, your own rate limits, and an app your customers&apos; IT teams can
          approve. Many providers have no managed option at all.
        </p>
        <p>
          Registering the app takes minutes. What developers can&apos;t predict is what comes after: verification, app review, security
          assessments, business checks, partner programs, admin consent, and the limits that apply until you pass. The same OAuth 2.0
          spec can mean ten minutes for one provider and three months for another.{" "}
          <strong>So every guide here leads with the approval path, not the credential form.</strong>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Approval tiers</h2>
        <ul className="mt-3 space-y-2">
          {TIERS.map((t) => (
            <li key={t.tier} className="rounded-lg border border-slate-200 bg-white p-3">
              <TierBadge tier={t.tier} />
              <p className="mt-1 text-sm">{t.meaning}</p>
              <p className="mt-1 text-xs text-slate-500">
                Example:{" "}
                {t.href ? (
                  <Link href={t.href} className="text-indigo-700 hover:underline">
                    {t.example}
                  </Link>
                ) : (
                  t.example
                )}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <div className="font-medium text-slate-900">Difficulty</div>
          <ul className="mt-2 space-y-1.5">
            {[
              [1, "Minutes, self-serve"],
              [2, "Easy, with a few gotchas"],
              [3, "Involved: some review, admin consent, or per-customer steps"],
              [4, "Formal review or verification, often weeks"],
              [5, "Partnership-gated, or near-impossible for a new developer"],
            ].map(([v, d]) => (
              <li key={v} className="flex items-center gap-3">
                <DifficultyMeter value={v as number} size="sm" />
                <span className="text-slate-600">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">How the agent builds a guide</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            <strong>Identify.</strong> Match the 100-app library, or search the web to find the product, its website, and whether it offers
            OAuth to third parties. Check Composio&apos;s directory for a managed app.
          </li>
          <li>
            <strong>Research (3 agents in parallel).</strong> One covers registration and build details, one covers approval and go-live,
            one covers permissions and pitfalls. They search, read official docs first, and must attach a URL to every fact.
          </li>
          <li>
            <strong>Write.</strong> A writer turns the notes into a fixed structure: summary, phases and steps, who does each step,
            requirements, scopes, nuances, blockers and drafts. It may only cite sources the researchers actually found. Anything else is
            removed or labelled Inferred.
          </li>
          <li>
            <strong>Probe.</strong> Code calls the live authorize endpoint with a fake client ID, looks for OAuth/OIDC discovery metadata,
            and checks the developer portal and every cited link.
          </li>
          <li>
            <strong>Fact-check.</strong> A separate model re-reads the cited page for the key claims a developer would act on.
            Unsupported claims are downgraded and listed under &ldquo;Still uncertain&rdquo;.
          </li>
          <li>
            <strong>Publish.</strong> The guide gets a permanent, shareable URL and a Markdown export, so the next developer gets it
            instantly.
          </li>
        </ol>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What an agent can and can&apos;t do in this process</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
            <div className="font-medium text-violet-900">🤖 Agents are good at</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-violet-950">
              <li>Finding and reading the right docs and policy pages</li>
              <li>Drafting scope justifications, review notes, demo scripts, and policy text</li>
              <li>Generating OAuth code and checking redirect URI and scope configuration</li>
              <li>Probing endpoints and checking that guidance is still current</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm">
            <div className="font-medium text-slate-900">👤 A human must</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Create accounts, pass phone, ID and business verification</li>
              <li>Accept legal terms and pay for assessments or plans</li>
              <li>Record demo videos and talk to reviewers</li>
              <li>Get customers&apos; admins to approve the app</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-10 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Limitations</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Provider rules change. Guides show a &ldquo;last checked&rdquo; date; re-run the agent for an agent guide to refresh it.</li>
          <li>Timelines from community reports are anecdotes, labelled as such, not commitments.</li>
          <li>Some provider docs are JavaScript-only or block bots. The fact-check marks those claims as not re-readable.</li>
          <li>Hands-on attempts go as far as free accounts allow. We did not complete paid reviews or security assessments.</li>
        </ul>
        <p className="pt-2 text-sm">
          See the <Link href="/verification" className="text-indigo-700 hover:underline">verification report</Link> for what we tested
          and corrected.
        </p>
      </section>
    </div>
  );
}
