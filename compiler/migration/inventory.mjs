#!/usr/bin/env node
/**
 * Phase 0 of the Base UI migration: inventory every React Aria runtime dependency in the shipping surface.
 *
 *   node compiler/migration/inventory.mjs
 *
 * Surface = code that ships: `registry/untitledui/**` (the adopted canonical library) and `src/**`.
 * Excluded: benchmarks, visual harnesses, tests, fixtures — those are evidence, not runtime.
 *
 * Classification is grounded in the pinned @base-ui/react@1.8.0 package (its actual export surface) and in
 * the per-primitive docs recorded by the documentation scout, never in model memory.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";

const ROOT = ".design-compiler/base-ui-migration";
const SURFACE_DIRS = ["registry/untitledui", "src"];
const EXCLUDED = [/^visual\//, /^tests\//, /^benchmark\//, /\.test\./, /\.spec\./, /^src\/fixtures\//, /^src\/dev\//];
const RA_PACKAGES = [/^react-aria-components$/, /^react-aria$/, /^react-stately$/, /^@react-aria\//, /^@react-stately\//, /^@react-types\//, /^@react-types$/];

/** Base UI 1.8.0 primitives available to map onto, taken from the installed package. */
const baseUiComponents = existsSync("node_modules/@base-ui/react")
  ? readdirSync("node_modules/@base-ui/react")
      .filter((name) => {
        const path = `node_modules/@base-ui/react/${name}`;
        return statSync(path).isDirectory() && existsSync(`${path}/index.d.ts`) && !["docs", "internals", "floating-ui-react", "types", "utils"].includes(name);
      })
      .sort()
  : [];

/**
 * React Aria symbol → intended migration strategy. `target` names the Base UI primitive(s) where the 1.8.0
 * package has them; symbols whose strategy is NEEDS_RESEARCH are resolved by the documentation scout before
 * any component is touched.
 */
const STRATEGY = {
  // Direct component equivalents
  Button: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/button"] },
  Checkbox: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/checkbox"] },
  Switch: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/switch"] },
  Radio: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/radio", "@base-ui/react/radio-group"] },
  RadioGroup: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/radio-group"] },
  Slider: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/slider"] },
  Tabs: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/tabs"] },
  Tab: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/tabs"] },
  TabList: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/tabs"] },
  TabPanel: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/tabs"] },
  ProgressBar: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/progress"] },
  Meter: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/meter"] },
  Tooltip: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/tooltip"] },
  TooltipTrigger: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/tooltip"] },
  Dialog: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/dialog"] },
  DialogTrigger: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/dialog"] },
  Modal: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/dialog"] },
  ModalOverlay: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/dialog"] },
  Popover: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/popover"] },
  Menu: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/menu"] },
  MenuItem: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/menu"] },
  MenuTrigger: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/menu"] },
  SubmenuTrigger: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/menu"] },
  Select: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/select"] },
  SelectValue: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/select"] },
  ComboBox: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/combobox", "@base-ui/react/autocomplete"] },
  Autocomplete: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/autocomplete"] },
  TextField: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/field", "@base-ui/react/input"] },
  TextArea: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/field"] },
  SearchField: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/field", "@base-ui/react/input"] },
  NumberField: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/number-field"] },
  Input: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/input"] },
  Group: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/input", "@base-ui/react/field"] },
  Label: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/field"] },
  Text: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/field"] },
  FieldError: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/field"] },
  Form: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/form"] },
  ListBox: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/select", "@base-ui/react/combobox"] },
  ListBoxItem: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/select", "@base-ui/react/combobox"] },
  TagGroup: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/combobox"] },
  Tag: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/combobox"] },
  Calendar: { strategy: "NEEDS_RESEARCH", target: [] },
  RangeCalendar: { strategy: "NEEDS_RESEARCH", target: [] },
  DateField: { strategy: "NEEDS_RESEARCH", target: [] },
  DatePicker: { strategy: "NEEDS_RESEARCH", target: [] },
  DateInput: { strategy: "NEEDS_RESEARCH", target: [] },
  DateSegment: { strategy: "NEEDS_RESEARCH", target: [] },
  CalendarCell: { strategy: "NEEDS_RESEARCH", target: [] },
  CalendarGrid: { strategy: "NEEDS_RESEARCH", target: [] },
  Table: { strategy: "NEEDS_RESEARCH", target: [] },
  Tree: { strategy: "NEEDS_RESEARCH", target: [] },
  Disclosure: { strategy: "DIRECT_BASE_UI_EQUIVALENT", target: ["@base-ui/react/collapsible", "@base-ui/react/accordion"] },
  Link: { strategy: "NATIVE_REPLACEMENT", target: [] },
  Separator: { strategy: "NATIVE_REPLACEMENT", target: ["@base-ui/react/separator"] },
  // Hooks / state utilities
  useControlledState: { strategy: "INTERNAL_HELPER", target: [] },
  useFilter: { strategy: "INTERNAL_HELPER", target: [] },
  useLocale: { strategy: "INTERNAL_HELPER", target: ["@base-ui/react/direction-provider"] },
  useDateFormatter: { strategy: "INTERNAL_HELPER", target: [] },
  useFocusManager: { strategy: "INTERNAL_HELPER", target: [] },
  useSlottedContext: { strategy: "INTERNAL_HELPER", target: [] },
  filterDOMProps: { strategy: "INTERNAL_HELPER", target: ["@base-ui/react/merge-props"] },
  useListData: { strategy: "INTERNAL_HELPER", target: [] },
  Pressable: { strategy: "BASE_UI_COMPOSITION", target: ["@base-ui/react/use-render"] },
};

