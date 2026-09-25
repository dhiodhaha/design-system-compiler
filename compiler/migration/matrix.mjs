#!/usr/bin/env node
/**
 * Phase 1 of the Base UI migration: the migration matrix.
 *
 *   node compiler/migration/matrix.mjs
 *
 * One entry per public registry item that carries React Aria today (directly or through the components it
 * composes), plus one entry per migration unit (the files that actually change). Statuses are the terminal
 * vocabulary of the migration; this script never invents a status — it derives the current one from the
 * live filesystem, so the matrix cannot claim progress that the code does not show.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = ".design-compiler/base-ui-migration";
const inventory = JSON.parse(readFileSync(`${ROOT}/inventory.json`, "utf8"));
const docs = existsSync(`${ROOT}/docs`)
  ? Object.fromEntries(
      (await import("node:fs")).readdirSync(`${ROOT}/docs`).filter((f) => f.endsWith(".json")).map((f) => [f.replace(/\.json$/, ""), JSON.parse(readFileSync(`${ROOT}/docs/${f}`, "utf8"))]),
    )
  : {};

const RA_RE = /from\s+"(react-aria-components|react-aria|react-stately|@react-aria\/[a-z-]+|@react-stately\/[a-z-]+)"/;

/** Migration units: the files that change, in dependency order (leaves first). */
const UNITS = [
  { id: "button", files: ["components/base/buttons/button.tsx"], primitives: ["use-render", "merge-props"], wave: 1, risk: "MEDIUM", publicItems: 45 },
  { id: "field-text", files: ["components/base/input/label.tsx", "components/base/input/hint-text.tsx"], primitives: ["field"], wave: 1, risk: "LOW", publicItems: 43 },
  { id: "tooltip", files: ["components/base/tooltip/tooltip.tsx"], primitives: ["tooltip"], wave: 1, risk: "HIGH", publicItems: 86 },
  { id: "checkbox", files: ["components/base/checkbox/checkbox.tsx"], primitives: ["checkbox", "field"], wave: 1, risk: "MEDIUM", publicItems: 36 },
  { id: "radio-group", files: ["components/base/radio-buttons/radio-buttons.tsx"], primitives: ["radio", "radio-group", "field"], wave: 1, risk: "MEDIUM", publicItems: 39 },
  { id: "toggle", files: ["components/base/toggle/toggle.tsx"], primitives: ["switch"], wave: 1, risk: "MEDIUM", publicItems: 23 },
  { id: "input-field", files: ["components/base/input/input.tsx"], primitives: ["field", "input"], wave: 2, risk: "HIGH", publicItems: 19 },
  { id: "input-textarea", files: ["components/base/input/textarea.tsx"], primitives: ["field"], wave: 2, risk: "MEDIUM", publicItems: 0 },
  { id: "input-number", files: ["components/base/input/input-number.tsx"], primitives: ["number-field", "field"], wave: 2, risk: "HIGH", publicItems: 0 },
  { id: "input-payment", files: ["components/base/input/input-payment.tsx"], primitives: ["field", "input"], wave: 2, risk: "MEDIUM", publicItems: 0 },
  { id: "input-tags", files: ["components/base/input/input-tags.tsx"], primitives: ["combobox"], wave: 3, risk: "HIGH", publicItems: 0 },
  { id: "select", files: ["components/base/select/select.tsx", "components/base/select/select-item.tsx", "components/base/select/popover.tsx", "components/base/select/select-native.tsx"], primitives: ["select", "popover"], wave: 3, risk: "HIGH", publicItems: 13 },
  { id: "combobox", files: ["components/base/select/combobox.tsx", "components/base/select/combobox-trigger.tsx"], primitives: ["combobox", "autocomplete"], wave: 3, risk: "HIGH", publicItems: 9 },
  { id: "dropdown-menu", files: ["components/base/dropdown/dropdown.tsx"], primitives: ["menu", "popover"], wave: 3, risk: "HIGH", publicItems: 21 },
  { id: "modal-dialog", files: ["components/application/modals/modal.tsx"], primitives: ["dialog"], wave: 4, risk: "HIGH", publicItems: 0 },
  { id: "tabs", files: ["components/application/tabs/tabs.tsx"], primitives: ["tabs"], wave: 4, risk: "MEDIUM", publicItems: 0 },
  { id: "nav-parts", files: ["components/application/app-navigation/base-components/nav-account-card.tsx", "components/application/app-navigation/base-components/nav-item.tsx", "components/application/app-navigation/base-components/mobile-header.tsx", "components/application/app-navigation/base-components/nav-button.tsx"], primitives: ["dialog", "use-render"], wave: 4, risk: "MEDIUM", publicItems: 16 },
  { id: "date-fields", files: ["components/base/input/input-date.tsx", "components/application/date-picker/*"], primitives: [], wave: 5, risk: "HIGH", publicItems: 9, research: true },
  { id: "collections-advanced", files: ["components/application/table/*", "components/application/tree/*"], primitives: [], wave: 5, risk: "HIGH", publicItems: 0, research: true },
];

