#!/usr/bin/env node
/**
 * Final consistency test (plan "FINAL CONSISTENCY TEST").
 *
 *   node compiler/state/consistency.mjs
 *
 * Asserts the invariants that make the repository self-consistent, and fails loudly when any of them drift:
 * docs reflect Option D · all state files agree · the canonical registry holds no benchmark entry ·
 * the official Button stays canonical · every OSS candidate, recipe, foundation/asset, Figma family and
 * non-icon PRO gap has a terminal status · no hand-maintained count contradicts a derived count.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const text = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const REF = ".design-compiler/references";
const LIB = "untitledui";
const checks = [];
const check = (name, pass, evidence) => checks.push({ check: name, pass: Boolean(pass), evidence });

const index = read(resolve(REF, LIB, "index.json"));
const coverage = read(resolve(REF, LIB, "coverage.json"));
const report = read(".design-compiler/report.json");
const registry = read(".design-compiler/registry/index.json");
const crosswalk = read(resolve(REF, LIB, "crosswalk.json"));
const proGaps = read(resolve(REF, LIB, "pro-gap-inventory.json"));
const adoptionRun = read(resolve(REF, LIB, "adoption-run.json"));
const benchmark = read(".design-compiler/registry/benchmark-figma-button.json");

// ---- 1. docs reflect Option D and no canonical doc mandates a Base UI migration
const readme = text("docs/README.md");
check("docs: Option D stated in docs/README.md", /Option D/.test(readme) && /canonical/i.test(readme), "architecture decision banner present");
const mandate = ["docs/COVERAGE_STRATEGY.md", "docs/API_DESIGN_POLICY.md", "docs/CLI_AND_MCP.md", "docs/DESIGN_SYSTEM_COMPILER.md", "docs/ROADMAP.md"]
  .flatMap((f) => text(f).split("\n").map((l, i) => ({ f, i: i + 1, l })))
  // Option-D phrasing ("Base UI is optional / never a migration target") is compliant, not a mandate.
  .filter(({ l }) => /Base UI/.test(l) && /(migration target|mandatory|must migrate|rewrite .*Base UI|Base UI target)/i.test(l) && !/optional|never a migration target|only for genuinely new/i.test(l));
check("docs: no canonical doc mandates Base UI migration", mandate.length === 0, mandate.map((m) => `${m.f}:${m.i}`).join(", ") || "none found");

// ---- 2. state files agree

check(
  "state: coverage and registry agree",
  coverage?.totals?.adoptedItems === adoptionRun?.itemsAdopted && registry?.counts?.items === adoptionRun?.itemsAdopted && coverage?.totals?.installableItems === registry?.counts?.installable,
  `coverage.adopted=${coverage?.totals?.adoptedItems} registry.items=${registry?.counts?.items} adoptionRun=${adoptionRun?.itemsAdopted} installable=${registry?.counts?.installable}`,
);
check(
  "state: report agrees with adoption run",
  report?.adoption?.items === adoptionRun?.itemsAdopted && report?.adoption?.payloadFiles === registry?.counts?.payloadFiles,
  `report.items=${report?.adoption?.items} report.payloadFiles=${report?.adoption?.payloadFiles} registry.payloadFiles=${registry?.counts?.payloadFiles}`,
);
check("state: derived files declare their derivation", coverage?.derived === true && report?.derived === true, "coverage.json and report.json carry derived:true");

// ---- 3. benchmark is not canonical
const benchmarkIds = new Set(["benchmark-figma-button", "button-benchmark"]);
const benchmarkInIndex = (registry?.items ?? []).filter((i) => benchmarkIds.has(i.id));
check("registry: canonical index contains no benchmark entry", benchmarkInIndex.length === 0, `found ${benchmarkInIndex.length}`);
check("registry: benchmark retained separately", Boolean(benchmark) && benchmark.type === "COMPILER_RECONSTRUCTION_BENCHMARK", benchmark ? benchmark.type : "missing");
check("registry: legacy benchmark registry removed", !existsSync(".design-compiler/registry.json"), ".design-compiler/registry.json absent");

// ---- 4. official Button remains canonical
const buttonItem = (registry?.items ?? []).find((i) => i.id === "button");
const buttonRegistry = read(".design-compiler/registry/button.json");
check("registry: button item is the adopted official source", Boolean(buttonItem) && (buttonRegistry?.files ?? []).some((f) => /registry\/untitledui\/components\/base\/buttons\/button\.tsx/.test(f.path ?? "")), buttonItem ? `status ${buttonItem.status}, tier ${buttonItem.tier}` : "missing");
const canaryPath = "src/components/base/buttons/button.tsx";
const payloadPath = "registry/untitledui/components/base/buttons/button.tsx";
if (existsSync(canaryPath) && existsSync(payloadPath)) {
  const { createHash } = await import("node:crypto");
  const h = (p) => createHash("sha256").update(readFileSync(p, "utf8").replace(/^\/\*[\s\S]*?\*\//, "")).digest("hex").slice(0, 16);
  check("integration: app canary matches the registry payload byte-for-byte (modulo header)", h(canaryPath) === h(payloadPath), `src ${h(canaryPath)} vs payload ${h(payloadPath)}`);
} else {
  check("integration: app canary and payload both present", false, `canary=${existsSync(canaryPath)} payload=${existsSync(payloadPath)}`);
}

// ---- 5. every OSS public candidate has a terminal status
const TERMINAL = new Set(["VERIFIED", "VALIDATED", "VALIDATION_FAILED", "BLOCKED", "LICENSE_BLOCKED", "NEEDS_EXTERNAL_PACKAGE", "VERSION_DRIFT"]);
const nonTerminal = (registry?.items ?? []).filter((i) => !TERMINAL.has(i.status));
check("status: every registry item has a terminal status", nonTerminal.length === 0, nonTerminal.slice(0, 5).map((i) => `${i.id}:${i.status}`).join(", ") || `${registry?.items?.length ?? 0} items terminal`);

const publicCandidates = index?.inventory?.publicRegistryCandidates ?? 0;
const installable = registry?.counts?.installable ?? 0;
check("coverage: public candidates accounted for", installable >= publicCandidates, `${installable} installable >= ${publicCandidates} public candidates (multi-export files produce several items)`);

const layers = index?.inventory?.byAdoptionLayer ?? {};
const layerItems = registry?.counts?.byLayer ?? {};
check(
  "coverage: every adoptable layer produced items",
  (layers.component ?? 0) <= (layerItems.component ?? 0) && (layers.recipe ?? 0) <= (layerItems.recipe ?? 0) && (layers.foundation ?? 0) <= (layerItems.foundation ?? 0) && (layers.asset ?? 0) <= (layerItems.asset ?? 0),
  `index layers ${JSON.stringify(layers)} vs registry layers ${JSON.stringify(layerItems)}`,
);

// ---- 6. every Figma family has a relationship
const familyTotal = crosswalk?.totals?.figmaFamilies ?? 0;
const unclassified = crosswalk?.mappings?.filter((m) => !m.relationship)?.length ?? 0;
check("figma: every family has a relationship", familyTotal > 0 && unclassified === 0, `${familyTotal} families, ${unclassified} without a relationship`);

// ---- 7. non-icon PRO gaps have a terminal status
const workQueue = proGaps?.workQueue ?? [];
const stubbed = workQueue.filter((w) => !w.nextAction || !w.relationship);
check("pro: every queued gap has a status and a next action", stubbed.length === 0, `${workQueue.length} queued, ${stubbed.length} without action`);
check("pro: no forbidden fabrication in the queue", workQueue.every((w) => !/Modal type=|Input type=/.test(w.nextAction ?? "")), "no giant union-prop plans");

const failures = checks.filter((c) => !c.pass);
const out = {
  $schema: "design-compiler/Consistency@p0",
  at: new Date().toISOString(),
  checks,
  failures: failures.map((f) => f.check),
  status: failures.length ? "INCONSISTENT" : "CONSISTENT",
};
writeFileSync(".design-compiler/consistency.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ status: out.status, checks: checks.length, failures: failures.map((f) => `${f.check} — ${f.evidence}`) }, null, 2));
process.exit(failures.length ? 1 : 0);
