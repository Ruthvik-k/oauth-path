/**
 * Runs the live probes (authorize endpoint, discovery metadata, portal, source links) for curated guides
 * and stores the results in each guide's verification.probes.  Usage: npx tsx scripts/probe-curated.ts [slug ...]
 */
import { readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { runProbes } from "../src/lib/agent/probes";
import type { Guide } from "../src/lib/guide-schema";

const dir = path.join(__dirname, "..", "src", "data", "guides");
const only = process.argv.slice(2);

(async () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const slug = file.replace(/\.json$/, "");
    if (only.length && !only.includes(slug)) continue;
    const full = path.join(dir, file);
    const guide = JSON.parse(readFileSync(full, "utf8")) as Guide;
    const probes = await runProbes(guide, guide.composio, () => {});
    guide.verification.probes = probes;
    writeFileSync(full, JSON.stringify(guide, null, 2) + "\n");
    console.log(`${slug}:`);
    for (const p of probes) console.log(`  ${p.ok ? "ok" : "!!"} ${p.name}: ${p.result}`);
  }
})();
