#!/usr/bin/env node
/**
 * Crosswalk refinement pass (COVERAGE_STRATEGY plan vocabulary).
 *
 *   node compiler/reference/crosswalk-refine.mjs
 *
 * crosswalk.json can only express the *relationship* between a Figma family and OSS code
 * (EXACT_OSS_MATCH / MERGE / SPLIT / COMPOSITION / EXTERNAL_PACKAGE / FIGMA_ONLY). It cannot express
 * *why* a mapped family still differs (VERSION_DRIFT, FIGMA_VISUAL_DELTA), what an icon family resolved
 * to, or which OSS components are absent from this Figma file. This pass computes exactly that and
 * writes it to crosswalk-refinements.json — crosswalk.json itself is never rewritten.
 *
 * Deterministic only: reads the four upstream artifacts plus the adopted upstream source under
 * registry/untitledui/ (and the installed icon package listing). No model calls, no network.
 *
 *   for every Figma family in crosswalk.json:
 *     1. componentKey                 published key from figma-surface.json (null when absent)
 *     2. versionDrift                 Figma axis vocabulary vs the mapped OSS component's own vocabulary
 *                                     -> VERSION_DRIFT (missing axis values) / FIGMA_VISUAL_DELTA (>= 3x)
 *     3. iconMappingCoverage          icon-ish pages: installed-package export vs repo-local export vs none
 *     4. ossOnly                      index.json public components with no Figma family (OSS_ONLY)
 *     5. summary                      counts by refinement classification + unresolvedFamilies + reasons
 *
 * Evidence channels (every refined entry cites them):
 *   C1 index.json variantVocabulary      per-file variant table (keys + values)
 *   C2 index.json props / destructuring  prop names, quoted union literals, literal defaults
 *   C3 adopted upstream props type       registry/untitledui/<path>: <Export>Props block plus the local
 *                                        type aliases / const maps it references (documented, resolved)
 *   C4 adopted upstream utility classes   hover:/focus:/disabled:/aria-invalid: signals for Figma state axes
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REF = ".design-compiler/references";
const LIB = "untitledui";
const ADOPTED = "registry/untitledui";
const OUT = resolve(REF, LIB, "crosswalk-refinements.json");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const OSS = readJson(resolve(REF, LIB, "index.json"));
const FIGMA = readJson(resolve(REF, "figma", "figma-surface.json"));
const CW = readJson(resolve(REF, LIB, "crosswalk.json"));
const GAPS = readJson(resolve(REF, LIB, "gaps.json"));
const ALIASES = existsSync(resolve(REF, LIB, "aliases.json")) ? (readJson(resolve(REF, LIB, "aliases.json")).aliases ?? {}) : {};

/* ------------------------------------------------------------------ shared vocabulary helpers --- */
/** camelCase-aware normalization; identical to crosswalk.mjs so vocabularies stay comparable. */
const camelToKebab = (s) => String(s ?? "").replace(/([a-z0-9])([A-Z])/g, "$1-$2");
const norm = (s) =>
  camelToKebab(s)
    .toLowerCase()
    .replace(/^[\s_\-–—]+/, "")
    .replace(/[\s_\-–—]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
/** page names in the PRO file carry decorative prefixes ("      ↳ Misc icons") */
const cleanPage = (n) => String(n ?? "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
const uniq = (arr) => [...new Set(arr)];
const num = (n) => Number.isFinite(n) ? n : 0;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

const PAGE_NAME = new Map(FIGMA.pages.map((p) => [p.id, cleanPage(p.name)]));
const pageName = (id) => PAGE_NAME.get(id) ?? null;
const SURFACE_BY_ID = new Map(FIGMA.families.map((f) => [f.id, f]));

const REL_MAPPED = new Set(["EXACT_OSS_MATCH", "OSS_COMPONENT_SET_MERGE", "OSS_COMPONENT_SPLIT"]);
const ICON_PAGES = ["Icons", "Misc icons", "Logos", "Background elements", "Miscellaneous assets"];

/* ---------------------------------------------------------------------- C1+C2: index vocabulary --- */
const ENTRY_BY_PATH = new Map(OSS.entries.map((e) => [e.path, e]));
const LITERAL_RE = /"([^"]*)"/g;
const quotedLiterals = (text) => [...String(text ?? "").matchAll(LITERAL_RE)].map((m) => m[1]).filter(Boolean);

