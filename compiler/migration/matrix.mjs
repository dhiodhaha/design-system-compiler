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
  { id: "forms-primitives", files: ["components/base/checkbox/checkbox.tsx", "components/base/toggle/toggle.tsx", "components/base/radio-buttons/radio-buttons.tsx"], primitives: ["checkbox", "switch", "radio", "radio-group", "field"], wave: 1, risk: "MEDIUM", publicItems: 98, strategy: "DIRECT_BASE_UI_EQUIVALENT" },
  { id: "field-text", files: ["components/base/input/label.tsx", "components/base/input/hint-text.tsx"], primitives: ["field"], wave: 1, risk: "LOW", publicItems: 86, strategy: "BASE_UI_COMPOSITION" },
  { id: "buttons-native", files: ["components/base/buttons/button.tsx", "components/base/buttons/button-utility.tsx", "components/base/buttons/close-button.tsx", "components/base/buttons/social-button.tsx", "components/base/avatar/base-components/avatar-add-button.tsx"], primitives: ["use-render", "merge-props"], wave: 1, risk: "MEDIUM", publicItems: 98, strategy: "NATIVE_REPLACEMENT" },
  { id: "tooltip-overlay", files: ["components/base/tooltip/tooltip.tsx"], primitives: ["tooltip"], wave: 1, risk: "HIGH", publicItems: 86, strategy: "DIRECT_BASE_UI_EQUIVALENT" },
  { id: "slider", files: ["components/base/slider/slider.tsx"], primitives: ["slider"], wave: 2, risk: "MEDIUM", publicItems: 0, strategy: "DIRECT_BASE_UI_EQUIVALENT" },
  { id: "input-field", files: ["components/base/input/input.tsx"], primitives: ["field", "input"], wave: 2, risk: "HIGH", publicItems: 19, strategy: "BASE_UI_COMPOSITION", dependsOn: ["field-text"], dependencyNote: "React Aria's Label reads the control id from React Aria's field context; a migrated Label cannot name an unmigrated React Aria input, so Label/HintText and the field family must migrate as one unit (observed as an axe `label` violation on input-invalid/textarea-invalid)." },
  { id: "textarea", files: ["components/base/textarea/textarea.tsx"], primitives: ["field"], wave: 2, risk: "MEDIUM", publicItems: 0, strategy: "BASE_UI_COMPOSITION", dependsOn: ["field-text"], dependencyNote: "same field-context wiring dependency as input-field" },
  { id: "input-number", files: ["components/base/input/input-number.tsx"], primitives: ["number-field", "field"], wave: 2, risk: "HIGH", publicItems: 0, strategy: "BASE_UI_COMPOSITION" },
  { id: "input-payment", files: ["components/base/input/input-payment.tsx"], primitives: ["field", "input"], wave: 2, risk: "MEDIUM", publicItems: 0, strategy: "BASE_UI_COMPOSITION" },
  { id: "input-tags", files: ["components/base/input/input-tags.tsx"], primitives: ["combobox"], wave: 3, risk: "HIGH", publicItems: 0, strategy: "BASE_UI_COMPOSITION" },
  { id: "button-group", files: ["components/base/button-group/button-group.tsx"], primitives: ["toggle", "toggle-group"], wave: 2, risk: "MEDIUM", publicItems: 0, strategy: "DIRECT_BASE_UI_EQUIVALENT" },
  { id: "form", files: ["components/base/form/form.tsx", "components/base/form/hook-form.tsx"], primitives: ["form", "fieldset"], wave: 2, risk: "MEDIUM", publicItems: 0, strategy: "DIRECT_BASE_UI_EQUIVALENT" },
  { id: "file-upload", files: ["components/base/file-upload-trigger/file-upload-trigger.tsx"], primitives: ["input"], wave: 2, risk: "LOW", publicItems: 0, strategy: "NATIVE_REPLACEMENT" },
  { id: "select", files: ["components/base/select/select.tsx", "components/base/select/select-item.tsx", "components/base/select/popover.tsx"], primitives: ["select", "popover"], wave: 3, risk: "HIGH", publicItems: 13, strategy: "DIRECT_BASE_UI_EQUIVALENT" },
  { id: "combobox", files: ["components/base/select/combobox.tsx"], primitives: ["combobox", "autocomplete"], wave: 3, risk: "HIGH", publicItems: 9, strategy: "BASE_UI_COMPOSITION" },
  { id: "multi-select", files: ["components/base/select/multi-select.tsx"], primitives: ["select", "combobox"], wave: 3, risk: "HIGH", publicItems: 0, strategy: "BASE_UI_COMPOSITION" },
  { id: "tag-select", files: ["components/base/select/tag-select.tsx"], primitives: ["combobox"], wave: 3, risk: "HIGH", publicItems: 0, strategy: "BASE_UI_COMPOSITION" },
  { id: "dropdown-menu", files: ["components/base/dropdown/dropdown.tsx", "components/base/dropdown/dropdown-account-breadcrumb.tsx", "components/base/dropdown/dropdown-account-button.tsx", "components/base/dropdown/dropdown-account-card-md.tsx", "components/base/dropdown/dropdown-account-card-sm.tsx", "components/base/dropdown/dropdown-account-card-xs.tsx", "components/base/dropdown/dropdown-avatar.tsx", "components/base/dropdown/dropdown-button-advanced.tsx", "components/base/dropdown/dropdown-button-link.tsx", "components/base/dropdown/dropdown-button-simple.tsx", "components/base/dropdown/dropdown-context-menu-advanced.tsx", "components/base/dropdown/dropdown-context-menu-simple.tsx", "components/base/dropdown/dropdown-icon-advanced.tsx", "components/base/dropdown/dropdown-icon-simple.tsx", "components/base/dropdown/dropdown-search-advanced.tsx", "components/base/dropdown/dropdown-search-simple.tsx"], primitives: ["menu", "popover", "autocomplete"], wave: 3, risk: "HIGH", publicItems: 21, strategy: "DIRECT_BASE_UI_EQUIVALENT" },
  { id: "tags", files: ["components/base/tags/tags.tsx", "components/base/tags/base-components/tag-close-x.tsx"], primitives: ["combobox"], wave: 3, risk: "MEDIUM", publicItems: 0, strategy: "BASE_UI_COMPOSITION" },
  { id: "modal-dialog", files: ["components/application/modals/modal.tsx"], primitives: ["dialog"], wave: 4, risk: "HIGH", publicItems: 0, strategy: "DIRECT_BASE_UI_EQUIVALENT", dependsOn: ["buttons-native"], dependencyNote: "React Aria's DialogTrigger wires its child through React Aria press props; once the payload Button is a native element it no longer consumes them, so the trigger stops opening the dialog (observed in the migrated capture: aria-expanded never becomes true). These consumers must migrate in the same batch as, or after, the button family." },
  { id: "slideout", files: ["components/application/slideout-menus/slideout-menu.tsx"], primitives: ["dialog", "drawer"], wave: 4, risk: "HIGH", publicItems: 0, strategy: "DIRECT_BASE_UI_EQUIVALENT", dependsOn: ["buttons-native"], dependencyNote: "same React Aria trigger/child press-wiring dependency as modal-dialog" },
  { id: "tabs", files: ["components/application/tabs/tabs.tsx"], primitives: ["tabs"], wave: 4, risk: "MEDIUM", publicItems: 0, strategy: "DIRECT_BASE_UI_EQUIVALENT" },
  { id: "nav-parts", files: ["components/application/app-navigation/base-components/nav-account-card.tsx", "components/application/app-navigation/base-components/nav-item.tsx", "components/application/app-navigation/base-components/mobile-header.tsx", "components/application/app-navigation/base-components/nav-button.tsx", "components/application/app-navigation/sidebar-navigation/sidebar-slim.tsx"], primitives: ["dialog", "popover", "use-render"], wave: 4, risk: "MEDIUM", publicItems: 16, strategy: "BASE_UI_COMPOSITION", dependsOn: ["buttons-native"], dependencyNote: "app-navigation parts render the payload Button inside React Aria DialogTrigger/Popover and use Card/Dialog contexts; same press-wiring dependency as modal-dialog" },
  { id: "date-picker", files: ["components/application/date-picker/calendar.tsx", "components/application/date-picker/cell.tsx", "components/application/date-picker/date-picker.tsx", "components/application/date-picker/date-range-picker.tsx", "components/application/date-picker/range-calendar.tsx", "components/base/input/input-date.tsx"], primitives: [], wave: 5, risk: "HIGH", publicItems: 9, strategy: "NO_BASE_UI_EQUIVALENT", blocker: "Base UI 1.8.0 has no date primitives (proven absent from the 1.8.0 export surface and docs index); requires an owner-approved native/specialized replacement" },
  { id: "table", files: ["components/application/table/table.tsx"], primitives: [], wave: 5, risk: "HIGH", publicItems: 0, strategy: "NO_BASE_UI_EQUIVALENT", blocker: "Base UI 1.8.0 has no Table/Grid primitive; requires an owner-approved native/specialized replacement" },
];

