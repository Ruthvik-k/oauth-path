import type { ClaimCheck, ProbeResult } from "../guide-schema";

export type StageId = "resolve" | "research" | "synthesize" | "probe" | "verify" | "publish";

export const STAGES: { id: StageId; label: string; description: string }[] = [
  { id: "resolve", label: "Identify the app", description: "Match the library or look the app up on the web" },
  { id: "research", label: "Research", description: "Three agents read official docs and developer reports in parallel" },
  { id: "synthesize", label: "Write the guide", description: "Turn notes into steps, requirements, risks and drafts" },
  { id: "probe", label: "Probe live endpoints", description: "Check the OAuth endpoint, discovery metadata, portal and source links" },
  { id: "verify", label: "Fact-check", description: "Re-read cited pages and downgrade claims they don't support" },
  { id: "publish", label: "Publish", description: "Save a shareable guide" },
];

export type AgentEvent =
  | { type: "stage"; stage: StageId; status: "start" | "done" | "error"; message?: string }
  | { type: "log"; stage: StageId; track?: string; message: string }
  | { type: "source"; url: string; title: string }
  | { type: "progress"; stage: StageId; message: string }
  | { type: "probe"; probe: ProbeResult }
  | { type: "claim"; check: ClaimCheck }
  | { type: "done"; slug: string; cached: boolean; name: string }
  | { type: "error"; message: string };

export type Emit = (event: AgentEvent) => void;
