import logData from "@/data/verification-log.json";
import type { ApprovalTier } from "./guide-schema";

type VerdictSnapshot = { difficulty: number; approvalTier: ApprovalTier; timeToProduction: string };

export type Comparison = {
  slug: string;
  app: string;
  agent: VerdictSnapshot;
  curated: VerdictSnapshot;
  agreed: string[];
  missed: string[];
  wrong: string[];
};

export type VerificationLog = {
  updatedAt: string;
  learnings: { title: string; detail: string }[];
  comparisons: Comparison[];
};

export const verificationLog = logData as VerificationLog;