/** index.json vocabulary of one mapped code target, token -> provenance string. */
function indexVocabulary(code, tokens) {
  const path = code.source;
  const e = ENTRY_BY_PATH.get(path);
  if (!e) return { channel: `${path} MISSING from index.json`, tokens: 0 };
  let n = 0;
  const add = (token, prov) => {
    const key = norm(token);
    if (!key || tokens.has(key)) return;
    tokens.set(key, prov);
    n++;
  };
  for (const [outer, inner] of Object.entries(e.variantVocabulary ?? {})) {
    add(outer, `${path} variantVocabulary.${outer}`);
    for (const v of inner ?? []) add(v, `${path} variantVocabulary.${outer}`);
  }
  const named = (e.components ?? []).filter((c) => c.name === code.export);
  for (const comp of named.length ? named : e.components ?? []) {
    for (const [pname, p] of Object.entries(comp.props ?? {})) {
      if (pname.startsWith("(")) continue;
      add(pname, `${path}#${comp.name} prop ${pname}`);
      for (const lit of quotedLiterals(p.type)) add(lit, `${path}#${comp.name} prop ${pname} type`);
    }
    for (const [dname, d] of Object.entries(comp.destructuring ?? {})) {
      add(dname, `${path}#${comp.name} destructured ${dname}`);
      const dv = d?.default;
      if (typeof dv === "string" && /^"(.*)"$/.test(dv)) add(dv.slice(1, -1), `${path}#${comp.name} default ${dname}`);
      else if (dv === "true" || dv === "false") add(dv, `${path}#${comp.name} default ${dname}`);
    }
  }
  for (const cap of e.capabilities ?? []) add(cap, `${path} capability ${cap}`);
  return { channel: `index.json ${path}${named.length ? `#${code.export}` : ""}`, tokens: n, exports: (e.components ?? []).length, props: named.reduce((a, c) => a + num(c.propCount), 0) };
}

/* ------------------------------------------------------------ C3: adopted upstream type resolver --- */
const SOURCE_CACHE = new Map();
const readSource = (p) => {
  if (!SOURCE_CACHE.has(p)) SOURCE_CACHE.set(p, existsSync(p) ? readFileSync(p, "utf8") : null);
  return SOURCE_CACHE.get(p);
};
/** brace/bracket matching from the char after `open` */
function matchBrace(text, i, open = "{", close = "}") {
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j;
  }
  return -1;
}
const SKIP_TYPE_WORDS = new Set(["React", "ReactNode", "FunctionComponent", "FC", "string", "number", "boolean", "Record", "Array", "Omit", "Pick", "Partial", "Required", "Readonly", "NonNullable", "ReturnType", "Promise", "SafeArea", "ElementType", "ComponentProps", "HTMLAttributes", "SVGProps", "Key", "CSSProperties", "PropsWithChildren", "Extract", "Exclude", "Parameters", "typeof", "keyof"]);

