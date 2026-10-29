# OAuth Path

**Know what it takes to get your OAuth app approved before you start.**

Developers building AI agents need their users to connect apps like Gmail, Slack or Zoom. In production that usually means registering their *own* OAuth app with each provider and getting it approved. Creating the app takes minutes. The slow, unpredictable part comes after: verification, app review, security assessments, partner programs, admin consent, and the limits that apply until you pass.

OAuth Path gives a developer a shareable guide per app that answers:

- **How hard is this?** Difficulty from 1 to 5, plus an approval tier: self-serve, works now but limited until reviewed, review required, or partner-gated.
- **How long will it take?** Time to the first working connection and time until any user can connect, with provider waits kept separate from hands-on effort.
- **What could block me?** Requirements, scope tiers, nuances, and the exact symptoms of common blockers with how to proceed.
- **What can an agent do, and where do I take over?** Every step is marked as something an agent can do, something you do, or a wait on the provider. Each guide includes agent-drafted text for the slow parts: scope justifications, reviewer notes, demo scripts, admin-consent emails.
- **How sure are we?** Every claim carries an evidence label (Tested, Official docs, Community-reported, Inferred) and links to its source. Each guide shows its probes, fact-checks and open questions.

Live demo: _<add Vercel URL>_ · Verification report: `/verification`

## What's in the box

| | |
|---|---|
| **Library of 100 OAuth apps** | Taken from Composio's OAuth toolkit directory, with each app's managed vs. bring-your-own status. |
| **7 curated guides** (human-verified) | GitHub, Slack, Google Workspace (Gmail), Meta (Facebook & Instagram), LinkedIn, Microsoft 365 (Outlook & Teams), Zoom. Chosen to cover every approval tier. |
| **Live generation** | Submit any app name or website. An agent pipeline researches it and publishes a guide in about 2–3 minutes while you watch each step. |
| **Shareable output** | Permanent URL, Markdown export (`/guides/<slug>/markdown`), copy-as-Markdown for pasting into another agent's context, and a print/PDF layout. A per-browser checklist tracks progress and shows the next step. |

## How the agent works

```
query ──► resolve (library match or web lookup + Composio managed-auth status)
      ──► research ×3 in parallel (OpenAI Responses API + web_search)
            registration & build │ approval & go-live │ permissions & pitfalls
      ──► write (structured output against a Zod schema; may cite only URLs the researchers actually saw)
      ──► probe (deterministic code)        ┐ in parallel
      ──► fact-check (separate model)       ┘
      ──► publish (shareable URL; Vercel Blob or local disk)
```

- **Evidence hygiene in code, not prompts.** After writing, any source URL that never appeared in the research is removed, dangling citations are stripped, and claims left without support become *Inferred*. An agent-written guide can never say *Tested*.
- **Probes need no account.** They call the documented authorize endpoint with a fake `client_id` to confirm it's live and rejects unknown clients, look for OAuth/OIDC discovery metadata (and PKCE support), and check the developer portal and every cited link.
- **Fact-check.** For the 6 claims a developer would act on (production requirements, high-impact nuances, go-live steps, gated scopes), a second model re-reads the cited page. Unsupported claims are downgraded and added to "Still uncertain".
- The UI streams every search, page read, probe and verdict as it happens (NDJSON over a single POST).

## Key decisions

1. **Lead with the approval path, not the credential form.** Composio's existing guides already cover clicking through a console to get a client ID. Developers get stuck on verification, review, CASA assessments, business verification, partner programs and admin consent. Every guide puts difficulty, tier and time to production at the top.
2. **One structure for every provider.** A fixed schema (summary, phases, owners, requirements, scopes, nuances, blockers, drafts, evidence) makes guides comparable, renderable, exportable, and checkable by code.
3. **The agent works in a fixed pipeline, not a free loop.** Three narrow researchers, one writer, deterministic probes and an independent checker are more predictable and auditable than one long agent loop, and fast enough to watch live.
4. **Honest evidence labels over confident prose.** Community timelines are labelled as anecdotes, conflicting docs are called out, and "Inferred" is the default when nothing supports a claim.
5. **The library grows by itself.** Every live generation is saved and appears in the library for the next developer. Re-running the agent refreshes a guide.
6. **Curated guides cover the full spectrum on purpose:** GitHub (self-serve) → Slack and Microsoft (limited until review or admin consent) → Google, Meta and Zoom (formal review) → LinkedIn (partner-gated).

