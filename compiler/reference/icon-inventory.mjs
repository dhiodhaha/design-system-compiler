#!/usr/bin/env node
/**
 * Official icon / file-icon package inventory and Figma icon-family crosswalk.
 *
 *   node compiler/reference/icon-inventory.mjs [--repo /tmp/untitled-react] [--out .design-compiler/references]
 *
 * Deterministic and offline: reads only the installed packages' built declarations (`dist/*.d.ts`), the pinned
 * OSS repository's icon-like component sources, and the collected Figma surface. No network, no model calls,
 * no wall-clock fields — the same inputs produce byte-identical output. Metadata only: no package source, no
 * glyph data and no Figma payload is copied anywhere.
 *
 * Outputs
 *   .design-compiler/references/untitledui/icon-inventory.json   machine-readable inventory
 *   .design-compiler/references/untitledui/icon-inventory-summary.md   compact human summary
 *
 * Buckets (see `ruleTable` in the artifact):
 *   packages[]                 official free/pro package surface, OSS vs licensed kept apart
 *   localOssIconComponents[]   icon-like components shipped in the pinned OSS repo (MIT)
 *   figmaMapping.perPage       per Figma page: families, resolution buckets, unresolved
 *   unresolvedClassifications[]  every unresolved family with the deterministic rule that fired
 *   licensing                  redistribution boundaries
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const REPO = resolve(args.repo ?? "/tmp/untitled-react");
const OUT = resolve(args.out ?? ".design-compiler/references");
const LIB = "untitledui";
const FIGMA_PATH = resolve(OUT, "figma", "figma-surface.json");
const OSS_INDEX_PATH = resolve(OUT, LIB, "index.json");
const EXTERNAL_PATH = resolve(OUT, LIB, "external-packages.json");

// ------------------------------------------------------------------ deterministic name algebra
const camelToKebab = (s) => String(s ?? "").replace(/([a-z0-9])([A-Z])/g, "$1-$2");
/** camelCase / digit-aware normalization: "AlignTopArrow01" and "align-top-arrow-01" collapse to one key. */
const norm = (s) =>
  camelToKebab(s)
    .replace(/([A-Za-z])([0-9])/g, "$1-$2")
    .replace(/([0-9])([A-Za-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const alnum = (s) => norm(s).replace(/-/g, "");
const tokens = (s) => new Set(norm(s).split("-").filter((t) => t.length > 1));
/** presence/state qualifiers carry no family identity: "Star icon" -> "star", "Folder icon" -> "folder". */
const QUALIFIERS = new Set(["icon", "icons", "outline", "solid", "filled", "fill", "line", "linear", "simple", "asset", "alt", "default", "style", "styles"]);
const STOP_TOKENS = new Set([
  "icon", "icons", "asset", "assets", "set", "sets", "shared", "index", "story", "stories", "demo", "demos", "test", "tests",
  "mockup", "mockups", "pattern", "patterns", "line", "lines", "style", "styles", "simple", "default", "background", "backgrounds",
  "illustration", "illustrations", "symbol", "symbols", "mark", "marks", "brand", "brands", "logo", "logos", "press", "company",
  "outline", "solid", "filled", "gradient", "light", "dark", "gray",
]);
const COMPOSITE_TOKENS = new Set(["item", "text", "badge", "row", "table", "chart", "graph", "avatar", "modal", "nav", "header", "footer", "button", "input", "select", "banner", "tooltip", "tab", "tabs"]);
/** axes that only vary appearance — a component set over them is the styled wrapper of an existing glyph. */
const STYLE_AXES = new Set(["Color", "Fill", "Size", "Style", "Outline", "Dark mode", "Grayscale", "Background", "Theme", "Lines", "State", "Breakpoint", "Mode", "Direction", "Line"]);
/** scale-only export names (illustration sizes) and axis values: identity-free, excluded from resolution evidence. */
const SCALE_TOKENS = new Set(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "xxs", "true", "false", "none", "empty", "default"]);

const stemOf = (name) => norm(String(name).split("/").pop()).split("-").filter((t) => !QUALIFIERS.has(t)).join("-");
const specificTokens = (s) => new Set([...tokens(s)].filter((t) => !STOP_TOKENS.has(t) && !QUALIFIERS.has(t)));
const isScaleOnly = (name) => SCALE_TOKENS.has(norm(name));

// ------------------------------------------------------------------ generic readers
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

/** Names exported from a barrel `.d.ts`: `export { A, B as C } from "..."` + `export type { D }`. */
function parseDeclarationExports(file) {
  const src = readFileSync(file, "utf8");
  const values = [];
  const types = [];
  for (const m of src.matchAll(/export\s+(type\s+)?\{([^}]*)\}(?:\s*from\s*['"][^'"]+['"])?/g)) {
    const isType = Boolean(m[1]);
    const inlineType = /^\s*type\s/.test(m[2]);
    for (const part of m[2].split(",")) {
      const clause = part.trim().replace(/^type\s+/, "");
      if (!clause) continue;
      const name = clause.split(/\s+as\s+/).pop().trim();
      if (!name || name === "default") continue;
      (isType || inlineType ? types : values).push(name);
    }
  }
  return { values, types, source: src };
}

/** Value + type exports declared inside one OSS source file. */
function parseSourceExports(file) {
  const src = readFileSync(file, "utf8");
  const values = new Set();
  const types = new Set();
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
    for (const part of m[1].split(",")) {
      const clause = part.trim().replace(/^type\s+/, "");
      const name = clause.split(/\s+as\s+/).pop().trim();
      if (name && name !== "default") (clause.startsWith("type ") ? types : values).add(name);
    }
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g)) values.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:interface|type)\s+([A-Za-z0-9_$]+)/g)) types.add(m[1]);
  for (const m of src.matchAll(/export\s+default\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g)) values.add(m[1]);
  // bare identifier default export: `export default AmexIcon;`
  for (const m of src.matchAll(/export\s+default\s+([A-Za-z0-9_$]+)\s*;/g)) values.add(m[1]);
  return { values: [...values].sort(), types: [...types].sort() };
}