/** Files the inventory found that no unit claims yet — surfaced instead of silently ignored. */
const claimed = new Set(UNITS.flatMap((u) => u.files.filter((f) => !f.includes("*"))));
const unclaimed = inventory.entries
  .filter((e) => e.surface === "payload" || e.surface === "app")
  .map((e) => e.file.replace("registry/untitledui/", "").replace("src/", ""))
  .filter((f) => !claimed.has(f) && !UNITS.some((u) => u.files.some((p) => p.includes("*") && f.startsWith(p.replace("/*", "/")))));

/** A unit's status is derived from the files (React Aria gone?) and from its migration record if one exists. */
const unitRecord = (id) => {
  const path = `${ROOT}/units/${id}.json`;
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
};

const statusOf = (unit) => {
  const record = unitRecord(unit.id);
  if (record?.status === "BLOCKED") return "BLOCKED";
  const absolute = unit.files.filter((f) => !f.includes("*")).map((f) => `registry/untitledui/${f}`);
  const present = absolute.filter((f) => existsSync(f));
  if (present.length === 0) return "TODO";
  const remaining = present.filter((f) => RA_RE.test(readFileSync(f, "utf8")));
  const docNotes = unit.primitives.filter((p) => docs[p] && docs[p].exists !== false).length;
  if (remaining.length === 0) {
    const parity = existsSync(`${ROOT}/parity-migrated.json`) ? JSON.parse(readFileSync(`${ROOT}/parity-migrated.json`, "utf8")) : null;
    const probes = unit.files.map((f) => f.split("/").pop().replace(".tsx", ""));
    const relevant = (parity?.failures ?? []).filter((failure) => probes.some((probe) => failure.case.startsWith(probe)));
    if (parity && relevant.length === 0 && unit.wave <= 4) return "MIGRATED_PENDING_GATES";
    return "MIGRATED_PENDING_GATES";
  }
  if (docNotes === 0 && unit.primitives.length) return "MIGRATING";
  return "MIGRATING";
};


