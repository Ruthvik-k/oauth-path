import { z } from "zod";

/**
 * Evidence labels shown on every claim.
 * tested    – we (a human or a probe) actually did it and observed the result
 * official  – stated in the provider's own docs / policy pages
 * community – reported by developers (forums, blogs, issue trackers)
 * inferred  – reasoned from indirect evidence; treat as a hypothesis
 */
export const Confidence = z.enum(["tested", "official", "community", "inferred"]);
export type Confidence = z.infer<typeof Confidence>;

/** Who does a step: an AI agent, the developer, or nobody (waiting on the provider). */
export const Owner = z.enum(["agent", "you", "provider"]);
export type Owner = z.infer<typeof Owner>;

export const ApprovalTier = z.enum([
  "self_serve",
  "limited_until_review",
  "review_required",
  "partner_gated",
  "no_public_oauth",
]);
export type ApprovalTier = z.infer<typeof ApprovalTier>;

const sourceIds = z
  .array(z.string())
  .describe('IDs from the sources array that directly support this item, e.g. ["s1","s4"]. Empty if unsupported.');

export const StepSchema = z.object({
  title: z.string().describe("Imperative, short: 'Create the OAuth app'"),
  detail: z.string().describe("Concrete instructions: where to click, what to enter, exact values that matter"),
  owner: Owner,
  agentHelp: z
    .string()
    .nullable()
    .describe("What an AI agent can concretely do for this step (draft text, validate config, generate code). Null if nothing."),
  time: z.string().describe("Hands-on time or wait, e.g. '5 min' or '3–5 business days (waiting)'"),
  sourceIds,
  confidence: Confidence,
});
export type Step = z.infer<typeof StepSchema>;

export const PhaseSchema = z.object({
  id: z.enum(["prepare", "build", "go_live", "maintain"]),
  name: z.string(),
  goal: z.string().describe("What is true when this phase is done"),
  duration: z.string(),
  steps: z.array(StepSchema),
});
export type Phase = z.infer<typeof PhaseSchema>;

export const RequirementSchema = z.object({
  item: z.string(),
  neededFor: z.enum(["development", "production", "specific_permissions"]),
  detail: z.string(),
  sourceIds,
  confidence: Confidence,
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const PermissionSchema = z.object({
  name: z.string().describe("Scope / permission name or group"),
  purpose: z.string().describe("What an agent would use it for"),
  tier: z.enum(["basic", "sensitive", "restricted", "admin_consent", "partner_only"]),
  notes: z.string(),
  sourceIds,
  confidence: Confidence,
});
export type Permission = z.infer<typeof PermissionSchema>;

export const NuanceSchema = z.object({
  title: z.string(),
  detail: z.string(),
  impact: z.enum(["high", "medium", "low"]),
  sourceIds,
  confidence: Confidence,
});
export type Nuance = z.infer<typeof NuanceSchema>;

export const BlockerSchema = z.object({
  blocker: z.string(),
  symptom: z.string().describe("What the developer or end user actually sees (error text, screen, email)"),
  howToProceed: z.string(),
  sourceIds,
  confidence: Confidence,
});
export type Blocker = z.infer<typeof BlockerSchema>;

export const DraftSchema = z.object({
  title: z.string(),
  purpose: z.string(),
  content: z.string().describe("Ready-to-adapt text with [PLACEHOLDERS] for app-specific details"),
});
export type Draft = z.infer<typeof DraftSchema>;

export const SourceSchema = z.object({
  id: z.string().describe("Short id like s1, s2"),
  title: z.string(),
  url: z.string(),
  kind: z.enum(["official", "community", "composio"]),
});
export type Source = z.infer<typeof SourceSchema>;

/** The part of a guide an agent (or a human curator) writes. */
export const GuideContentSchema = z.object({
  app: z.object({
    name: z.string(),
    website: z.string(),
    category: z.string(),
    developerPortalUrl: z.string().nullable(),
    docsUrl: z.string().nullable(),
    authorizationEndpoint: z
      .string()
      .nullable()
      .describe("OAuth 2.0 authorization endpoint URL if documented, else null"),
  }),
  verdict: z.object({
    headline: z.string().describe("One sentence a developer can repeat to their team"),
    difficulty: z
      .number()
      .int()
      .describe(
        "1 = minutes, self-serve; 2 = easy with a few gotchas; 3 = involved, some review; 4 = hard, formal review/verification; 5 = gated partnership or near-impossible for new devs",
      ),
    approvalTier: ApprovalTier,
    timeToFirstConnection: z.string().describe("Time until the developer's own account can connect in dev/test mode, and what drives it"),
    timeToFirstConnectionShort: z.string().describe("At most 5 words, e.g. '15–30 min'"),
    timeToProduction: z.string().describe("Time until arbitrary end users can connect, including provider waits, and what drives it"),
    timeToProductionShort: z.string().describe("At most 6 words, e.g. '4–8 weeks' or 'Same day; weeks for org approvals'"),
    handsOnEffort: z.string(),
    cost: z.string(),
    biggestRisk: z.string(),
  }),
  ownAppDecision: z.object({
    summary: z.string().describe("Do they need their own OAuth app at all, vs. a managed one?"),
    reasons: z.array(z.string()),
  }),
  phases: z.array(PhaseSchema),
  requirements: z.array(RequirementSchema),
  permissions: z.array(PermissionSchema),
  nuances: z.array(NuanceSchema),
  blockers: z.array(BlockerSchema),
  agentVsYou: z.object({
    agentCan: z.array(z.string()),
    youMust: z.array(z.string()),
  }),
  drafts: z.array(DraftSchema),
  openQuestions: z.array(z.string()).describe("Things that could not be verified or vary by case"),
  sources: z.array(SourceSchema),
});
export type GuideContent = z.infer<typeof GuideContentSchema>;

export type ProbeResult = {
  name: string;
  target: string;
  ok: boolean;
  result: string;
};

export type ClaimCheck = {
  claim: string;
  location: string;
  sourceUrl: string | null;
  verdict: "supported" | "partially_supported" | "not_supported" | "unreachable";
  evidence: string;
};

export type SetupAttempt = {
  date: string;
  by: string;
  goal: string;
  outcome: "succeeded" | "partially" | "blocked" | "not_attempted";
  findings: string[];
};

export type Correction = {
  original: string;
  corrected: string;
  how: string;
};

export type Guide = GuideContent & {
  slug: string;
  origin: "curated" | "generated";
  createdAt: string;
  lastCheckedAt: string;
  model: string | null;
  query: string | null;
  composio: {
    toolkitSlug: string | null;
    managed: boolean | null;
    note: string;
  };
  verification: {
    summary: string;
    probes: ProbeResult[];
    claimChecks: ClaimCheck[];
    setupAttempts: SetupAttempt[];
    corrections: Correction[];
  };
};

export const TIER_LABEL: Record<ApprovalTier, string> = {
  self_serve: "Self-serve, no provider review",
  limited_until_review: "Works now, limited until reviewed",
  review_required: "Provider review required for production",
  partner_gated: "Partner program / commercial gate",
  no_public_oauth: "No public OAuth for third parties",
};

export const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Easy",
  2: "Moderate",
  3: "Involved",
  4: "Hard",
  5: "Gated",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  tested: "Tested",
  official: "Official docs",
  community: "Community-reported",
  inferred: "Inferred",
};

export const OWNER_LABEL: Record<Owner, string> = {
  agent: "Agent can do",
  you: "You do",
  provider: "Waiting on provider",
};
