#!/usr/bin/env node
/**
 * The migration's own status report: what is migrated, what is verified, what remains.
 *
 *   node compiler/migration/report.mjs
 *
 * Sources of truth, in order:
 *   .design-compiler/base-ui-migration/inventory.json   what React Aria usage existed
 *   .design-compiler/base-ui-migration/matrix.json      the units and their derived status
 *   .design-compiler/base-ui-migration/units/*.json     per-unit migration records (written by the migrating agent)
 *   .design-compiler/base-ui-migration/parity-*.json    verification results
 *   compiler/migration/residue.mjs                      current React Aria residue
 *
 * The report states the migration's own outcome; it never upgrades a status that the evidence does not show.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const ROOT = ".design-compiler/base-ui-migration";
const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null);

const inventory = readJson(`${ROOT}/inventory.json`);
const matrix = readJson(`${ROOT}/matrix.json`);
const unitDir = `${ROOT}/units`;
const units = existsSync(unitDir)
  ? readdirSync(unitDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => readJson(`${unitDir}/${f}`))
  : [];

const parityFiles = readdirSync(ROOT).filter((f) => /^parity-.*\.json$/.test(f));
const parity = parityFiles.map((f) => readJson(`${ROOT}/${f}`));

let residue = null;
try {
  const out = execFileSync("node", ["compiler/migration/residue.mjs"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  residue = JSON.parse(out);
} catch (error) {
  // a non-zero exit means canonical residue exists; the JSON is still on stdout
  try {
    residue = JSON.parse(String(error.stdout));
  } catch {
    residue = { totals: { byKind: {}, canonicalRuntimeFiles: null }, gate: { passed: false } };
  }
}

const baseUi = readJson("node_modules/@base-ui/react/package.json");
const terminal = new Set(["BASE_UI_VERIFIED", "NATIVE_VERIFIED", "SPECIALIZED_VERIFIED", "NO_BASE_UI_EQUIVALENT", "BLOCKED", "STAGNATED"]);
const entryStatus = new Map();
for (const entry of matrix?.units ?? []) entryStatus.set(entry.item, entry.status);
for (const unit of units) {
  const verified = parity.some((p) => p?.unit === unit.unit && p?.status === "PASS") || parity.some((p) => p?.label === unit.unit && p?.status === "PASS");
  entryStatus.set(unit.unit, unit.status === "BLOCKED" ? "BLOCKED" : verified ? "BASE_UI_VERIFIED" : "MIGRATED_PENDING_GATES");
}

const byStatus = [...entryStatus.entries()].reduce((m, [, s]) => ((m[s] = (m[s] ?? 0) + 1), m), {});
const notTerminal = [...entryStatus.entries()].filter(([, s]) => !terminal.has(s));

const report = {
  $schema: "design-compiler/BaseUiMigrationReport@p0",
  branch: "migration/base-ui-v1.8",
  baseUiVersion: baseUi?.version ?? null,
  reactAriaVersion: readJson("node_modules/react-aria-components/package.json")?.version ?? null,
  totals: {
    canonicalComponentsInspected: new Set(inventory?.entries?.map((e) => e.publicItems ?? [])).size,
    reactAriaUsagesFoundInitially: inventory?.totals?.symbols ?? null,
    reactAriaFilesFoundInitially: inventory?.totals?.files ?? null,
    affectedPublicItems: inventory?.totals?.publicItemsAffected ?? null,
    baseUiPrimitivesDocumented: existsSync(`${ROOT}/docs`) ? readdirSync(`${ROOT}/docs`).length : 0,
    units: entryStatus.size,
    byStatus,
    parityReports: parity.length,
    parityPassing: parity.filter((p) => p?.status === "PASS").length,
  },
  residue,
  units: [...entryStatus.entries()].map(([unit, status]) => ({ unit, status })),
  notTerminal,
  completed: notTerminal.length === 0 && residue?.gate?.passed === true,
};
writeFileSync(`${ROOT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.completed ? 0 : 1);
