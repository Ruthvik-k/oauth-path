/**
 * Runs the guide agent from the command line.
 *
 *   npm run agent -- seed "Notion" "QuickBooks"     → writes bundled agent guides to src/data/generated/
 *   npm run agent -- baseline "GitHub" "Gmail"      → writes agent-only versions of curated apps to
 *                                                     src/data/agent-baselines/ for comparison with the human-verified guides
 */
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import path from "path";
import { findCatalogApp, slugify } from "../src/lib/catalog";
import { lookupComposio } from "../src/lib/composio";
import { buildGuide, resolveForBuild } from "../src/lib/agent/pipeline";
import type { AgentEvent } from "../src/lib/agent/events";

const [mode, ...names] = process.argv.slice(2);
if (!["seed", "baseline"].includes(mode) || names.length === 0) {
  console.error('Usage: npm run agent -- <seed|baseline> "App name" ["App name" ...]');
  process.exit(1);
}

function log(name: string, e: AgentEvent) {
  const t = new Date().toISOString().slice(11, 19);
  if (e.type === "stage") console.log(`${t} [${name}] ${e.stage} ${e.status}${e.message ? `: ${e.message}` : ""}`);
  else if (e.type === "log") console.log(`${t} [${name}]   ${e.track ? `(${e.track}) ` : ""}${e.message}`);
  else if (e.type === "probe") console.log(`${t} [${name}]   probe ${e.probe.ok ? "ok" : "!!"} ${e.probe.name}: ${e.probe.result}`);
  else if (e.type === "claim") console.log(`${t} [${name}]   claim ${e.check.verdict}: ${e.check.claim.slice(0, 90)}`);
}

async function run(name: string) {
  const started = Date.now();
  const emit = (e: AgentEvent) => log(name, e);
  const { query, app, catalogSlug, composioNames } = await resolveForBuild(name, emit);
  const catalog = catalogSlug ? findCatalogApp(catalogSlug) : null;
  const composio = await lookupComposio(composioNames);
  const slug = mode === "baseline" ? (catalog?.guideSlug ?? catalogSlug ?? slugify(app.name)) : (catalogSlug ?? slugify(app.name));
  const guide = await buildGuide({ app, slug, query, composio }, emit);
  const folder = mode === "baseline" ? "agent-baselines" : "generated";
  const file = path.join(__dirname, "..", "src", "data", folder, `${slug}.json`);
  writeFileSync(file, JSON.stringify(guide, null, 2));
  console.log(`✓ [${name}] wrote ${path.relative(process.cwd(), file)} in ${Math.round((Date.now() - started) / 1000)}s`);
}

(async () => {
  const results = await Promise.allSettled(names.map(run));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`✗ [${names[i]}] ${(r.reason as Error).message}`);
  });
  if (mode === "seed") execSync("npx tsx scripts/build-registry.ts", { stdio: "inherit" });
  process.exit(results.some((r) => r.status === "rejected") ? 1 : 0);
})();