/** Files the inventory found that no unit claims yet — surfaced instead of silently ignored. */
const claimed = new Set(UNITS.flatMap((u) => u.files.filter((f) => !f.includes("*"))));
const unclaimed = inventory.entries
  .filter((e) => e.surface === "payload" || e.surface === "app")
  .map((e) => e.file.replace("registry/untitledui/", "").replace("src/", ""))
  .filter((f) => !claimed.has(f) && !UNITS.some((u) => u.files.some((p) => p.includes("*") && f.startsWith(p.replace("/*", "/")))));

const statusOf = (unit) => {
  const absolute = unit.files.filter((f) => !f.includes("*")).map((f) => `registry/untitledui/${f}`);
  const present = absolute.filter((f) => existsSync(f));
  if (present.length === 0) return "TODO";
  const remaining = present.filter((f) => RA_RE.test(readFileSync(f, "utf8")));
  const docNotes = unit.primitives.filter((p) => docs[p] && docs[p].exists !== false).length;
  if (remaining.length === 0) return "MIGRATED_PENDING_GATES";
  if (docNotes === 0 && unit.primitives.length) return "MIGRATING";
  return "MIGRATING";
};


const units = UNITS.map((unit) => ({
  item: unit.id,
  wave: unit.wave,
  files: unit.files,
  currentEngine: [...new Set(inventory.entries.flatMap((e) => (unit.files.some((f) => e.file.endsWith(f.replace("/*", ""))) ? e.symbols.map((s) => `${s.package}/${s.symbol}`) : [])))].slice(0, 24),
  target: unit.primitives.filter((p) => docs[p]?.exists !== false).map((p) => `@base-ui/react/${p}`),
  strategy: unit.research ? "NEEDS_RESEARCH" : unit.primitives.length === 0 ? "NO_BASE_UI_EQUIVALENT" : "DIRECT_BASE_UI_EQUIVALENT",
  publicApiPolicy: "PRESERVE",
  risk: unit.risk,
  downstreamPublicItems: unit.publicItems,
  docsNotes: unit.primitives.map((p) => (docs[p] ? `${ROOT}/docs/${p}.json` : null)).filter(Boolean),
  testsRequired: ["typecheck", "ssr", "keyboard", "controlled", "uncontrolled", "a11y", "visual"],
  status: statusOf(unit),
}));

const matrix = {
  $schema: "design-compiler/BaseUiMigrationMatrix@p0",
  baseUiVersion: "1.8.0",
  branch: "migration/base-ui-v1.8",
  terminalStates: ["BASE_UI_VERIFIED", "NATIVE_VERIFIED", "SPECIALIZED_VERIFIED", "NO_BASE_UI_EQUIVALENT", "BLOCKED", "STAGNATED"],
  totals: {
    units: units.length,
    byStatus: units.reduce((m, u) => ((m[u.status] = (m[u.status] ?? 0) + 1), m), {}),
    byWave: units.reduce((m, u) => ((m[u.wave] = (m[u.wave] ?? 0) + 1), m), {}),
    reactAriaFiles: inventory.totals.files,
    affectedPublicItems: inventory.totals.publicItemsAffected,
    unclaimedFiles: unclaimed,
  },
  units,
};

writeFileSync(`${ROOT}/matrix.json`, JSON.stringify(matrix, null, 2));
console.log(JSON.stringify({ wrote: `${ROOT}/matrix.json`, units: units.length, byStatus: matrix.totals.byStatus, byWave: matrix.totals.byWave, unclaimedFiles: unclaimed, docsNotes: Object.keys(docs).length }, null, 2));
