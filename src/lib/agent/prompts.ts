export type ResolvedApp = {
  name: string;
  website: string;
  category: string;
  aliases: string[];
};

export type TrackId = "build" | "approval" | "nuances";

const today = () => new Date().toISOString().slice(0, 10);

export function researchSystemPrompt(app: ResolvedApp) {
  return `You are an OAuth integration researcher. A developer is building an AI agent product and needs to register THEIR OWN OAuth app with ${app.name} (${app.website}) so their end users can connect their ${app.name} accounts.

Use web search. Prefer the provider's official developer documentation, policy pages and changelogs. Use community sources (forums, Stack Overflow, GitHub issues, blogs) only for real-world timelines and pitfalls, and label them.
Today is ${today()}. Prefer current information and say when something changed recently.

Output concise factual bullet points. EVERY bullet must end with the supporting source URL in parentheses and a label [official] or [community]. If something is undocumented or unclear, write a bullet starting with "UNCLEAR:". Never invent URLs, numbers or timelines.`;
}

export const RESEARCH_TRACKS: { id: TrackId; label: string; prompt: (app: ResolvedApp) => string }[] = [
  {
    id: "build",
    label: "Registration & build",
    prompt: (app) => `Research how to REGISTER and BUILD with an OAuth app for ${app.name}:
- Does ${app.name} offer OAuth for third-party developers at all? If not, what auth is offered instead?
- Exact developer portal URL and where to create the OAuth app / client / integration; what the app type is called; app types to choose between.
- Prerequisites: developer account, paid plan, business/company account, sandbox, workspace/org, phone/identity verification.
- Required fields and redirect/callback URI rules (HTTPS, localhost, exact match, how many allowed).
- OAuth details: authorization endpoint URL, token endpoint, PKCE support, refresh tokens and token lifetimes, scope format.
- What works immediately in development/test mode, and who can authorize before any review (only your account, test users, user caps).
- Anything that forces per-customer apps or per-instance URLs (subdomains, regions).`,
  },
  {
    id: "approval",
    label: "Approval & go-live",
    prompt: (app) => `Research what it takes for a ${app.name} OAuth app to be usable by ANY external user in production:
- Is any review, verification, approval, certification, marketplace listing or partner program required? Mandatory or optional? For which scopes/permissions?
- Materials required: privacy policy, terms, domain verification, demo video/screencast, test account, business verification documents, security assessment/questionnaire, company details.
- Official stated timelines, and community-reported real-world timelines (label community).
- Costs: fees, paid API tiers, assessment costs.
- Limits before approval: user caps, rate limits, warnings shown to users, development-mode restrictions.
- Ongoing obligations: annual re-verification, data use checkups, recertification, token/secret expiry.
- Common rejection reasons and how developers get unstuck.`,
  },
  {
    id: "nuances",
    label: "Permissions & pitfalls",
    prompt: (app) => `Research permissions and pitfalls for an AI agent integrating with ${app.name} via OAuth:
- Scope/permission tiers: which scopes are basic vs sensitive/restricted vs need admin consent vs partner-only. Name the specific scopes an agent would typically need (read, write, send, etc.).
- Admin/organization approval that can block end users (workspace admins, tenant consent, org app restrictions) and the exact symptom users see.
- Rate limits or API restrictions that differ for unapproved, unlisted or free-tier apps.
- API terms/policies relevant to AI agents (data retention, using data to train models, automation restrictions).
- Common setup errors (e.g. redirect_uri mismatch, invalid scope) and fixes.
- Notable changes in 2024–2026 (deprecations, new review rules, new app platforms).`,
  },
];

export const RESOLVE_SYSTEM = `You identify which software product a developer means. Use web search if the name is ambiguous or unfamiliar. Return the canonical product name, its main website (https URL), a short category (e.g. CRM, Accounting, Social), other names it is known by (including the parent company's platform name if different), and whether the provider offers OAuth 2.0 for third-party developers. Set recognized=false only if you cannot identify a real product.`;

export function synthesisSystemPrompt() {
  return `You turn research notes into a practical, honest OAuth setup guide for developers building AI agents. The reader must decide whether and how to register their own OAuth app with the provider, how long it will take, what could block them, and what an AI agent can do for them.

Rules:
- Use ONLY facts in the research notes. Anything you add from reasoning must have confidence "inferred".
- sources: include only entries from the SOURCE LIST, reusing their exact id and url. Cite sourceIds on every step, requirement, permission, nuance and blocker.
- confidence: "official" when backed by an official provider source; "community" when only community sources support it; "inferred" for your own reasoning. Never use "tested".
- verdict.approvalTier: self_serve (anyone can authorize, no review), limited_until_review (works with warnings/caps/limited users until reviewed), review_required (real external users need a passed review/verification), partner_gated (key APIs need partner acceptance or a commercial agreement), no_public_oauth.
- verdict.difficulty: 1 = minutes, self-serve; 2 = easy with gotchas; 3 = involved, some review; 4 = formal review/verification; 5 = partnership-gated or near-impossible for a new developer.
- timeToFirstConnection / timeToProduction: give ranges and say what drives them. Separate waiting time from hands-on effort. If production time depends on the scopes requested, give the range for typical agent scopes and name the cheaper path.
- phases: ids prepare, build, go_live, maintain (omit maintain if nothing is ongoing). 2–6 steps each, in order.
- step.owner: "agent" when an AI agent with browser and code tools could do it end to end (draft policy text or scope justifications, generate code, validate redirect URI config, pre-fill forms for review); "you" when a human must act (account creation, identity/business verification, accepting legal terms, payments, recording a demo, admin approval); "provider" when waiting on the provider. Put agent assistance in agentHelp even for "you" steps.
- ownAppDecision: use the Composio managed-auth status provided.
- drafts: 2–3 ready-to-adapt texts that save real time for THIS provider (scope justification for reviewers, review submission notes, demo video script, email to the partner team, admin-consent request for a customer's IT team). Use [PLACEHOLDERS].
- openQuestions: what is unclear, conflicting or undocumented.
- Be concise: each detail at most 3 sentences. The guide must be skimmable and shareable.`;
}
