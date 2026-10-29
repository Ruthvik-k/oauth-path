import { CONFIDENCE_LABEL, DIFFICULTY_LABEL, OWNER_LABEL, TIER_LABEL, type Guide } from "./guide-schema";

const cite = (ids: string[]) => (ids.length ? ` [${ids.join(", ")}]` : "");

/** Plain Markdown export so a guide can be pasted into a ticket, a doc, or another agent's context. */
export function guideToMarkdown(g: Guide, url?: string): string {
  const L: string[] = [];
  const v = g.verdict;
  L.push(`# ${g.app.name}: OAuth app setup & approval guide`, "");
  L.push(
    `> ${g.origin === "curated" ? "Human-verified guide" : "Agent-generated guide"} · last checked ${g.lastCheckedAt.slice(0, 10)}${url ? ` · ${url}` : ""}`,
    "",
  );
  L.push(`**${v.headline}**`, "");
  L.push(`| | |`, `|---|---|`);
  L.push(`| Difficulty | ${v.difficulty}/5 (${DIFFICULTY_LABEL[v.difficulty]}) |`);
  L.push(`| Approval path | ${TIER_LABEL[v.approvalTier]} |`);
  L.push(`| First working connection | **${v.timeToFirstConnectionShort}**: ${v.timeToFirstConnection} |`);
  L.push(`| Production (any user) | **${v.timeToProductionShort}**: ${v.timeToProduction} |`);
  L.push(`| Hands-on effort | ${v.handsOnEffort} |`);
  L.push(`| Cost | ${v.cost} |`);
  L.push(`| Biggest risk | ${v.biggestRisk} |`, "");

  L.push(`## Do you need your own OAuth app?`, "", g.ownAppDecision.summary, "");
  g.ownAppDecision.reasons.forEach((r) => L.push(`- ${r}`));
  L.push("", `Composio: ${g.composio.note}`, "");

  L.push(`## Step by step`, "");
  for (const phase of g.phases) {
    L.push(`### ${phase.name} (${phase.duration})`, "", `_Goal: ${phase.goal}_`, "");
    for (const s of phase.steps) {
      L.push(`- [ ] **${s.title}** (${OWNER_LABEL[s.owner]}, ${s.time}, ${CONFIDENCE_LABEL[s.confidence]})${cite(s.sourceIds)}`);
      L.push(`  ${s.detail}`);
      if (s.agentHelp) L.push(`  _Agent can help:_ ${s.agentHelp}`);
    }
    L.push("");
  }

  L.push(`## What an agent can do vs. what you must do`, "", `**Agent can:**`);
  g.agentVsYou.agentCan.forEach((x) => L.push(`- ${x}`));
  L.push("", `**You must:**`);
  g.agentVsYou.youMust.forEach((x) => L.push(`- ${x}`));
  L.push("");

  if (g.requirements.length) {
    L.push(`## Requirements`, "", `| Requirement | Needed for | Detail | Evidence |`, `|---|---|---|---|`);
    g.requirements.forEach((r) =>
      L.push(`| ${r.item} | ${r.neededFor.replace("_", " ")} | ${r.detail.replace(/\|/g, "/")} | ${CONFIDENCE_LABEL[r.confidence]}${cite(r.sourceIds)} |`),
    );
    L.push("");
  }
  if (g.permissions.length) {
    L.push(`## Permissions / scopes`, "", `| Scope | Tier | Use | Notes |`, `|---|---|---|---|`);
    g.permissions.forEach((p) =>
      L.push(`| \`${p.name}\` | ${p.tier.replace("_", " ")} | ${p.purpose} | ${p.notes.replace(/\|/g, "/")}${cite(p.sourceIds)} |`),
    );
    L.push("");
  }
  if (g.nuances.length) {
    L.push(`## Nuances that affect your setup`, "");
    g.nuances.forEach((n) => L.push(`- **${n.title}** (${n.impact} impact, ${CONFIDENCE_LABEL[n.confidence]})${cite(n.sourceIds)}: ${n.detail}`));
    L.push("");
  }
  if (g.blockers.length) {
    L.push(`## If you get blocked`, "");
    g.blockers.forEach((b) => {
      L.push(`- **${b.blocker}**${cite(b.sourceIds)}`, `  - You'll see: ${b.symptom}`, `  - What to do: ${b.howToProceed}`);
    });
    L.push("");
  }
  if (g.drafts.length) {
    L.push(`## Drafts you can adapt`, "");
    g.drafts.forEach((d) => L.push(`### ${d.title}`, "", `_${d.purpose}_`, "", "```text", d.content, "```", ""));
  }

  L.push(`## Evidence`, "", g.verification.summary, "");
  if (g.verification.setupAttempts.length) {
    L.push(`### Setup attempts`);
    g.verification.setupAttempts.forEach((a) => {
      L.push(`- ${a.date}, ${a.by}: ${a.goal} (**${a.outcome}**)`);
      a.findings.forEach((f) => L.push(`  - ${f}`));
    });
    L.push("");
  }
  if (g.verification.corrections.length) {
    L.push(`### Corrections made during verification`);
    g.verification.corrections.forEach((c) => L.push(`- Was: ${c.original}`, `  Now: ${c.corrected} (${c.how})`));
    L.push("");
  }
  if (g.verification.probes.length) {
    L.push(`### Automated probes`);
    g.verification.probes.forEach((p) => L.push(`- ${p.ok ? "✅" : "⚠️"} ${p.name}: ${p.result}`));
    L.push("");
  }
  if (g.openQuestions.length) {
    L.push(`### Open questions`);
    g.openQuestions.forEach((q) => L.push(`- ${q}`));
    L.push("");
  }
  L.push(`### Sources`);
  g.sources.forEach((s) => L.push(`- [${s.id}] ${s.title} (${s.kind}): ${s.url}`));
  return L.join("\n") + "\n";
}