## Verification

See `/verification` in the app and [`docs/manual-verification-checklist.md`](docs/manual-verification-checklist.md).

- Curated guides were built from evidence packs: facts with URLs and verbatim quotes, written by research agents and reviewed against the quoted text.
- Live probes ran against every curated provider (authorize endpoint, discovery, portal, all cited links).
- The live agent was run alone on curated apps and compared with the verified guides (agreed / missed / wrong).
- Hands-on setup attempts with free accounts are recorded in each guide's Evidence section.

## Run locally

Requirements: Node.js 20.9+ (tested on 26).

```bash
npm install
cp .env.example .env.local      # then set OPENAI_API_KEY
npm run dev                     # http://localhost:3000
```

Without `OPENAI_API_KEY` everything except live generation works.

Useful scripts:

```bash
npm run validate                          # schema + citation-integrity checks for curated guides
npm run agent -- seed "Notion" "Xero"     # pre-generate agent guides that ship with the app
npm run agent -- baseline "GitHub"        # run the agent alone on a curated app to compare
npx tsx scripts/probe-curated.ts          # re-run live probes for curated guides
npm run registry                          # rebuild guide registries after adding JSON files
```

Environment variables (see `.env.example`): `OPENAI_API_KEY` (required for generation), `OPENAI_MODEL` / `OPENAI_FAST_MODEL` (defaults `gpt-5.4` / `gpt-5.4-mini`), `BLOB_READ_WRITE_TOKEN` (durable storage on Vercel), `GENERATE_LIMIT_PER_HOUR`.

## Deploy (Vercel)

1. Import the repo in Vercel (framework: Next.js).
2. Add `OPENAI_API_KEY` under Settings → Environment Variables.
3. Storage → create a **Blob** store and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`, so generated guides persist and share across instances.
4. Deploy. The generate route sets `maxDuration = 300`.

## Project layout

```
src/app/                    pages: home/library, /guides/[slug], /generate, /verification, /about, /api/generate
src/components/             GuideView, Checklist, GenerateView, Library, badges
src/lib/guide-schema.ts     Zod schema shared by the agent (structured output), UI and validator
src/lib/agent/              pipeline, research, prompts, probes, fact-check
src/data/catalog.json       100-app library (from Composio's OAuth directory)
src/data/guides/            curated guides (JSON)
src/data/generated/         pre-generated agent guides (JSON)
scripts/                    agent CLI, validator, probes, registry
docs/                       manual verification checklist
```

## Limitations

- **Provider rules change.** Guides carry a "last checked" date. Curated guides need periodic re-verification; the probe script and agent baselines make that cheap but not automatic.
- **Hands-on attempts stop where free accounts stop.** We did not pay for a CASA assessment, pass Meta Business Verification, or get accepted into a LinkedIn partner program, so those steps rest on official docs and labelled community reports.
- **Agent guides are only as good as public docs.** JavaScript-heavy or bot-blocking docs (some Meta and Zoom pages) can't be re-read by the fact-checker; those claims are marked as not re-readable.
- **Timelines are ranges, not promises.** Community-reported durations are anecdotes and are labelled that way.
- **Abuse protection is minimal:** a per-instance, in-memory rate limit on live generation, and reruns are cached by slug. A production version would add auth, a durable rate limit and a job queue.
- **No credentials are stored** and the app never asks for provider secrets.
