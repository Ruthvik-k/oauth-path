import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { ClaimCheck, Confidence, GuideContent } from "../guide-schema";
import type { Emit } from "./events";
import { FAST_MODEL, openai, reasoning } from "./openai";
import { fetchPageText, relevantExcerpt } from "./web";

type Candidate = {
  location: string;
  claim: string;
  sourceIds: string[];
  priority: number;
  setConfidence: (c: Confidence) => void;
};

const VerdictSchema = z.object({
  verdict: z.enum(["supported", "partially_supported", "not_supported"]),
  evidence: z.string().describe("A short verbatim quote from the page that supports or contradicts the claim, or why none exists"),
});

/** Picks the claims a developer would act on: production requirements, high-impact nuances, go-live steps, blockers. */
function pickClaims(content: GuideContent, max: number): Candidate[] {
  const out: Candidate[] = [];
  content.requirements.forEach((r, i) => {
    if (r.sourceIds.length && r.neededFor !== "development")
      out.push({ location: `requirements[${i}]`, claim: `${r.item}: ${r.detail}`, sourceIds: r.sourceIds, priority: 3, setConfidence: (c) => (r.confidence = c) });
  });
  content.nuances.forEach((n, i) => {
    if (n.sourceIds.length)
      out.push({ location: `nuances[${i}]`, claim: `${n.title}: ${n.detail}`, sourceIds: n.sourceIds, priority: n.impact === "high" ? 4 : 1, setConfidence: (c) => (n.confidence = c) });
  });
  content.phases.forEach((p, pi) =>
    p.steps.forEach((s, si) => {
      if (s.sourceIds.length && p.id === "go_live")
        out.push({ location: `phases[${pi}].steps[${si}]`, claim: `${s.title}: ${s.detail}`, sourceIds: s.sourceIds, priority: 3, setConfidence: (c) => (s.confidence = c) });
    }),
  );
  content.permissions.forEach((p, i) => {
    if (p.sourceIds.length && p.tier !== "basic")
      out.push({ location: `permissions[${i}]`, claim: `${p.name} is classified as ${p.tier}. ${p.notes}`, sourceIds: p.sourceIds, priority: 2, setConfidence: (c) => (p.confidence = c) });
  });
  content.blockers.forEach((b, i) => {
    if (b.sourceIds.length)
      out.push({ location: `blockers[${i}]`, claim: `${b.blocker}: ${b.symptom}`, sourceIds: b.sourceIds, priority: 1, setConfidence: (c) => (b.confidence = c) });
  });
  // Highest priority first, but spread across sections so one section can't dominate.
  out.sort((a, b) => b.priority - a.priority);
  const picked: Candidate[] = [];
  const perSection = new Map<string, number>();
  for (const c of out) {
    const section = c.location.split("[")[0];
    if ((perSection.get(section) ?? 0) >= 2) continue;
    perSection.set(section, (perSection.get(section) ?? 0) + 1);
    picked.push(c);
    if (picked.length >= max) break;
  }
  return picked;
}

async function checkOne(c: Candidate, urls: Map<string, string>): Promise<ClaimCheck> {
  for (const id of c.sourceIds) {
    const url = urls.get(id);
    if (!url) continue;
    const text = await fetchPageText(url);
    if (!text) continue;
    const res = await openai().responses.parse({
      model: FAST_MODEL,
      ...reasoning(FAST_MODEL, "low"),
      input: [
        {
          role: "system",
          content:
            "You are a strict fact-checker. Decide whether the PAGE EXCERPT supports the CLAIM. 'supported' = the page states it. 'partially_supported' = the page supports the core but not all details (numbers, timelines, scope). 'not_supported' = the page does not say this or contradicts it. Quote the page verbatim as evidence.",
        },
        { role: "user", content: `CLAIM: ${c.claim}\n\nPAGE URL: ${url}\nPAGE EXCERPT:\n${relevantExcerpt(text, c.claim)}` },
      ],
      text: { format: zodTextFormat(VerdictSchema, "verdict") },
    });
    const parsed = res.output_parsed;
    if (!parsed) continue;
    return { claim: c.claim, location: c.location, sourceUrl: url, verdict: parsed.verdict, evidence: parsed.evidence.slice(0, 400) };
  }
  return {
    claim: c.claim,
    location: c.location,
    sourceUrl: c.sourceIds.map((id) => urls.get(id)).find(Boolean) ?? null,
    verdict: "unreachable",
    evidence: "The cited page could not be fetched as text (blocked, JavaScript-only, or moved), so the claim relies on the research agent's reading.",
  };
}

/**
 * Re-reads cited pages for the most decision-relevant claims. Claims a page does not
 * support are downgraded to "inferred" and listed as open questions.
 */
export async function verifyClaims(content: GuideContent, emit: Emit, max = 6): Promise<ClaimCheck[]> {
  const urls = new Map(content.sources.map((s) => [s.id, s.url]));
  const candidates = pickClaims(content, max);
  const checks = await Promise.all(
    candidates.map(async (c) => {
      let check: ClaimCheck;
      try {
        check = await checkOne(c, urls);
      } catch (e) {
        check = { claim: c.claim, location: c.location, sourceUrl: null, verdict: "unreachable", evidence: `Check failed: ${(e as Error).message}` };
      }
      if (check.verdict === "not_supported") {
        c.setConfidence("inferred");
        content.openQuestions.push(`Not confirmed by its cited source: "${c.claim.slice(0, 160)}"`);
      }
      emit({ type: "claim", check });
      return check;
    }),
  );
  return checks;
}
