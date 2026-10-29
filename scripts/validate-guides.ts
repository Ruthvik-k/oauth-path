/**
 * Validates curated guide JSON files against the guide schema plus evidence-integrity rules.
 * Usage: npx tsx scripts/validate-guides.ts [file ...]   (defaults to all src/data/guides/*.json)
 */
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { GuideContentSchema } from "../src/lib/guide-schema";

const dir = path.join(__dirname, "..", "src", "data", "guides");
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(dir, f));

let failed = false;
for (const file of files) {
  const errors: string[] = [];
  const warnings: string[] = [];
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`✗ ${file}: invalid JSON: ${(e as Error).message}`);
    failed = true;
    continue;
  }
  const parsed = GuideContentSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 20)) errors.push(`${issue.path.join(".")}: ${issue.message}`);
  }
  for (const key of ["slug", "origin", "createdAt", "lastCheckedAt", "composio", "verification"]) {
    if (!(key in raw)) errors.push(`missing top-level field "${key}"`);
  }
  if (raw.origin !== "curated") errors.push(`origin must be "curated"`);
  if (`${raw.slug}.json` !== path.basename(file)) errors.push(`slug "${raw.slug}" does not match filename`);
  const verification = raw.verification as Record<string, unknown> | undefined;
  for (const key of ["summary", "probes", "claimChecks", "setupAttempts", "corrections"]) {
    if (verification && !(key in verification)) errors.push(`verification.${key} missing`);
  }

  if (parsed.success) {
    const g = parsed.data;
    const ids = new Set<string>();
    for (const s of g.sources) {
      if (ids.has(s.id)) errors.push(`duplicate source id ${s.id}`);
      ids.add(s.id);
      if (!/^https?:\/\//.test(s.url)) errors.push(`source ${s.id} has invalid url ${s.url}`);
    }
    const used = new Set<string>();
    const hasAttempts = Array.isArray(verification?.setupAttempts) && (verification!.setupAttempts as unknown[]).length > 0;
    const check = (where: string, item: { sourceIds: string[]; confidence: string }) => {
      for (const id of item.sourceIds) {
        used.add(id);
        if (!ids.has(id)) errors.push(`${where} cites unknown source ${id}`);
      }
      if (!item.sourceIds.length && item.confidence !== "inferred") errors.push(`${where} has no sources but confidence ${item.confidence}`);
      if (item.confidence === "tested" && !hasAttempts) errors.push(`${where} is "tested" but there are no setupAttempts`);
    };
    g.phases.forEach((p, i) => p.steps.forEach((s, j) => check(`phases[${i}].steps[${j}]`, s)));
    g.requirements.forEach((x, i) => check(`requirements[${i}]`, x));
    g.permissions.forEach((x, i) => check(`permissions[${i}]`, x));
    g.nuances.forEach((x, i) => check(`nuances[${i}]`, x));
    g.blockers.forEach((x, i) => check(`blockers[${i}]`, x));
    for (const s of g.sources) if (!used.has(s.id)) warnings.push(`source ${s.id} is never cited`);
    if (g.verdict.difficulty < 1 || g.verdict.difficulty > 5) errors.push("difficulty must be 1-5");
    const phaseIds = g.phases.map((p) => p.id);
    if (new Set(phaseIds).size !== phaseIds.length) errors.push("duplicate phase ids");
    if (g.drafts.length < 2) warnings.push("fewer than 2 drafts");
  }

  if (errors.length) {
    failed = true;
    console.error(`✗ ${path.basename(file)}`);
    errors.forEach((e) => console.error(`   error: ${e}`));
  } else {
    console.log(`✓ ${path.basename(file)}`);
  }
  warnings.forEach((w) => console.log(`   warn: ${w}`));
}
process.exit(failed ? 1 : 0);