// ------------------------------------------------------------------ §1 package surface
const PACKAGES = [
  { name: "@untitledui/icons", role: "line/solid icon set (React components)", typesPath: "dist/index.d.ts", distDir: "dist" },
  { name: "@untitledui/file-icons", role: "file type icon set (single FileIcon component + type table)", typesPath: "dist/index.d.ts", distDir: "dist" },
];
const declaredRange = (() => {
  if (!existsSync(EXTERNAL_PATH)) return new Map();
  const ext = readJson(EXTERNAL_PATH);
  return new Map((ext.packages ?? []).map((p) => [p.name, p.declaredRange]));
})();
/** SUPPORTED_FILE_TYPES is the file-icons public type table — the resolvable file-type vocabulary. */
function parseFileIconTypes(declSrc) {
  const m = declSrc.match(/declare\s+const\s+SUPPORTED_FILE_TYPES:\s*readonly\s*\[([^\]]*)\]/);
  if (!m) return { count: 0, names: [] };
  const names = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  return { count: names.length, names };
}

const packageRecords = [];
let fileIconTypes = { count: 0, names: [] };
for (const pkg of PACKAGES) {
  const dir = resolve("node_modules", pkg.name);
  const installed = existsSync(join(dir, "package.json"));
  const manifest = installed ? readJson(join(dir, "package.json")) : {};
  const typesAbs = join(dir, pkg.typesPath);
  const parsed = installed && existsSync(typesAbs) ? parseDeclarationExports(typesAbs) : { values: [], types: [], source: "" };
  const allFiles = installed ? walk(join(dir, pkg.distDir)) : [];
  const declFiles = allFiles.filter((f) => f.endsWith(".d.ts"));
  const declModuleFiles = allFiles.filter((f) => f.endsWith(".d.mts"));
  const distDirs = installed
    ? [...new Set(allFiles.map((f) => relative(join(dir, pkg.distDir), f).split("/").slice(0, -1).join("/")).filter(Boolean))].sort()
    : [];
  /** every name declared anywhere under dist/*.d.ts (deep-import surface), not just the barrel */
  const declarationUnion = [...new Set(declFiles.flatMap((f) => {
    const d = parseDeclarationExports(f);
    return [...d.values, ...d.types];
  }))].sort();
  const isTypeModule = (f) =>
    !relative(join(dir, pkg.distDir), f).includes("/") && !["index.d.ts", "FileIcon.d.ts", "iconImports.d.ts"].includes(basename(f));
  const typeModules = declFiles.filter(isTypeModule).map((f) => basename(f, ".d.ts")).sort();
  const licenseFiles = installed
    ? ["LICENSE", "LICENSE.md", "LICENSE.txt"].filter((f) => existsSync(join(dir, f))).map((f) => {
        const text = readFileSync(join(dir, f), "utf8");
        return {
          path: `${pkg.name}/${f}`,
          present: true,
          sha256: sha256(text),
          restrictions: [...text.matchAll(/^\s*[•*-]\s*(You are not allowed[^\n]*|Sell[^\n]*|Create[^\n]*|Use the icons[^\n]*)$/gm)].map((x) => x[1].trim()),
        };
      })
    : [];
  let fileTypes = { count: 0, names: [] };
  if (pkg.name === "@untitledui/file-icons" && installed) {
    const fileIconDecl = readFileSync(join(dir, "dist", "FileIcon.d.ts"), "utf8");
    fileTypes = parseFileIconTypes(fileIconDecl);
    fileIconTypes = fileTypes;
  }
  packageRecords.push({
    name: pkg.name,
    role: pkg.role,
    installed,
    distribution: "free-package",
    ...(pkg.name === "@untitledui/icons" ? { ossTier: "FREE_ICON_LIBRARY" } : { ossTier: "FREE_FILE_ICON_LIBRARY" }),
    resolvedVersion: manifest.version ?? null,
    declaredRange: declaredRange.get(pkg.name) ?? null,
    description: manifest.description ?? null,
    licenseField: manifest.license ?? null,
    licenseFiles,
    licenseFilePresent: licenseFiles.length > 0,
    distFileCount: allFiles.length,
    declarationFileCount: declFiles.length,
    topLevelDeclarationFileCount: declFiles.filter((f) => !relative(join(dir, pkg.distDir), f).includes("/")).length,
    declarationModuleFileCount: declModuleFiles.length,
    distSubdirectories: distDirs,
    entryTypesPath: `${pkg.name}/${pkg.typesPath}`,
    entryExportCount: parsed.values.length + parsed.types.length,
    entryValueExportCount: parsed.values.length,
    entryTypeExportCount: parsed.types.length,
    declarationExportCount: declarationUnion.length,
    exportsSample: {
      mode: declarationUnion.length > parsed.values.length ? "first-10-declaration-union-alphabetical" : "first-10-entry-declaration-order",
      names: (declarationUnion.length > parsed.values.length ? declarationUnion : parsed.values).slice(0, 10),
    },
    ...(pkg.name === "@untitledui/file-icons"
      ? {
          fileTypeTable: { name: "SUPPORTED_FILE_TYPES", count: fileTypes.count, names: fileTypes.names, variantDirectories: distDirs },
          typeModules: { count: typeModules.length, names: typeModules, note: "one declaration module per file type; the gray/solid variant trees re-declare the same component names" },
        }
      : {}),
    evidence: { entryTypesSha256: installed && parsed.source ? sha256(parsed.source) : null },
  });
}
const iconsExports = parseDeclarationExports(resolve("node_modules", "@untitledui/icons", "dist/index.d.ts")).values;
const iconsIndex = new Map();
for (const n of iconsExports) {
  iconsIndex.set(norm(n), n);
  iconsIndex.set(alnum(n), n);
}
const fileIconNames = (() => {
  const dist = resolve("node_modules", "@untitledui/file-icons", "dist");
  if (!existsSync(dist)) return [];
  return readdirSync(dist)
    .filter((f) => f.endsWith(".d.ts"))
    .map((f) => basename(f, ".d.ts"))
    .filter((n) => !["index", "FileIcon"].includes(n));
})();
const fileIconIndex = new Map();
for (const n of [...fileIconTypes.names, ...fileIconNames]) {
  fileIconIndex.set(norm(n), n);
  fileIconIndex.set(alnum(n), n);
}

