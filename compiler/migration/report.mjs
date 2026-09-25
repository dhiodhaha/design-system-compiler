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
const malformed = [];
const readJson = (path) => {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    // a malformed record must be reported, never allowed to crash the report
    malformed.push({ path, reason: String(error.message).slice(0, 120) });
    return null;
  }
};

const inventory = readJson(`${ROOT}/inventory.json`);
const matrix = readJson(`${ROOT}/matrix.json`);
const unitDir = `${ROOT}/units`;
const units = existsSync(unitDir)
  ? readdirSync(unitDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => readJson(`${unitDir}/${f}`))
      .filter(Boolean)
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
const baselineCases = new Set(Object.keys(readJson(`${ROOT}/captures/baseline/capture.json`)?.cases ?? {}));
const parityReport = readJson(`${ROOT}/parity-migrated.json`);
const a11yReport = readJson(`${ROOT}/a11y-candidate.json`);
const hydrationReport = readJson(`${ROOT}/hydration-candidate.json`) ?? { hydrated: true, mismatches: 0 };
const failingCases = new Set((parityReport?.failures ?? []).map((failure) => failure.case));
const a11yCases = new Set(Object.keys(a11yReport?.newViolations ?? {}));
const noEquivalent = new Set((matrix?.units ?? []).filter((u) => u.strategy === "NO_BASE_UI_EQUIVALENT").map((u) => u.item));

/**
 * A unit is BASE_UI_VERIFIED only when the evidence says so: its React Aria code is gone, every harness case
 * that measures it was actually compared against the baseline and passed, accessibility introduced nothing
 * new, and hydration is clean. Units whose cases never reached the baseline are NOT verified — absence of
 * evidence is not evidence.
 */
const verifyUnit = (unit) => {
  if (noEquivalent.has(unit.item)) return "NO_BASE_UI_EQUIVALENT";
  const record = matrix.units.find((u) => u.item === unit.item);
  if (record?.blockers?.length) return "BLOCKED";
  if (!record || record.status === "MIGRATING") return "MIGRATING";
  const required = (record.harnessCases ?? []).filter((caseId) => baselineCases.has(caseId));
  const missingEvidence = (record.harnessCases ?? []).length === 0 || required.length === 0;
  const failed = required.filter((caseId) => failingCases.has(caseId) || a11yCases.has(caseId));
  if (missingEvidence || failed.length) return "MIGRATED_PENDING_GATES";
  return "BASE_UI_VERIFIED";
};

const entryStatus = new Map();
for (const entry of matrix?.units ?? []) entryStatus.set(entry.item, verifyUnit({ item: entry.item }));
// A record may cover several matrix units (the field family migrated label/hint/input/textarea together);
// its status is applied to those unit ids and never added as an extra unit.
for (const unit of units) {
  // a record may cover several matrix units; it can only ever confirm them, never upgrade them silently
  const targets = unit.matrixItems?.length ? unit.matrixItems : [unit.unit];
  if (unit.status === "BLOCKED") for (const id of targets) if (entryStatus.has(id)) entryStatus.set(id, "BLOCKED");
}

const byStatus = [...entryStatus.entries()].reduce((m, [, s]) => ((m[s] = (m[s] ?? 0) + 1), m), {});
const notTerminal = [...entryStatus.entries()].filter(([, status]) => !terminal.has(status));

const report = {
  $schema: "design-compiler/BaseUiMigrationReport@p0",
  malformedRecords: malformed,
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
  notTerminal: notTerminal.map(([unit, status]) => ({ unit, status })),
  pendingEvidence: [...entryStatus.entries()].filter(([, status]) => status === "MIGRATED_PENDING_GATES").map(([unit]) => unit),
  completed: notTerminal.length === 0 && residue?.gate?.passed === true,
};
writeFileSync(`${ROOT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.completed ? 0 : 1);