const units = UNITS.map((unit) => ({
  item: unit.id,
  wave: unit.wave,
  files: unit.files,
  currentEngine: [...new Set(inventory.entries.flatMap((e) => (unit.files.some((f) => e.file.endsWith(f.replace("/*", ""))) ? e.symbols.map((s) => `${s.package}/${s.symbol}`) : [])))].slice(0, 24),
  target: unit.primitives.filter((p) => docs[p]?.exists !== false).map((p) => `@base-ui/react/${p}`),
  strategy: unit.strategy ?? (unit.primitives.length === 0 ? "NO_BASE_UI_EQUIVALENT" : "NEEDS_RESEARCH"),
  blocker: unit.blocker ?? null,
  publicApiPolicy: "PRESERVE",
  risk: unit.risk,
  downstreamPublicItems: unit.publicItems,
  docsNotes: unit.primitives.map((p) => (docs[p] ? `${ROOT}/docs/${p}.json` : null)).filter(Boolean),
  testsRequired: ["typecheck", "ssr", "keyboard", "controlled", "uncontrolled", "a11y", "visual"],
  status: statusOf(unit),
  record: unitRecord(unit.id) ? `${ROOT}/units/${unit.id}.json` : null,
  dependsOn: unit.dependsOn ?? [],
  dependencyNote: unit.dependencyNote ?? null,
  publicApiChanges: unitRecord(unit.id)?.publicApiChanges?.length ?? 0,
  blockers: unitRecord(unit.id)?.blockers ?? (unit.blocker ? [unit.blocker] : []),
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