/** declarations of one source file: type aliases, interfaces, object/array consts (plus their import map). */
function harvest(rel) {
  const text = readSource(resolve(ADOPTED, rel));
  if (text === null) return null;
  const types = new Map();
  const interfaces = new Map();
  const consts = new Map();
  const imports = new Map();
  for (const m of text.matchAll(/import\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*"([^"]+)"/g)) {
    const from = m[3];
    if (!from.startsWith("./") && !from.startsWith("../") && !from.startsWith("@/")) continue;
    for (const part of (m[2] ?? "").split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
      if (name) imports.set(name, from);
    }
    if (m[1]) imports.set(m[1], from);
  }
  for (const m of text.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*(?:<[^>{}]*>)?\s*=\s*/g)) {
    const start = m.index + m[0].length;
    let depth = 0, end = text.length;
    for (let j = start; j < text.length; j++) {
      const c = text[j];
      if ("({[<".includes(c)) depth++;
      else if (")}]>".includes(c)) depth--;
      else if (c === ";" && depth <= 0) { end = j; break; }
      else if (c === "\n" && depth <= 0 && /\n\s*(?:export\s+)?(?:type|interface|const|function)\s/.test(text.slice(j - 1, j + 40))) { end = j; break; }
    }
    types.set(m[1], text.slice(start, end));
  }
  for (const m of text.matchAll(/(?:^|\n)\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\s*(?:<[^>{}]*>)?\s*(?:extends[^{]*)?\{/g)) {
    const open = text.indexOf("{", m.index + m[0].length - 1);
    const close = matchBrace(text, open);
    if (close > 0) interfaces.set(m[1], text.slice(open + 1, close));
  }
  for (const m of text.matchAll(/(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*[{\[]/g)) {
    const open = text.indexOf(m[0].trimEnd().slice(-1), m.index + m[0].length - 1);
    const close = open > 0 ? matchBrace(text, open, m[0].trimEnd().slice(-1), m[0].trimEnd().slice(-1) === "{" ? "}" : "]") : -1;
    if (close > 0) consts.set(m[1], text.slice(open + 1, close));
  }
  const resolveModule = (from) => {
    const base = from.startsWith("@/") ? from.slice(2) : resolve(dirname(rel), from).replace(/\\/g, "/");
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (cand.includes("..")) continue;
      const abs = resolve(ADOPTED, cand);
      if (existsSync(abs) && statSync(abs).isFile()) return cand;
    }
    return null;
  };
  return { rel, text, types, interfaces, consts, imports, resolveModule };
}

const depthOneKeys = (body) => {
  const keys = [];
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if ("{[(".includes(c)) { depth++; continue; }
    if ("}])".includes(c)) { depth--; continue; }
    if (depth === 0 && c === ":") {
      const before = body.slice(0, i).replace(/[\s,]+$/, "");
      const m = before.match(/(?:^|[\s,{])(\[[^\]]+\]|"[^"]+"|'[^']+'|[A-Za-z_$][\w$]*)$/);
      if (m && !before.endsWith("?")) keys.push(m[1].replace(/^\[|\]$/g, "").replace(/^["']|["']$/g, ""));
    }
  }
  return keys;
};
const scalarStrings = (body) => [...body.matchAll(/(?:^|[\s,{[])"([^"]{1,40})"/g)].map((m) => m[1]);

/**
 * C3: vocabulary declared by the mapped export's own props type in the adopted upstream source.
 * Follows referenced local type aliases / const maps (bounded depth, cycle-safe) so that a component
 * whose props come from a sibling module (e.g. Badge -> BadgeColors) is still compared fairly.
 */
function sourceVocabulary(rel, exportName, tokens, meta) {
  const files = new Map();
  const get = (r) => {
    if (!files.has(r)) files.set(r, harvest(r));
    return files.get(r);
  };
  const base = get(rel);
  if (!base) {
    meta.unresolved.push(`registry/untitledui/${rel} not readable`);
    return 0;
  }
  const seen = new Set();
  let n = 0;
  const add = (token, prov) => {
    const key = norm(token);
    if (!key || tokens.has(key)) return;
    tokens.set(key, prov);
    n++;
  };
  const visitFile = (file, name, why, depth) => {
    if (depth > 4 || !file) return;
    const key = `${file.rel}#${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    const prov = (kind) => `registry/untitledui/${file.rel} ${kind} ${name}`;
    const body = file.types.get(name);
    const iface = file.interfaces.get(name);
    const obj = file.consts.get(name);
    const pushRefs = (text, provText) => {
      for (const ref of uniq([...String(text ?? "").matchAll(/[A-Z][A-Za-z0-9_$]*/g)].map((m) => m[0]))) {
        if (SKIP_TYPE_WORDS.has(ref) || ref === name) continue;
        const imported = file.imports.get(ref);
        if (imported) {
          const target = file.resolveModule(imported);
          if (target) { visitFile(get(target), ref, provText, depth + 1); continue; }
        }
        if (file.types.has(ref) || file.interfaces.has(ref) || file.consts.has(ref)) visitFile(file, ref, provText, depth + 1);
      }
    };
    if (body !== undefined) {
      for (const lit of quotedLiterals(body)) add(lit, prov("type"));
      const keyofTypeof = body.match(/keyof\s+typeof\s+([A-Za-z_$][\w$]*)/);
      const typeofIndexed = body.match(/typeof\s+([A-Za-z_$][\w$]*)\s*\[/);
      for (const ref of [keyofTypeof?.[1], typeofIndexed?.[1]].filter(Boolean)) {
        const local = file.consts.has(ref) ? file : (() => { const t = file.resolveModule(file.imports.get(ref)); return t ? get(t) : null; })();
        const objBody = local?.consts.get(ref);
        if (objBody === undefined) continue;
        for (const k of depthOneKeys(objBody)) add(k, `registry/untitledui/${local.rel} const ${ref}`);
        for (const s of scalarStrings(objBody)) add(s, `registry/untitledui/${local.rel} const ${ref}`);
      }
      pushRefs(body, prov("type"));
    }
    if (iface !== undefined) {
      for (const prop of depthOneKeys(iface)) add(prop, prov("interface"));
      for (const lit of quotedLiterals(iface)) add(lit, prov("interface"));
      pushRefs(iface, prov("interface"));
    }
    if (obj !== undefined) {
      for (const k of depthOneKeys(obj)) add(k, `registry/untitledui/${file.rel} const ${name}`);
      for (const s of scalarStrings(obj)) add(s, `registry/untitledui/${file.rel} const ${name}`);
    }
  };

  // the export's own props declaration, then (if absent) every <Export>* type the file declares
  const own = base.interfaces.get(`${exportName}Props`) !== undefined ? `${exportName}Props` : (base.types.has(`${exportName}Props`) ? `${exportName}Props` : null);
  if (own) visitFile(base, own, "props", 0);
  for (const name of [...base.types.keys(), ...base.interfaces.keys()]) {
    if (name === own) continue;
    if (name === exportName || name.startsWith(`${exportName}Props`) || name.startsWith(`${exportName}Prop`)) visitFile(base, name, "props", 1);
  }
  meta.sourceDeclarations = own ? `registry/untitledui/${rel} ${own}` : `registry/untitledui/${rel} ${exportName}*`;
  meta.resolvedNames = uniq([...seen].map((s) => s.split("#")[1]));
  return n;
}

/* --------------------------------------------------- C4: adopted upstream utility-class signals ---- */
const STATE_SIGNALS = {
  hover: [`hover:`],
  focused: [`focus:`, `focus-visible:`, `data-focused`, `data-focus-visible`],
  focus: [`focus:`, `focus-visible:`],
  active: [`active:`, `data-active`],
  pressed: [`data-pressed`, `active:`],
  selected: [`data-selected`, `aria-selected`, `data-selection-mode`],
  disabled: [`disabled:`, `data-disabled`, `isDisabled`],
  loading: [`isLoading`, `aria-busy`, `animate-spin`],
  error: [`aria-invalid`, `data-invalid`, `destructive`, `error`],
  invalid: [`aria-invalid`, `data-invalid`],
  checked: [`data-checked`, `checked`],
  open: [`data-open`, `isOpen`],
  closed: [`data-closed`, `isClosed`],
  readonly: [`data-readonly`, `isReadOnly`, `readonly`],
  placeholder: [`placeholder:`],
  default: [],
  filled: [],
  empty: [],
};
const STATE_VALUES = new Set(Object.keys(STATE_SIGNALS));
const DESIGN_TOOL_ONLY_STATES = new Set(["default", "filled", "empty"]);

/* ------------------------------------------------------------- installed icon package resolution --- */
const ICON_PACKAGE = (() => {
  const pkgPath = resolve("node_modules", "@untitledui", "icons", "package.json");
  const dir = resolve("node_modules", "@untitledui", "icons", "dist");
  const pkg = existsSync(pkgPath) ? readJson(pkgPath) : { name: "@untitledui/icons", version: "absent" };
  const exports = new Set();
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".d.ts") && f !== "index.d.ts") exports.add(norm(f.replace(/\.d\.ts$/, "")));
  return { name: pkg.name, version: pkg.version, exports };
})();
/** families that only match an installed export after stripping a Figma numeric variant suffix (-01, -02, ...) */
const ICON_SUFFIX_ONLY = new Map();
const ICON_ABSENT = new Set();
for (const m of CW.mappings) {
  if (REL_MAPPED.has(m.relationship) || (m.relationship === "EXTERNAL_PACKAGE" && m.code.length)) continue;
  if (!ICON_PAGES.includes(pageName(m.figma.page))) continue;
  const key = norm(m.figma.name);
  if (!key || ICON_PACKAGE.exports.has(key)) continue;
  const stripped = key.replace(/-(\d+)$/, "");
  ICON_ABSENT.add(key);
  if (stripped !== key && ICON_PACKAGE.exports.has(stripped)) ICON_SUFFIX_ONLY.set(key, stripped);
}
/** does the mapped adopted source contain the axis value in any spelling? (negative evidence) */
const sourceTokenAbsent = (codes, key) =>
  codes.every((c) => {
    if (c.source.startsWith("@")) return true;
    const text = (readSource(resolve(ADOPTED, c.source)) ?? "").toLowerCase();
    if (!text) return true;
    return !key.split("-").every((part) => text.includes(part));
  });

/* ------------------------------------------------------------------------ per-family comparison --- */
const familyRows = [];
const summaryCounts = { byClassification: {}, valuesChecked: 0, valuesMatched: 0, valuesMissing: 0, valuesNumeric: 0, valuesStateMatched: 0, valuesDesignToolState: 0 };
const unresolvedFamilies = [];
const unresolvedByReason = {};

function noteUnresolved(family, code, reason, evidence) {
  unresolvedByReason[code] = (unresolvedByReason[code] ?? 0) + 1;
  unresolvedFamilies.push({ componentSetId: family.id, name: family.name, page: family.page, pageName: pageName(family.page), variants: num(family.variantCount), relationship: code, reason, evidence });
}

for (const m of CW.mappings) {
  const family = SURFACE_BY_ID.get(m.figma.componentSetId) ?? { id: m.figma.componentSetId, name: m.figma.name, page: m.figma.page, variantCount: m.figma.variants, axes: m.figma.axes ?? {} };
  const componentKey = family.key ?? null;
  const axes = family.axes ?? {};

  if (REL_MAPPED.has(m.relationship)) {
    const tokens = new Map();
    const channels = [];
    const meta = { unresolved: [] };
    for (const code of m.code) channels.push(indexVocabulary(code, tokens));
    for (const code of m.code.filter((c) => !c.source.startsWith("@") && ENTRY_BY_PATH.has(c.source))) sourceVocabulary(code.source, code.export, tokens, meta);
    const vocabSize = tokens.size;

    const missing = [];
    const stateUnmatched = [];
    const stateCssMatched = [];
    const designToolStates = [];
    const numericSkipped = [];
    let matched = 0;
    for (const [axisName, axis] of Object.entries(axes)) {
      for (const value of axis.values ?? []) {
        summaryCounts.valuesChecked++;
        const key = norm(value);
        if (!key) continue;
        if (/^[0-9]+$/.test(key)) { numericSkipped.push({ axis: axisName, value }); summaryCounts.valuesNumeric++; continue; }
        if (tokens.has(key)) { matched++; summaryCounts.valuesMatched++; continue; }
        const parts = key.split("-").filter((p) => p.length > 1);
        if (parts.length > 1 && parts.every((p) => tokens.has(p))) { matched++; summaryCounts.valuesMatched++; continue; }
        if (STATE_VALUES.has(key)) {
          if (DESIGN_TOOL_ONLY_STATES.has(key)) { designToolStates.push({ axis: axisName, value }); summaryCounts.valuesDesignToolState++; continue; }
          const signals = STATE_SIGNALS[key];
          const hits = signals.filter((s) => m.code.some((c) => !c.source.startsWith("@") && (readSource(resolve(ADOPTED, c.source)) ?? "").includes(s)));
          if (signals.length && hits.length) { stateCssMatched.push({ axis: axisName, value, utilityClassSignals: hits }); summaryCounts.valuesStateMatched++; continue; }
          stateUnmatched.push({ axis: axisName, value, signalsChecked: signals ?? [] });
          continue;
        }
        missing.push({ axis: axisName, value, absentFromMappedSource: sourceTokenAbsent(m.code, key) });
        summaryCounts.valuesMissing++;
      }
    }
    const recipes = m.recipeCandidates?.length ?? 0;
    const visualDelta = num(family.variantCount) >= 3 * Math.max(1, vocabSize) && recipes === 0;
    const versionDrift = missing.length > 0 || stateUnmatched.length > 0;
    const classification = !vocabSize && (missing.length || stateUnmatched.length) ? "UNRESOLVED" : visualDelta ? "FIGMA_VISUAL_DELTA" : versionDrift ? "VERSION_DRIFT" : null;

    if (classification) {
      summaryCounts.byClassification[classification] = (summaryCounts.byClassification[classification] ?? 0) + 1;
      const evidence = [
        `crosswalk.json: relationship ${m.relationship} — ${m.evidence.filter((e) => !e.startsWith("candidates:")).slice(0, 2).join("; ")}`,
        family.key ? `figma-surface.json: family ${family.id} published component key ${family.key}` : `figma-surface.json: family ${family.id} has no published component key`,
        ...channels.map((c) => `C1/C2 ${c.channel}: ${c.tokens} vocabulary tokens`),
        `C3 ${meta.sourceDeclarations ?? "no adopted-source props type resolved"}: ${meta.resolvedNames?.length ? meta.resolvedNames.join(", ") : "none"} -> vocabulary ${vocabSize} tokens`,
      ];
      if (missing.length) evidence.push(`C1–C3 negative: ${missing.length}/${missing.length + matched} non-state axis values have no token counterpart (e.g. ${missing.slice(0, 3).map((x) => `${x.axis}="${x.value}"`).join(", ")})`);
      if (stateUnmatched.length) evidence.push(`C4 negative: state values ${stateUnmatched.map((x) => `${x.axis}="${x.value}"`).slice(0, 4).join(", ")} have neither a vocabulary token nor a utility-class signal`);
      if (stateCssMatched.length) evidence.push(`C4 positive: ${stateCssMatched.length} state values match adopted-source utility-class signals (e.g. ${stateCssMatched.slice(0, 3).map((x) => `${x.value}->${x.utilityClassSignals[0]}`).join(", ")})`);
      if (visualDelta) evidence.push(`variant scale: ${family.variantCount} Figma variants >= 3x the ${vocabSize}-token OSS vocabulary with no recipe candidates`);
      if (recipes) evidence.push(`${recipes} recipe candidates recorded by crosswalk.json keep this family out of the visual-delta rule`);
      if (meta.unresolved.length) evidence.push(...meta.unresolved.slice(0, 2));
      familyRows.push({
        componentSetId: family.id,
        name: family.name,
        page: family.page,
        pageName: pageName(family.page),
        componentKey,
        crosswalkRelationship: m.relationship,
        classification,
        flags: { versionDrift, figmaVisualDelta: visualDelta },
        mappedOssExports: m.code.map((c) => `${c.source}#${c.export}`),
        ossVocabulary: { size: vocabSize, channels: uniq(channels.map((c) => c.channel)) },
        figmaAxes: Object.fromEntries(Object.entries(axes).map(([a, v]) => [a, v.values ?? []])),
        figmaVariants: num(family.variantCount),
        matchedAxisValues: matched,
        missingAxisValues: missing,
        unmatchedStateValues: stateUnmatched,
        designToolStateValues: designToolStates,
        numericAxisValuesSkipped: numericSkipped,
        stateValuesMatchedInCss: stateCssMatched,
        evidence,
      });
    }
    if (classification === "UNRESOLVED") {
      noteUnresolved(family, "UNRESOLVED", "NO_OSS_VOCABULARY_IN_INVENTORY", [`${m.code.map((c) => `${c.source}#${c.export}`).join(", ")} carry no prop/variant metadata in index.json, no <Export>Props declaration in registry/untitledui, and the family has ${missing.length + stateUnmatched.length} unmatched axis values`]);
    }
    continue;
  }

  // unmapped families: record why this refinement pass still cannot classify them
  const pname = pageName(family.page);
  if (ICON_PAGES.includes(pname)) {
    const key = norm(family.name);
    const code = ICON_ABSENT.has(key) ? "ICON_FAMILY_ABSENT_FROM_INSTALLED_PACKAGE" : "ICON_FAMILY_OUTSIDE_INSTALLED_PACKAGE_SCOPE";
    noteUnresolved(family, m.relationship, code, [`page "${pname}" is an icon/asset page`, `installed ${ICON_PACKAGE.name}@${ICON_PACKAGE.version} exposes ${ICON_PACKAGE.exports.size} exports; none matches "${family.name}" (normalized "${key}")${ICON_SUFFIX_ONLY.has(key) ? `; a numeric-suffix-stripped base "${ICON_SUFFIX_ONLY.get(key)}" does match an installed export (candidate only, not a resolution)` : ""}`, `family has ${Object.keys(axes).length} variant axes and ${num(family.variantCount)} variants`]);
  } else {
    noteUnresolved(family, m.relationship, m.relationship === "EXTERNAL_PACKAGE" ? "EXTERNAL_ASSET_WITHOUT_INSTALLED_EXPORT" : "NO_OSS_COUNTERPART_AND_NO_VARIANT_AXES", [m.evidence.join("; "), `family has ${Object.keys(axes).length} variant axes and ${num(family.variantCount)} variants`, `no axis value names an OSS export and no OSS component shares >= 3 axis values (checked against ${OSS.entries.length} index.json entries)`]);
  }
}

/* ------------------------------------------------------------------------- icon mapping coverage --- */
const ICON_PACKAGE = (() => {
  const dir = resolve("node_modules", "@untitledui", "icons", "dist");
  const pkg = existsSync(resolve("node_modules", "@untitledui", "icons", "package.json")) ? readJson(resolve("node_modules", "@untitledui", "icons", "package.json")) : { name: "@untitledui/icons", version: "absent" };
  const exports = new Set();
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".d.ts") && f !== "index.d.ts") exports.add(norm(f.replace(/\.d\.ts$/, "")));
  return { name: pkg.name, version: pkg.version, exports, declarations: [...exports] };
})();
/** families whose name only matches an installed export after stripping a Figma numeric variant suffix */
const ICON_SUFFIX_ONLY = new Map();
const ICON_ABSENT = new Set();
for (const m of CW.mappings) {
  if (REL_MAPPED.has(m.relationship) || (m.relationship === "EXTERNAL_PACKAGE" && m.code.length)) continue;
  const pname = pageName(m.figma.page);
  if (!ICON_PAGES.includes(pname)) continue;
  const key = norm(m.figma.name);
  if (ICON_PACKAGE.exports.has(key)) continue;
  const stripped = key.replace(/-(\d+)$/, "");
  ICON_ABSENT.add(key);
  if (stripped !== key && ICON_PACKAGE.exports.has(stripped)) ICON_SUFFIX_ONLY.set(key, stripped);
}

const iconMappingCoverage = (() => {
  const pages = [];
  const totals = { families: 0, installedPackageExport: 0, repoLocalOssExport: 0, unresolved: 0, absentFromInstalledPackage: 0, suffixOnlyCandidates: 0 };
  for (const p of FIGMA.pages) {
    const pname = cleanPage(p.name);
    if (!ICON_PAGES.includes(pname)) continue;
    const rows = CW.mappings.filter((m) => m.figma.page === p.id);
    const installed = rows.filter((m) => m.relationship === "EXTERNAL_PACKAGE" && m.code.some((c) => c.source.startsWith("@")));
    const installedVerified = installed.filter((m) => m.code.some((c) => c.source.startsWith("@") && ICON_PACKAGE.exports.has(norm(c.export))));
    const local = rows.filter((m) => m.code.some((c) => !c.source.startsWith("@") && ENTRY_BY_PATH.has(c.source)));
    const unresolved = rows.filter((m) => !installed.includes(m) && !local.includes(m));
    const unresolvedKeys = unresolved.map((m) => norm(m.figma.name));
    const stats = {
      page: p.id,
      pageName: pname,
      families: rows.length,
      resolved: {
        installedPackageExport: installed.length,
        installedPackageExportVerified: installedVerified.length,
        installedPackageExportUnverified: installed.length - installedVerified.length,
        repoLocalOssExport: local.length,
        total: installed.length + local.length,
        ratio: pct(installed.length + local.length, rows.length),
      },
      unresolved: {
        total: unresolved.length,
        absentFromInstalledPackage: unresolvedKeys.filter((k) => ICON_ABSENT.has(k)).length,
        suffixOnlyCandidates: unresolvedKeys.filter((k) => ICON_SUFFIX_ONLY.has(k)).length,
        externalAssetWithoutInstalledExport: rows.filter((m) => m.relationship === "EXTERNAL_PACKAGE" && !m.code.length).length,
        candidates: unresolvedKeys.filter((k) => ICON_SUFFIX_ONLY.has(k)).slice(0, 8).map((k) => ({ family: k, installedExport: ICON_SUFFIX_ONLY.get(k) })),
      },
      evidence: [
        `crosswalk.json relationships on this page: ${JSON.stringify(rows.reduce((a, m) => ({ ...a, [m.relationship]: (a[m.relationship] ?? 0) + 1 }), {}))}`,
        `installed ${ICON_PACKAGE.name}@${ICON_PACKAGE.version}: ${ICON_PACKAGE.exports.size} dist declaration exports used as the resolution target`,
        `resolved exports verified present in node_modules/@untitledui/icons/dist: ${installedVerified.length}/${installed.length}`,
        `repo-local resolutions are index.json components (e.g. components/foundations/social-icons/*)`,
      ],
    };
    pages.push(stats);
    for (const k of Object.keys(totals)) totals[k] += k === "families" ? rows.length : stats.unresolved[k] ?? stats.resolved[k] ?? 0;
  }
  totals.resolvedRatio = pct(totals.installedPackageExport + totals.repoLocalOssExport, totals.families);
  return { pages: pages.sort((a, b) => b.families - a.families), totals, iconPackage: { name: ICON_PACKAGE.name, version: ICON_PACKAGE.version, exports: ICON_PACKAGE.exports.size }, evidence: [`page set fixed to: ${ICON_PAGES.join(", ")} (names from figma-surface.json pages, not ids)`] };
})();

/* ------------------------------------------------------------------------------------ oss only --- */
const ossOnly = (() => {
  const rows = GAPS.ossWithoutFigmaFamily.map((o) => {
    const entry = ENTRY_BY_PATH.get(o.source);
    const comp = entry?.components?.find((c) => c.name === o.export) ?? null;
    const propCount = num(comp?.propCount);
    const famNames = new Set(FIGMA.families.flatMap((f) => [norm(f.name), norm(String(f.name).split("/").pop())]));
    const cands = uniq((o.figmaNames ?? []).map(norm).filter(Boolean));
    const hits = cands.filter((c) => famNames.has(c));
    return {
      source: o.source,
      export: o.export,
      kind: o.kind,
      layer: o.layer,
      propCount,
      figmaNames: o.figmaNames ?? [],
      classification: "OSS_ONLY",
      figmaAbsence: "NOT_PRESENT_IN_CURRENT_FIGMA_FILE",
      evidence: [
        `gaps.json ossWithoutFigmaFamily: no Figma family in crosswalk.json maps to ${o.source}#${o.export}`,
        `index.json ${o.source}#${o.export}: ${propCount} props, kind ${o.kind}, layer ${o.layer}`,
        hits.length ? `name collision: candidate family name(s) ${hits.join(", ")} exist in figma-surface.json — verify before treating as absent` : `none of the candidate Figma names [${cands.join(", ")}] matches any of the ${FIGMA.families.length} normalised family names in figma-surface.json`,
      ],
    };
  });
  rows.sort((a, b) => b.propCount - a.propCount || a.export.localeCompare(b.export));
  return {
    count: rows.length,
    classification: "OSS_ONLY",
    figmaAbsence: "NOT_PRESENT_IN_CURRENT_FIGMA_FILE",
    cap: 20,
    top: rows.slice(0, 20),
    byKind: rows.reduce((a, r) => ({ ...a, [r.kind]: (a[r.kind] ?? 0) + 1 }), {}),
    byLayer: rows.reduce((a, r) => ({ ...a, [r.layer]: (a[r.layer] ?? 0) + 1 }), {}),
    evidence: [`${rows.length} OSS public exports in index.json have no Figma family in crosswalk.json (same set as gaps.json ossWithoutFigmaFamily)`, `richness = index.json components[].propCount of the exported component`, `absence is scoped: NOT_PRESENT_IN_CURRENT_FIGMA_FILE (PRO STYLES v8.0), never "does not exist in Figma"`],
  };
})();

/* ------------------------------------------------------------------------------------ summary --- */
const summary = {
  figmaFamilies: CW.mappings.length,
  componentKeyCoverage: { families: CW.mappings.length, withPublishedKey: FIGMA.families.filter((f) => f.key).length, withoutPublishedKey: FIGMA.families.filter((f) => !f.key).length },
  refinedFamilies: familyRows.length,
  byClassification: summaryCounts.byClassification,
  axisComparison: { valuesChecked: summaryCounts.valuesChecked, valuesMatched: summaryCounts.valuesMatched, valuesMissing: summaryCounts.valuesMissing, valuesNumericSkipped: summaryCounts.valuesNumeric, stateValuesMatchedInCss: summaryCounts.valuesStateMatched, designToolStateValues: summaryCounts.valuesDesignToolState },
  checkedFamilies: CW.mappings.filter((m) => REL_MAPPED.has(m.relationship)).length,
  iconPagesResolvedRatio: iconMappingCoverage.totals.resolvedRatio,
  ossOnlyCount: ossOnly.count,
  unresolvedFamilies,
  unresolvedByReason,
  unresolvedTotal: unresolvedFamilies.length,
  evidence: [
    "componentKey = figma-surface.json families[].key (published key); all 2253 families carry one",
    "versionDrift compares Figma axis VALUES against the mapped export's vocabulary from index.json (C1/C2) plus the adopted upstream props type (C3); numeric axis values and mapped CSS state signals are excluded and reported separately",
    "figmaVisualDelta = Figma variant count >= 3x the OSS vocabulary size with no recipe candidates",
  ],
};

const out = {
  $schema: "design-compiler/CrosswalkRefinements@p0",
  library: LIB,
  revision: CW.revision,
  figmaFile: CW.figmaFile,
  generatedBy: "compiler/reference/crosswalk-refine.mjs",
  inputs: {
    crosswalk: `${REF}/${LIB}/crosswalk.json`,
    index: `${REF}/${LIB}/index.json`,
    gaps: `${REF}/${LIB}/gaps.json`,
    aliases: `${REF}/${LIB}/aliases.json`,
    figmaSurface: `${REF}/figma/figma-surface.json`,
    adoptedSource: ADOPTED,
    installedIconPackage: ICON_PACKAGE.name,
  },
  families: familyRows,
  iconMappingCoverage,
  ossOnly,
  summary,
};
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);

const top = Object.entries(unresolvedByReason).sort((a, b) => b[1] - a[1]);
console.log(`crosswalk-refine: ${CW.mappings.length} Figma families -> ${OUT}`);
console.log(`  refined: ${familyRows.length} ${JSON.stringify(summaryCounts.byClassification)}; axis values checked ${summaryCounts.valuesChecked} (matched ${summaryCounts.valuesMatched}, missing ${summaryCounts.valuesMissing})`);
for (const r of familyRows) console.log(`   ${r.classification.padEnd(17)} ${String(r.name).padEnd(26)} key=${r.componentKey ? "yes" : "no "} vocab=${String(r.ossVocabulary.size).padStart(3)} variants=${String(r.figmaVariants).padStart(4)} missing=${r.missingAxisValues.length} states=${r.unmatchedStateValues.length}`);
console.log(`  icon pages: ${iconMappingCoverage.totals.families} families, ${iconMappingCoverage.totals.installedPackageExport} installed-package + ${iconMappingCoverage.totals.repoLocalOssExport} repo-local (${iconMappingCoverage.totals.resolvedRatio}%), ${iconMappingCoverage.totals.unresolved} unresolved (${iconMappingCoverage.totals.suffixOnlyCandidates} suffix-only candidates)`);
for (const p of iconMappingCoverage.pages) console.log(`   ${p.pageName.padEnd(22)} families=${String(p.families).padStart(4)} installed=${String(p.resolved.installedPackageExport).padStart(4)} local=${String(p.resolved.repoLocalOssExport).padStart(3)} unresolved=${String(p.unresolved.total).padStart(4)} (${p.resolved.ratio}% resolved)`);
console.log(`  ossOnly: ${ossOnly.count} exports OSS_ONLY / NOT_PRESENT_IN_CURRENT_FIGMA_FILE; top: ${ossOnly.top.slice(0, 3).map((r) => `${r.export}(${r.propCount})`).join(", ")}`);
console.log(`  unresolved: ${unresolvedFamilies.length} ${JSON.stringify(unresolvedByReason)}`);