const CLASSIFY = {
  DIRECT_BASE_UI_EQUIVALENT: "DIRECT_BASE_UI_EQUIVALENT",
  BASE_UI_COMPOSITION: "BASE_UI_COMPOSITION",
  NATIVE_REPLACEMENT: "NATIVE_REPLACEMENT",
  INTERNAL_HELPER: "INTERNAL_HELPER",
  NEEDS_RESEARCH: "NEEDS_RESEARCH",
};

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(path);
    if (!/\.(tsx|ts)$/.test(entry.name)) return [];
    const relative = path.replace(/^\.\//, "");
    if (EXCLUDED.some((re) => re.test(relative))) return [];
    return [relative];
  });

const registry = JSON.parse(readFileSync(".design-compiler/registry/index.json", "utf8"));
const fileToItems = new Map();
for (const entry of registry.items) {
  const file = `.design-compiler/registry/${entry.id}.json`;
  if (!existsSync(file)) continue;
  const item = JSON.parse(readFileSync(file, "utf8"));
  for (const f of item.files ?? []) {
    const list = fileToItems.get(f.path) ?? [];
    list.push({ id: entry.id, kind: f.kind, layer: entry.layer });
    fileToItems.set(f.path, list);
  }
}

const files = SURFACE_DIRS.flatMap((dir) => (existsSync(dir) ? walk(dir) : []));
const entries = [];
const symbolCounts = new Map();
const packageCounts = new Map();

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const imports = [...source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g)]
    .map((m) => ({ typeOnly: Boolean(m[1]), symbols: m[2], package: m[3] }))
    .filter((i) => RA_PACKAGES.some((re) => re.test(i.package)));
  if (imports.length === 0) continue;

  const symbols = [];
  for (const statement of imports) {
    for (const raw of statement.symbols.split(",").map((s) => s.trim()).filter(Boolean)) {
      const [original, alias] = raw.replace(/^type\s+/, "").split(/\s+as\s+/).map((s) => s.trim());
      const local = alias ?? original;
      const mapped = STRATEGY[original];
      const usedInJsx = new RegExp(`<${local}[\\s/>]`).test(source) || new RegExp(`\\b${local}\\(`).test(source);
      const typeUsedOnly = statement.typeOnly || new RegExp(`:\\s*${local}(Props|\\[|\\s|;|,|>)`).test(source);
      const classification =
        statement.typeOnly || (typeUsedOnly && !usedInJsx)
          ? "TYPE_ONLY"
          : mapped
            ? CLASSIFY[mapped.strategy]
            : /^use[A-Z]/.test(original)
              ? "INTERNAL_HELPER"
              : "NEEDS_RESEARCH";
      symbols.push({
        symbol: original,
        local,
        package: statement.package,
        typeOnly: statement.typeOnly,
        usedInJsx,
        classification,
        target: mapped?.target ?? [],
        research: classification === "NEEDS_RESEARCH",
      });
      symbolCounts.set(original, (symbolCounts.get(original) ?? 0) + 1);
      packageCounts.set(statement.package, (packageCounts.get(statement.package) ?? 0) + 1);
    }
  }

  const owners = (fileToItems.get(file) ?? []).map((o) => o.id);
  entries.push({
    file,
    surface: file.startsWith("src/") ? "app" : "payload",
    publicItems: owners,
    packages: [...new Set(imports.map((i) => i.package))],
    symbols,
    importsRemoved: symbols.length,
  });
}

const byClassification = {};
for (const entry of entries) {
  for (const symbol of entry.symbols) byClassification[symbol.classification] = (byClassification[symbol.classification] ?? 0) + 1;
}

const inventory = {
  $schema: "design-compiler/BaseUiMigrationInventory@p0",
  baseUiVersion: "1.8.0",
  surface: { dirs: SURFACE_DIRS, excluded: EXCLUDED.map(String) },
  totals: {
    files: entries.length,
    importStatements: [...packageCounts.values()].reduce((a, b) => a + b, 0),
    symbols: [...symbolCounts.values()].reduce((a, b) => a + b, 0),
    distinctSymbols: symbolCounts.size,
    publicItemsAffected: [...new Set(entries.flatMap((e) => e.publicItems))].length,
    filesWithoutRegistryOwner: entries.filter((e) => e.publicItems.length === 0).map((e) => e.file),
  },
  byClassification,
  byPackage: Object.fromEntries([...packageCounts.entries()].sort()),
  bySymbol: Object.fromEntries([...symbolCounts.entries()].sort((a, b) => b[1] - a[1])),
  baseUiPrimitives: baseUiComponents,
  entries: entries.sort((a, b) => a.file.localeCompare(b.file)),
};

writeFileSync(`${ROOT}/inventory.json`, JSON.stringify(inventory, null, 2));
console.log(
  JSON.stringify(
    {
      wrote: `${ROOT}/inventory.json`,
      files: inventory.totals.files,
      symbols: inventory.totals.symbols,
      distinctSymbols: inventory.totals.distinctSymbols,
      publicItemsAffected: inventory.totals.publicItemsAffected,
      byClassification: inventory.byClassification,
      byPackage: inventory.byPackage,
      baseUiPrimitives: baseUiComponents.length,
      unclassified: [...symbolCounts.keys()].filter((s) => !STRATEGY[s]).sort(),
    },
    null,
    2,
  ),
);