// ------------------------------------------------------------------ §2 local OSS icon-like components
const LOCAL_SOURCES = [
  { source: "components/foundations/payment-icons", family: "payment method marks", iconClass: "PAYMENT_BRAND_ICON" },
  { source: "components/foundations/social-icons", family: "social network marks", iconClass: "SOCIAL_BRAND_ICON" },
  { source: "components/foundations/integration-icons", family: "integration/product marks", iconClass: "INTEGRATION_BRAND_ICON" },
  { source: "components/foundations/featured-icon", family: "featured icon container", iconClass: "ICON_CONTAINER" },
  { source: "components/foundations/dot-icon.tsx", family: "dot status glyph", iconClass: "ICON_PRIMITIVE" },
  { source: "components/shared-assets", family: "shared artwork assets", iconClass: "MIXED_ASSET" },
];
/** per-file asset class inside shared-assets; other sources carry their source-level iconClass. */
const ASSET_CLASS_RULES = [
  [/shared-assets\/background-patterns\//, "BACKGROUND_PATTERN_ASSET"],
  [/shared-assets\/credit-card\//, "CARD_MOCKUP_ASSET"],
  [/shared-assets\/illustrations\//, "ILLUSTRATION_ASSET"],
  [/shared-assets\/iphone-mockup\.tsx$/, "DEVICE_MOCKUP_ASSET"],
  [/shared-assets\/qr-code\.tsx$/, "UTILITY_ASSET"],
  [/shared-assets\/section-divider\.tsx$/, "DECORATIVE_ASSET"],
  [/(^|\/)index\.tsx$/, "BARREL"],
];
const assetClassOf = (rel, fallback) => (ASSET_CLASS_RULES.find(([re]) => re.test(rel)) ?? [null, fallback])[1];

const localOssIconComponents = [];
const localExportIndex = new Map();
/** stem -> exported component name, e.g. "paypal" -> PaypalIcon (evidence only). */
const localExportStems = new Map();
const localSourceStems = new Set();
/** brand stems -> local source file, e.g. "paypal" (paypal-icon.tsx), "google-pay" (google-pay-icon.tsx). */
const localBrandStems = new Map();
const localAddBrand = (name, rel) => {
  const stem = stemOf(name);
  if (stem && !SCALE_TOKENS.has(stem) && !localBrandStems.has(stem)) localBrandStems.set(stem, rel);
};
const ossLicensePath = join(REPO, "LICENSE");
const ossLicenseText = existsSync(ossLicensePath) ? readFileSync(ossLicensePath, "utf8") : "";
const ossLicense = ossLicenseText.split("\n")[0].trim() || null;
for (const src of LOCAL_SOURCES) {
  const abs = join(REPO, src.source);
  if (!existsSync(abs)) continue;
  const isDir = statSync(abs).isDirectory();
  const files = (isDir ? walk(abs) : [abs])
    .map((f) => relative(REPO, f))
    .filter((f) => f.endsWith(".tsx") && !/\.(story|demo)\.tsx$/.test(f));
  const fileRecords = [];
  for (const rel of files) {
    const { values, types } = parseSourceExports(join(REPO, rel));
    const sizeVariants = values.filter(isScaleOnly);
    const identityExports = values.filter((v) => !isScaleOnly(v));
    fileRecords.push({
      path: rel,
      assetClass: assetClassOf(rel, src.iconClass),
      exportCount: identityExports.length,
      exports: identityExports,
      ...(sizeVariants.length ? { sizeVariantExports: sizeVariants } : {}),
      ...(types.length ? { typeExports: types } : {}),
    });
    for (const n of identityExports) {
      localExportIndex.set(norm(n), n);
      localExportIndex.set(alnum(n), n);
      const s = stemOf(n);
      if (s && !localExportStems.has(s)) localExportStems.set(s, n);
    }
    // brand stems from the file that declares the component ("paypal-icon" -> paypal); barrels only re-export
    if (!/(^|\/)index\.tsx$/.test(rel)) {
      localAddBrand(basename(rel, ".tsx"), rel);
      for (const e of identityExports) localAddBrand(e, rel);
    }
    for (const t of tokens(rel.split("/").slice(0, -1).join("/"))) if (!STOP_TOKENS.has(t)) localSourceStems.add(t);
  }
  const exports = [...new Set(fileRecords.flatMap((f) => f.exports))].sort();
  const sizeVariantExports = [...new Set(fileRecords.flatMap((f) => f.sizeVariantExports ?? []))].sort();
  localOssIconComponents.push({
    id: src.source.replace(/^components\//, "").replace(/\.tsx$/, "").replace(/\//g, "."),
    source: src.source,
    family: src.family,
    iconClass: src.iconClass,
    license: "MIT",
    licenseEvidence: `${ossLicensePath} — ${ossLicense ?? "license file unreadable"}`,
    fileCount: fileRecords.length,
    exportCount: exports.length,
    exports,
    ...(sizeVariantExports.length ? { sizeVariantExports, sizeVariantNote: "scale-only exports (illustration sizes); listed as file exports but excluded from name resolution" } : {}),
    files: fileRecords,
  });
}
// source-family stems: directory names of the local sources + official package names
for (const t of [...LOCAL_SOURCES.map((s) => s.source), ...PACKAGES.map((p) => p.name)])
  for (const tok of tokens(t)) if (!STOP_TOKENS.has(tok)) localSourceStems.add(tok);

// ------------------------------------------------------------------ §3 Figma crosswalk
const surface = readJson(FIGMA_PATH);
const FIGMA_PAGES = [
  { id: "3463:407484", key: "Icon set (library icons)" },
  { id: "1025:31781", key: "Misc icons (app/flag/asset icon sets)" },
  { id: "1083:118533", key: "Brand & press logos" },
  { id: "4938:371336", key: "Background decoration" },
  { id: "1291:157819", key: "Miscellaneous artwork assets" },
];
const cleanPage = (n) => String(n ?? "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
const kindById = new Map((surface.iconLikeFamilies ?? []).map((f) => [f.id, f]));

const resolveFamily = (name) => {
  const k = norm(name);
  const a = alnum(name);
  if (iconsIndex.has(k) || iconsIndex.has(a)) return { bucket: "icons", matched: iconsIndex.get(k) ?? iconsIndex.get(a) };
  if (fileIconIndex.has(k) || fileIconIndex.has(a)) return { bucket: "fileIcons", matched: fileIconIndex.get(k) ?? fileIconIndex.get(a) };
  if (localExportIndex.has(k) || localExportIndex.has(a)) return { bucket: "localOss", matched: localExportIndex.get(k) ?? localExportIndex.get(a) };
  return null;
};

const perPage = [];
const unresolved = [];
const totals = { pages: FIGMA_PAGES.length, families: 0, resolvedToIcons: 0, resolvedToFileIcons: 0, resolvedToLocalOss: 0, unresolved: 0, unresolvedProOnlyCandidates: 0 };
for (const page of FIGMA_PAGES) {
  const families = (surface.families ?? []).filter((f) => f.page === page.id).map((f) => ({ ...f, kind: kindById.get(f.id)?.kind ?? null, category: kindById.get(f.id)?.category ?? null }));
  const pageName = cleanPage(surface.pages?.find((p) => p.id === page.id)?.name ?? families[0]?.pageName ?? page.id);
  const bucket = { icons: [], fileIcons: [], localOss: [] };
  const pageUnresolved = [];
  for (const fam of families) {
    const hit = resolveFamily(fam.name);
    if (hit) bucket[hit.bucket].push([fam.name, hit.matched]);
    else pageUnresolved.push(fam);
  }
  unresolved.push(...pageUnresolved.map((f) => ({ ...f, pageId: page.id, pageName })));
  const proOnlyOnPage = pageUnresolved.filter((f) => ["3463:407484", "1025:31781"].includes(page.id)).length;
  perPage.push({
    pageId: page.id,
    pageName,
    pageKey: page.key,
    familyCount: families.length,
    resolvedToIcons: bucket.icons.length,
    resolvedToFileIcons: bucket.fileIcons.length,
    resolvedToLocalOss: bucket.localOss.length,
    unresolved: pageUnresolved.length,
    unresolvedProOnlyCandidates: proOnlyOnPage,
    resolvedFamilies: { icons: bucket.icons, fileIcons: bucket.fileIcons, localOss: bucket.localOss },
    unresolvedSample: pageUnresolved.slice(0, 10).map((f) => f.name),
    kindBreakdown: Object.fromEntries(
      Object.entries(pageUnresolved.reduce((acc, f) => ((acc[f.kind ?? "unknown"] = (acc[f.kind ?? "unknown"] ?? 0) + 1), acc), {})).sort(([a], [b]) => a.localeCompare(b)),
    ),
  });
  totals.families += families.length;
  totals.resolvedToIcons += bucket.icons.length;
  totals.resolvedToFileIcons += bucket.fileIcons.length;
  totals.resolvedToLocalOss += bucket.localOss.length;
  totals.unresolved += pageUnresolved.length;
  totals.unresolvedProOnlyCandidates += proOnlyOnPage;
}

// ------------------------------------------------------------------ §4 unresolved classification
const axisNames = (fam) => Object.keys(fam.axes ?? {});
const axisValues = (fam) => Object.values(fam.axes ?? {}).flatMap((a) => a.values ?? []);
const numberedExports = (stem) => iconsExports.filter((n) => new RegExp(`^${stem}-\\d+$`).test(norm(n)));
/** stem -> declaration name, so axis values ("React") can be matched to "ReactIcon" without weakening resolution. */
const stemIndexOf = (names) => {
  const index = new Map();
  for (const n of names) {
    const s = stemOf(n);
    if (s && !SCALE_TOKENS.has(s) && s !== norm(n)) index.set(s, n);
  }
  return index;
};
const iconsStemIndex = stemIndexOf(iconsExports);
const fileIconStemIndex = stemIndexOf([...fileIconTypes.names, ...fileIconNames]);
const localStemIndex = stemIndexOf([...new Set(localOssIconComponents.flatMap((s) => s.exports))]);
/** variant-axis values that name a real package/local component (evidence that a set wraps known glyphs). */
const matchedAxisValues = (fam) => {
  const hits = [];
  for (const v of axisValues(fam)) {
    if (SCALE_TOKENS.has(norm(v))) continue;
    for (const [bucket, index] of [["icons", iconsIndex], ["fileIcons", fileIconIndex], ["localOss", localExportIndex]])
      if (index.has(norm(v)) || index.has(alnum(v))) hits.push({ value: v, matched: index.get(norm(v)) ?? index.get(alnum(v)), bucket });
    for (const [bucket, index] of [["icons", iconsStemIndex], ["fileIcons", fileIconStemIndex], ["localOss", localStemIndex]])
      if (index.has(stemOf(v))) hits.push({ value: v, matched: index.get(stemOf(v)), bucket });
  }
  return hits;
};

const RULES = [
  { id: "internal-underscore-prefix", classification: "HELPER_OR_INTERNAL", description: "Figma family name starts with \"_\": the PRO file marks library-internal helper layers this way (e.g. _Background mask, _iPhone mockup status bar)." },
  { id: "composite-not-icon", classification: "NON_ICON_ASSET", description: "Family name carries a composite-UI token (item/text/badge/row/table/chart/nav/button/input/...): it is a component or block, not an icon. App-icon and flag-icon families are exempt: their names are brand marks, not UI parts." },
  { id: "qualifier-stripped-stem-package-export", classification: "DUPLICATE_OF_RESOLVED", description: "After dropping presence qualifiers (icon/outline/solid/filled/line/...), the stem equals an exact @untitledui/icons export." },
  { id: "qualifier-stripped-stem-file-icon-type", classification: "DUPLICATE_OF_RESOLVED", description: "After dropping presence qualifiers the stem equals a @untitledui/file-icons type (SUPPORTED_FILE_TYPES or a shipped type module)." },
  { id: "stem-token-source-family", classification: "DUPLICATE_OF_RESOLVED", description: "A specific family-stem token equals a local OSS icon/asset source family (payment-icons, social-icons, integration-icons, featured-icon, dot-icon, shared-assets, or an official package name): the PRO set is the styled wrapper of a source already shipped in the pinned repo." },
  { id: "brand-stem-local-component", classification: "DUPLICATE_OF_RESOLVED", description: "App-icon brand mark whose qualifier-stripped stem equals the stem of a brand component shipped locally in one of the six OSS icon sources (paypal -> paypal-icon.tsx / PaypalIcon)." },
  { id: "numbered-package-family-style-wrapper", classification: "DUPLICATE_OF_RESOLVED", description: "Stem has a numbered package family (<stem>-01..) and the set has variant axes that only vary appearance: the PRO set duplicates that numbered glyph family." },
  { id: "page-icon-surface-unresolved", classification: "PRO_ONLY_ICON_CANDIDATE", description: "Unresolved icon-shaped family on an icon page (Icons / Misc icons) with no free-package or local OSS equivalent: candidate for the licensed PRO icon surface only." },
  { id: "page-logos-brand-asset", classification: "NON_ICON_ASSET", description: "Family lives on the Logos page: brand/press/company logos are artwork assets, not icon-set members." },
  { id: "page-background-decor-asset", classification: "NON_ICON_ASSET", description: "Family lives on the Background elements page: decorative patterns, masks and overlays." },
  { id: "page-misc-asset-decor", classification: "NON_ICON_ASSET", description: "Family lives on the Miscellaneous assets page: mockups, hand-drawn decorations and dividers." },
  { id: "default-not-an-icon", classification: "NON_ICON_ASSET", description: "Fallback: no icon evidence for this family (no rule above fired)." },
];
const ICON_PAGES = new Set(["3463:407484", "1025:31781"]);
const PAGE_ASSET_RULES = { "1083:118533": "page-logos-brand-asset", "4938:371336": "page-background-decor-asset", "1291:157819": "page-misc-asset-decor" };

const classify = (fam) => {
  const name = String(fam.name ?? "");
  const stem = stemOf(name);
  const stemTokens = specificTokens(stem);
  const axisHits = matchedAxisValues(fam);
  const axisEvidence = { axisValueMatches: axisHits.slice(0, 6), axisValueMatchCount: axisHits.length };
  if (name.startsWith("_")) return { rule: "internal-underscore-prefix", evidence: {} };
  const compositeHit = ["app-icon", "flag-icon"].includes(fam.kind) ? [] : [...tokens(name)].filter((t) => COMPOSITE_TOKENS.has(t));
  if (compositeHit.length) return { rule: "composite-not-icon", evidence: { tokens: compositeHit } };
  if (iconsIndex.has(stem)) return { rule: "qualifier-stripped-stem-package-export", evidence: { matched: iconsIndex.get(stem), strippedStem: stem } };
  if (fileIconIndex.has(stem)) return { rule: "qualifier-stripped-stem-file-icon-type", evidence: { matched: fileIconIndex.get(stem), strippedStem: stem } };
  const sourceHit = [...stemTokens].filter((t) => localSourceStems.has(t));
  if (sourceHit.length) return { rule: "stem-token-source-family", evidence: { tokens: sourceHit, ...axisEvidence } };
  if (fam.kind === "app-icon" && localBrandStems.has(stem)) {
    return {
      rule: "brand-stem-local-component",
      evidence: { strippedStem: stem, matchedLocal: [localBrandStems.get(stem)], matchedExport: localExportStems.get(stem) ?? null },
    };
  }
  const numbered = numberedExports(stem);
  const axes = axisNames(fam);
  if (numbered.length && axes.length && axes.every((a) => STYLE_AXES.has(a)))
    return { rule: "numbered-package-family-style-wrapper", evidence: { numberedFamily: numbered.slice(0, 6), axes } };
  if (ICON_PAGES.has(fam.pageId)) return { rule: "page-icon-surface-unresolved", evidence: { kind: fam.kind, category: fam.category ?? null, ...axisEvidence } };
  if (PAGE_ASSET_RULES[fam.pageId]) return { rule: PAGE_ASSET_RULES[fam.pageId], evidence: { axes, variants: fam.variantCount ?? 0 } };
  return { rule: "default-not-an-icon", evidence: {} };
};

const unresolvedClassifications = unresolved
  .map((fam) => {
    const { rule, evidence } = classify(fam);
    const entry = RULES.find((r) => r.id === rule);
    return {
      name: fam.name,
      pageId: fam.pageId,
      pageName: fam.pageName,
      kind: fam.kind ?? null,
      category: fam.category ?? null,
      type: fam.type ?? null,
      variants: fam.variantCount ?? 0,
      classification: entry.classification,
      rule,
      evidence,
    };
  })
  .sort((a, b) => a.pageId.localeCompare(b.pageId) || a.classification.localeCompare(b.classification) || a.name.localeCompare(b.name));

const byClassification = {};
const byRule = {};
for (const u of unresolvedClassifications) {
  byClassification[u.classification] = (byClassification[u.classification] ?? 0) + 1;
  byRule[u.rule] = (byRule[u.rule] ?? 0) + 1;
}
totals.unresolvedProOnlyCandidates = unresolvedClassifications.filter((u) => u.classification === "PRO_ONLY_ICON_CANDIDATE").length;
for (const p of perPage) p.unresolvedProOnlyCandidates = unresolvedClassifications.filter((u) => u.pageId === p.pageId && u.classification === "PRO_ONLY_ICON_CANDIDATE").length;

// ------------------------------------------------------------------ §5 licensing
const iconsLic = packageRecords.find((p) => p.name === "@untitledui/icons");
const licensing = {
  separation: "OSS (free) and PRO (licensed) surfaces are inventoried separately and never merged: every entry carries its distribution.",
  freePackageSurface: {
    packages: packageRecords.map((p) => ({ name: p.name, version: p.resolvedVersion, licenseField: p.licenseField, licenseFilePresent: p.licenseFilePresent, entryTypesPath: p.entryTypesPath })),
    redistribution: "REDISTRIBUTABLE_AS_NPM_DEPENDENCY",
    statement: "The free packages may be consumed and redistributed only as an installed npm dependency (the pinned repo's own usage pattern). They must not be vendored into this repository or re-published as icon libraries.",
    iconArtworkRestriction: iconsLic?.licenseFiles?.[0]?.restrictions ?? [],
    iconArtworkStatement: iconsLic?.licenseFiles?.length
      ? "The @untitledui/icons package declares \"MIT\" in package.json, but its shipped LICENSE file restricts the icon artwork itself: no selling/sublicensing/distributing the icons in original or modified form, no derivative icon libraries, no use in resale UI kits, libraries or templates. Treat the shipped LICENSE as the governing terms for the artwork."
      : "No shipped LICENSE file was found; only the package.json license field is available.",
  },
  proIconSurface: {
    source: "PRO Figma file (licensed). Icon-page families that resolve to no free package and no local OSS component (see PRO_ONLY_ICON_CANDIDATE) belong to the licensed surface.",
    redistribution: "NEVER_REDISTRIBUTE",
    statement: "PRO icon families and their variants, glyph artwork and page payloads are licensed content: they must not be redistributed, vendored, published, or committed. PRO icon packages, if ever obtained, stay separate npm/licensed artifacts and are not part of this repository.",
    proOnlyCandidates: totals.unresolvedProOnlyCandidates,
  },
  localExtractions: {
    redistribution: "PRIVATE_ONLY",
    statement: "Any local extraction of a PRO-only icon (SVG path data, variant matrices, per-glyph exports) is private build input: it may exist only under the git-ignored local reference tree (.design-compiler/raw, .design-compiler/reference) and must never be committed, published, or re-exported as a public icon package.",
    publicArtifactsMayCarry: "names, counts and license/redistribution metadata only — no glyph data, no package source, no Figma payload",
  },
  localOssSurface: {
    source: `pinned OSS repo (${REPO})`,
    license: ossLicense,
    redistribution: "MIT (see the pinned repo's LICENSE)",
    components: localOssIconComponents.map((s) => ({ id: s.id, source: s.source, iconClass: s.iconClass, license: s.license, exportCount: s.exportCount })),
  },
  statements: [
    { id: "L1", level: "REQUIRED", statement: "free packages: dependency-only, no vendoring of package source or icon artwork", source: "@untitledui/icons + @untitledui/file-icons package LICENSE" },
    { id: "L2", level: "REQUIRED", statement: "PRO icon families are licensed: no redistribution, no vendoring, no publication", source: "PRO Figma file license" },
    { id: "L3", level: "REQUIRED", statement: "local extractions of PRO-only icons remain private-only (git-ignored local trees), metadata-only in public artifacts", source: "repository policy (.gitignore notes on Figma source artifacts)" },
    { id: "L4", level: "REQUIRED", statement: "OSS icon-like components shipped in the pinned repo are MIT and stay attributed to that repo; this inventory records names/counts only", source: "/tmp/untitled-react/LICENSE" },
  ],
};

// ------------------------------------------------------------------ artifact assembly
const ossIndex = existsSync(OSS_INDEX_PATH) ? readJson(OSS_INDEX_PATH) : null;
const artifact = {
  $schema: "design-compiler/IconInventory@p0",
  library: LIB,
  revision: ossIndex?.revision ?? null,
  scope: {
    ossRepo: REPO,
    packages: PACKAGES.map((p) => p.name),
    localOssSources: LOCAL_SOURCES.map((s) => s.source),
    figmaPages: FIGMA_PAGES,
    deterministic: "inputs only: installed dist/*.d.ts, pinned OSS sources, collected Figma surface; no network, no model calls, no wall-clock fields",
  },
  sources: {
    figma: { path: relative(process.cwd(), FIGMA_PATH), fileKey: surface.fileKey ?? null, fileName: surface.fileName ?? null, sha256: sha256(readFileSync(FIGMA_PATH)) },
    ossRepo: { path: REPO, revision: ossIndex?.revision ?? null, license: ossLicense },
    ossIndex: existsSync(OSS_INDEX_PATH) ? { path: relative(process.cwd(), OSS_INDEX_PATH), revision: ossIndex?.revision ?? null } : null,
  },
  packages: packageRecords,
  localOssIconComponents,
  localOssTotals: {
    sources: localOssIconComponents.length,
    files: localOssIconComponents.reduce((n, s) => n + s.fileCount, 0),
    exports: [...new Set(localOssIconComponents.flatMap((s) => s.exports))].length,
  },
  figmaMapping: { perPage, totals },
  unresolvedClassifications,
  unresolvedSummary: {
    total: unresolvedClassifications.length,
    pages: FIGMA_PAGES.length,
    byClassification,
    byRule,
    proOnlyByKind: Object.fromEntries(
      Object.entries(
        unresolvedClassifications
          .filter((u) => u.classification === "PRO_ONLY_ICON_CANDIDATE")
          .reduce((acc, u) => ((acc[u.kind ?? "unknown"] = (acc[u.kind ?? "unknown"] ?? 0) + 1), acc), {}),
      ).sort(([a], [b]) => a.localeCompare(b)),
    ),
  },
  ruleTable: RULES,
  licensing,
  notes: [
    "Resolution is name-only (normalized exact match, camelCase/digit aware) plus the rules in ruleTable; no semantic or glyph comparison was performed.",
    "figmaMapping covers only the five icon-ish pages requested; other PRO pages are out of scope for this artifact.",
    "The pinned OSS repo ships further icon-adjacent sources outside this inventory's scope (components/foundations/logo: UntitledLogo/UntitledLogoMinimal, rating-badge.tsx, rating-stars.tsx, play-button-icon.tsx); they were not counted as localOssIconComponents here.",
    "unresolvedClassifications records the first rule that fired, in ruleTable order, so classification is reproducible and auditable.",
  ],
};

const outDir = resolve(OUT, LIB);
writeFileSync(join(outDir, "icon-inventory.json"), `${JSON.stringify(artifact, null, 2)}\n`);

// ------------------------------------------------------------------ compact markdown summary
const md = [];
md.push("# Icon inventory — official packages, local OSS icon components, Figma mapping", "");
md.push(`Packages: ${packageRecords.map((p) => `\`${p.name}@${p.resolvedVersion}\` (license field: ${p.licenseField})`).join(", ")}`);
md.push(`Local OSS icon sources: ${localOssIconComponents.length} (${artifact.localOssTotals.files} files, ${artifact.localOssTotals.exports} exports) — MIT.`);
md.push(`Figma pages in scope: ${totals.pages} / families: ${totals.families}.`, "");
md.push("## Package surface", "", "| package | version | license field | dist files | d.ts | entry exports | declared exports | sample |", "|---|---|---|---|---|---|---|---|");
for (const p of packageRecords)
  md.push(
    `| \`${p.name}\` | ${p.resolvedVersion} | ${p.licenseField}${p.licenseFilePresent ? " (+ shipped LICENSE restrictions)" : " (no LICENSE file shipped)"} | ${p.distFileCount} | ${p.declarationFileCount} | ${p.entryExportCount} | ${p.declarationExportCount} | ${p.exportsSample?.names?.slice(0, 6).join(", ") ?? ""} |`,
  );
const fileIconsPkg = packageRecords.find((p) => p.fileTypeTable);
if (fileIconsPkg)
  md.push(
    "",
    `\`@untitledui/file-icons\` ships one public entry component (\`FileIcon\`) plus ${fileIconsPkg.typeModules.count} per-type declaration modules (matching the ${fileIconsPkg.fileTypeTable.count} \`SUPPORTED_FILE_TYPES\` keys, with an internal \`iconImports\` module) and duplicate \`${fileIconsPkg.distSubdirectories.join("/")}\` variant trees; no LICENSE file is present in the published 0.0.9 tarball.`,
  );
md.push("", "## Local OSS icon components (MIT)", "", "| source | class | files | exports |", "|---|---|---|---|");
for (const s of localOssIconComponents) md.push(`| \`${s.source}\` | ${s.iconClass} | ${s.fileCount} | ${s.exportCount} |`);
md.push("", "## Figma icon-ish pages", "", "| page | families | icons | file-icons | local OSS | unresolved | PRO-only candidates |", "|---|---|---|---|---|---|---|");
for (const p of perPage)
  md.push(`| ${p.pageName} (\`${p.pageId}\`) | ${p.familyCount} | ${p.resolvedToIcons} | ${p.resolvedToFileIcons} | ${p.resolvedToLocalOss} | ${p.unresolved} | ${p.unresolvedProOnlyCandidates} |`);
md.push(`| **total** | **${totals.families}** | **${totals.resolvedToIcons}** | **${totals.resolvedToFileIcons}** | **${totals.resolvedToLocalOss}** | **${totals.unresolved}** | **${totals.unresolvedProOnlyCandidates}** |`);
md.push("", "## Unresolved families by classification", "", "| classification | count | rules |", "|---|---|---|");
for (const cls of ["PRO_ONLY_ICON_CANDIDATE", "DUPLICATE_OF_RESOLVED", "HELPER_OR_INTERNAL", "NON_ICON_ASSET"])
  md.push(`| ${cls} | ${byClassification[cls] ?? 0} | ${Object.entries(byRule).filter(([r]) => (RULES.find((x) => x.id === r)?.classification ?? "") === cls).map(([r, n]) => `${r} (${n})`).join(", ") || "—"} |`);
const KIND_RANK = { "icon-set": 0, icon: 1, "app-icon": 2, "flag-icon": 3 };
const examples = (cls, n = 4) =>
  unresolvedClassifications
    .filter((u) => u.classification === cls)
    .slice()
    .sort((a, b) => (KIND_RANK[a.kind] ?? 0) - (KIND_RANK[b.kind] ?? 0) || a.name.localeCompare(b.name))
    .slice(0, n)
    .map((u) => u.name)
    .join(", ");
md.push(
  "",
  `Examples — PRO-only: ${examples("PRO_ONLY_ICON_CANDIDATE")} (kind mix: ${Object.entries(artifact.unresolvedSummary.proOnlyByKind).map(([k, v]) => `${k} ${v}`).join(", ")})`,
  `Examples — duplicate of resolved: ${examples("DUPLICATE_OF_RESOLVED")}`,
  `Examples — helper/internal: ${examples("HELPER_OR_INTERNAL")}`,
  `Examples — non-icon asset: ${examples("NON_ICON_ASSET", 5)}`,
);
md.push("", "## Licensing", "");
md.push(`- Free packages: \`${licensing.freePackageSurface.redistribution}\` — consumed as an npm dependency, never vendored.`);
md.push(`- ${licensing.freePackageSurface.iconArtworkStatement}`);
if (iconsLic?.licenseFiles?.[0]?.restrictions?.length) md.push(...iconsLic.licenseFiles[0].restrictions.map((r) => `  - icons LICENSE: ${r}`));
md.push(`- ${licensing.statements.find((s) => s.id === "L4").statement} (\`${licensing.localOssSurface.license}\`, ${localOssIconComponents.length} sources)`);
md.push(`- PRO icon surface (${totals.unresolvedProOnlyCandidates} candidates): \`${licensing.proIconSurface.redistribution}\` — separate licensed artifacts, never part of this repository.`);
md.push(`- Local extractions of PRO-only icons: \`${licensing.localExtractions.redistribution}\` (${licensing.localExtractions.publicArtifactsMayCarry}).`);
writeFileSync(join(outDir, "icon-inventory-summary.md"), `${md.join("\n")}\n`);

// ------------------------------------------------------------------ console summary (< 40 lines)
const line = (s) => process.stdout.write(`${s}\n`);
line(`icon inventory: ${packageRecords.length} packages, ${localOssIconComponents.length} local OSS sources, ${totals.families} figma families on ${totals.pages} pages`);
for (const p of packageRecords) {
  const extra = p.fileTypeTable ? ` fileTypes=${p.fileTypeTable.count} (${p.fileTypeTable.count} type modules + ${p.distSubdirectories.join("/")} variants)` : "";
  const lic = p.licenseFilePresent ? `${p.licenseField}+shipped-LICENSE` : `${p.licenseField} (no LICENSE file)`;
  line(`  ${p.name}@${p.resolvedVersion}  license=${lic}  d.ts=${p.declarationFileCount}  exports=${p.entryExportCount} entry/${p.declarationExportCount} declared${extra}`);
}
line(`  local OSS: ${artifact.localOssTotals.files} files / ${artifact.localOssTotals.exports} exports (${localOssIconComponents.map((s) => s.id).join(", ")})`);
for (const p of perPage)
  line(`  figma ${p.pageName.padEnd(22)} families=${String(p.familyCount).padStart(5)} icons=${String(p.resolvedToIcons).padStart(4)} fileIcons=${String(p.resolvedToFileIcons).padStart(3)} local=${String(p.resolvedToLocalOss).padStart(3)} unresolved=${String(p.unresolved).padStart(4)} proOnly=${p.unresolvedProOnlyCandidates}`);
line(`  totals: icons=${totals.resolvedToIcons} fileIcons=${totals.resolvedToFileIcons} local=${totals.resolvedToLocalOss} unresolved=${totals.unresolved} proOnlyCandidates=${totals.unresolvedProOnlyCandidates}`);
line(`  unresolved by class: ${Object.entries(byClassification).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(" ")}`);
line(`  licensing: free=dependency-only (${iconsLic?.licenseFilePresent ? "shipped LICENSE restricts icon artwork" : "license field only"}); PRO=never redistribute; extractions=private-only`);
line(`  wrote ${relative(process.cwd(), join(outDir, "icon-inventory.json"))} + icon-inventory-summary.md`);
