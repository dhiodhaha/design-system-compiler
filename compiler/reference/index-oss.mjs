#!/usr/bin/env node
/**
 * P0 — Reference library indexer (REFERENCE_LIBRARY.md, COVERAGE_STRATEGY.md §1, §5).
 *
 *   node compiler/reference/index-oss.mjs --repo /tmp/untitled-react [--out .design-compiler/references]
 *
 * Walks the *whole pinned* OSS repository and produces deterministic metadata only — no source is vendored,
 * no model is called, nothing is sent anywhere:
 *
 *   libraries.json                     which references exist, pinned revision, license
 *   untitledui/revision.json           pin + license provenance + content digest
 *   untitledui/index.json              every file classified + exports/deps/engine/capabilities
 *   untitledui/graph.json              internal dependency graph + dependency-order layers
 *   untitledui/contracts/button.json   first canonical contract (the parity canary)
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript5";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const REPO = resolve(args.repo ?? "/tmp/untitled-react");
const OUT = resolve(args.out ?? ".design-compiler/references");
const LIB = "untitledui";

// ------------------------------------------------------------------ file kind classification
/** COVERAGE_STRATEGY.md §1 vocabulary. Path + filename evidence first; content only as a tie-break. */
function classify(path, parsed) {
  const p = `/${path.toLowerCase()}`; // leading slash so segment checks below are unambiguous
  const name = p.split("/").pop() ?? "";
  const hasComponentExport = parsed.exports.some((e) => e.kind === "component");

  if (/\.(demo)\.tsx?$/.test(name)) return "DEMO";
  if (/\.(story)\.tsx?$/.test(name)) return "STORY";
  if (/\.(test|spec)\.tsx?$/.test(name) || p.includes("/__tests__/")) return "TEST";
  if (/\.(sample|fixture)\./.test(name)) return "NON_COMPONENT";
  if (/\.(css|scss)$/.test(name) || /\.(svg|png|jpg|webp|gif|ico|woff2?|ttf)$/.test(name)) return "ASSET";
  if (p.includes("/components/internal/")) return "INTERNAL";
  if (p.includes("/components/shared-assets/")) return "ASSET";
  if (p.includes("/components/foundations/")) return hasComponentExport ? "FOUNDATION" : "NON_COMPONENT";
  if (p.includes("/components/base/")) {
    if (!hasComponentExport) return "NON_COMPONENT";
    const file = name.replace(/\.tsx?$/, "");
    // a "simple/advanced/account/integration/search" member of a family is a recipe composed from the primitive
    if (RECIPE_HINT.test(file) && /-(simple|advanced|account|integration|search|notification|team|user|link|breadcrumb)/.test(file)) return "RECIPE_OR_BLOCK";
    if (p.includes("/base-components/") || PART_SUFFIX.test(file)) return "COMPOUND_COMPONENT";
    return "BASE_COMPONENT";
  }
  if (p.includes("/components/application/")) {
    if (!hasComponentExport) return "NON_COMPONENT";
    const file2 = name.replace(/\.tsx?$/, "");
    if (/-(simple|advanced)$/.test(file2) || p.includes("/base-components/")) return "COMPOUND_COMPONENT";
    return "APPLICATION_COMPONENT";
  }
  if (p.includes("/hooks/") || p.startsWith("/hooks/")) return "HELPER";
  if (p.startsWith("/utils/")) return "HELPER";
  if (hasComponentExport) return /(provider|context)/.test(name) ? "INTERNAL" : "COMPONENT_UNKNOWN";
  return "NON_COMPONENT";
}

const ELIGIBLE_KINDS = new Set(["BASE_COMPONENT", "COMPOUND_COMPONENT", "APPLICATION_COMPONENT", "FOUNDATION"]);
/** Parts of a family vs recipes composed from primitives (COVERAGE_STRATEGY.md §1, §9). */
const PART_SUFFIX = /-(item|trigger|content|header|footer|indicator|icon|tick|count|label|chevron|close|logo|bar|cell|row|body|panel|list|group|button|input)$/;
const RECIPE_HINT = /^(dropdown|select|input|avatar|button|badge|nav|app|header|table|tabs|modal|slideout|carousel|file-upload|progress|empty-state|pagination|date-picker|tags|toggle|tooltip|slider|radio|checkbox|textarea)/;

// ------------------------------------------------------------------ AST extraction
function parseFile(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const exports = [];
  const imports = [];
  const sortCxKeys = {};

  const text = (node) => node.getText(sf).replace(/\s+/g, " ");

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      const names = [];
      const clause = node.importClause;
      if (clause?.name) names.push(clause.name.text);
      if (clause?.namedBindings) {
        if (ts.isNamedImports(clause.namedBindings)) for (const el of clause.namedBindings.elements) names.push(el.name.text);
        else if (ts.isNamespaceImport(clause.namedBindings)) names.push(`* as ${clause.namedBindings.name.text}`);
      }
      imports.push({ spec, names, typeOnly: Boolean(clause?.isTypeOnly) });
    }
    // exported declarations
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const exported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const isComponent = /^[A-Z]/.test(node.name.text);
        exports.push({ name: node.name.text, kind: isComponent ? "component" : "function" });
      } else if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (!ts.isIdentifier(d.name)) continue;
          const n = d.name.text;
          const init = d.initializer;
          const initText = init ? text(init) : "";
          // A PascalCase export whose initializer is a function expression/arrow is a component;
          // PascalCase data (arrays/objects/strings) is not.
          const callable = init ? ts.isArrowFunction(init) || ts.isFunctionExpression(init) || /=>/.test(initText) : false;
          const isComponent = /^[A-Z]/.test(n) && callable;
          exports.push({ name: n, kind: isComponent ? "component" : n.startsWith("use") ? "hook" : "const" });
        }
      } else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) exports.push({ name: node.name.text, kind: "type" });
    }
    // sortCx({ labels: { ... } }) — the reference's own variant vocabulary
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "sortCx" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
      for (const group of node.arguments[0].properties) {
        if (!ts.isPropertyAssignment(group) || !ts.isIdentifier(group.name) || !ts.isObjectLiteralExpression(group.initializer)) continue;
        sortCxKeys[group.name.text] = group.initializer.properties
          .map((p) => (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) ? p.name.text : ts.isShorthandPropertyAssignment(p) ? p.name.text : null))
          .filter(Boolean);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const useClient = /^\s*("use client"|'use client')/.test(source) || /"use client";/.test(source.slice(0, 200));
  return { exports, imports, sortCxKeys, useClient };
}

/** Primitive engine evidence — which behavioral foundation the reference actually builds on. */
function engineOf(imports) {
  const specs = imports.map((i) => i.spec);
  if (specs.some((s) => s === "react-aria-components" || s.startsWith("@react-aria/"))) return "react-aria-components";
  if (specs.some((s) => s.startsWith("@base-ui"))) return "base-ui";
  if (specs.some((s) => s.startsWith("@radix-ui"))) return "radix";
  if (specs.some((s) => s.startsWith("recharts") || s.includes("chart"))) return "charting";
  if (specs.some((s) => s.startsWith("embla"))) return "carousel";
  return "native";
}

/** Public capabilities inferred from exports, types, variant tables and imports (evidence, not guessing). */
function capabilitiesOf({ exports, sortCxKeys, source }) {
  const caps = new Set();
  const body = source;
  if (/\bhref\b/.test(body)) caps.add("link/navigation");
  if (/\b(isLoading|loading)\b/.test(body)) caps.add("loading");
  if (/\b(isDisabled|disabled)\b/.test(body)) caps.add("disabled");
  if (/data-icon/.test(body)) caps.add("icon-slots");
  if (/\biconOnly|data-icon-only\b/.test(body)) caps.add("icon-only");
  if (/\bsize\b/.test(body) && sortCxKeys.sizes) caps.add("sizes");
  if (sortCxKeys.colors) caps.add("color-variants");
  if (/destructive/i.test(body)) caps.add("destructive");
  if (/\b(value|defaultValue)\b/.test(body) && /\bonChange\b/.test(body)) caps.add("controlled-state");
  if (/createContext|Context\.Provider/.test(body)) caps.add("compound/context");
  if (/\bportal|Portal\b/.test(body)) caps.add("portal");
  if (/\buseState\b/.test(body)) caps.add("internal-state");
  if (/\btooltip|Tooltip\b/.test(body)) caps.add("tooltip-integration");
  if (/\.svg|\bImage\b|<img/.test(body)) caps.add("media");
  if (exports.some((e) => e.kind === "hook")) caps.add("exposes-hook");
  return [...caps].sort();
}

/** Candidate Figma family names — the mapping signal list from REFERENCE_LIBRARY.md. */
function candidateFigmaNames(relPath, exports) {
  const dir = relPath.split("/").slice(0, -1).pop() ?? "";
  const file = relPath.split("/").pop()?.replace(/\.tsx?$/, "") ?? "";
  const title = (s) => s.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  const names = new Set();
  for (const e of exports.filter((x) => x.kind === "component")) names.add(e.name);
  if (file) names.add(title(file));
  if (dir) names.add(title(dir));
  return [...names].sort();
}

// ------------------------------------------------------------------ walk
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const DIFF_ONLY = process.argv.includes("--diff");
const files = walk(REPO).filter((f) => /\.(tsx?|css)$/.test(f));
const entries = [];
const digest = createHash("sha256");

for (const abs of files) {
  const rel = relative(REPO, abs).replace(/\\/g, "/");
  const source = readFileSync(abs, "utf8");
  digest.update(rel).update(source);
  const parsed = /\.tsx?$/.test(abs) ? parseFile(rel, source) : { exports: [], imports: [], sortCxKeys: {}, useClient: false };
  const kind = classify(rel, parsed);
  const engine = /\.tsx?$/.test(abs) ? engineOf(parsed.imports) : "n/a";
  entries.push({
    path: rel,
    kind,
    eligible: ELIGIBLE_KINDS.has(kind),
    useClient: parsed.useClient,
    exports: parsed.exports,
    primitiveEngine: engine,
    dependencies: [...new Set(parsed.imports.map((i) => i.spec))].sort(),
    internalDependencies: [...new Set(parsed.imports.map((i) => i.spec).filter((s) => s.startsWith("@/") || s.startsWith(".")))].sort(),
    variantVocabulary: parsed.sortCxKeys,
    capabilities: /\.tsx?$/.test(abs) ? capabilitiesOf({ ...parsed, source }) : [],
    candidateFigmaNames: /\.tsx?$/.test(abs) ? candidateFigmaNames(rel, parsed.exports) : [],
    bytes: Buffer.byteLength(source),
    sha256: createHash("sha256").update(source).digest("hex").slice(0, 16),
  });
}

// ------------------------------------------------------------------ dependency graph (internal edges only)
const byPath = new Map(entries.map((e) => [e.path, e]));
const resolveInternal = (from, spec) => {
  if (spec.startsWith("@/")) {
    const base = spec.slice(2);
    return [base, `${base}.tsx`, `${base}.ts`, `${base}/index.ts`, `${base}/index.tsx`].find((c) => byPath.has(c)) ?? null;
  }
  if (spec.startsWith(".")) {
    const dir = from.split("/").slice(0, -1).join("/");
    const base = resolve("/", dir, spec).slice(1);
    return [base, `${base}.tsx`, `${base}.ts`, `${base}/index.ts`, `${base}/index.tsx`].find((c) => byPath.has(c)) ?? null;
  }
  return null;
};

const edges = [];
for (const e of entries) {
  for (const spec of e.internalDependencies) {
    const target = resolveInternal(e.path, spec);
    if (target && target !== e.path) edges.push({ from: e.path, to: target });
  }
}

const components = entries.filter((e) => e.eligible);
const componentPaths = new Set(components.map((e) => e.path));
const componentEdges = edges.filter((e) => componentPaths.has(e.from) && componentPaths.has(e.to));
const indegree = new Map(components.map((c) => [c.path, 0]));
for (const { to } of componentEdges) indegree.set(to, (indegree.get(to) ?? 0) + 1);

// topological layers: dependency leaves first (COVERAGE_STRATEGY.md §6)
const layers = [];
let remaining = new Set(components.map((c) => c.path));
const placed = new Set();
while (remaining.size) {
  const layer = [...remaining].filter((p) => componentEdges.filter((e) => e.from === p && remaining.has(e.to)).length === 0);
  if (!layer.length) break; // cycle guard: keep the rest in a final layer
  layers.push(layer.sort());
  layer.forEach((p) => {
    remaining.delete(p);
    placed.add(p);
  });
}
if (remaining.size) layers.push([...remaining].sort());

// ------------------------------------------------------------------ revision + license provenance
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO }).toString().trim();
const licenseText = existsSync(resolve(REPO, "LICENSE")) ? readFileSync(resolve(REPO, "LICENSE"), "utf8") : "";
const pkg = existsSync(resolve(REPO, "package.json")) ? JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8")) : {};

const kindCounts = entries.reduce((acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] ?? 0) + 1 }), {});
const engineCounts = entries.reduce((acc, e) => (e.primitiveEngine === "n/a" ? acc : { ...acc, [e.primitiveEngine]: (acc[e.primitiveEngine] ?? 0) + 1 }), {});

mkdirSync(resolve(OUT, LIB, "contracts"), { recursive: true });
const revisionInfo = {
  id: LIB,
  repository: "untitleduico/react",
  url: "https://github.com/untitleduico/react",
  revision,
  license: /MIT License/.test(licenseText) ? "MIT" : pkg.license ?? "unknown",
  licenseFile: existsSync(resolve(REPO, "LICENSE")) ? "LICENSE" : null,
  copyright: licenseText.split("\n")[2]?.trim() ?? null,
  scope: "files included in the OSS repository",
  retrievedAt: new Date().toISOString().slice(0, 10),
  contentDigestSha256: digest.digest("hex"),
  filesIndexed: entries.length,
};
writeFileSync(resolve(OUT, LIB, "revision.json"), JSON.stringify(revisionInfo, null, 2));

writeFileSync(
  resolve(OUT, "libraries.json"),
  JSON.stringify(
    {
      $schema: "design-compiler/references@p0",
      libraries: [
        {
          id: LIB,
          kind: "oss-react-reference",
          repository: "untitleduico/react",
          revision,
          license: revisionInfo.license,
          role: "primary semantic/behavior reference (REFERENCE_LIBRARY.md)",
          indexed: true,
        },
        {
          id: "untitledui-pro-figma",
          kind: "licensed-figma-source",
          repository: null,
          revision: null,
          license: "commercial (PRO)",
          role: "visual/composition truth + fallback for components absent from OSS",
          indexed: "partial (Button component set 3287:427074)",
        },
      ],
    },
    null,
    2,
  ),
);

writeFileSync(
  resolve(OUT, LIB, "index.json"),
  JSON.stringify(
    {
      $schema: "design-compiler/ReferenceIndex@p0",
      library: LIB,
      revision,
      counts: { files: entries.length, byKind: kindCounts, eligibleCandidates: components.length, byEngine: engineCounts },
      entries,
    },
    null,
    2,
  ),
);

writeFileSync(
  resolve(OUT, LIB, "graph.json"),
  JSON.stringify(
    {
      $schema: "design-compiler/ReferenceGraph@p0",
      library: LIB,
      revision,
      componentNodes: components.length,
      internalEdges: edges.length,
      componentEdges: componentEdges.length,
      dependencyOrder: layers,
      edges,
    },
    null,
    2,
  ),
);

// ------------------------------------------------------------------ first contract: Button (the parity canary)
const buttonEntry = entries.find((e) => e.path === "components/base/buttons/button.tsx");
const buttonSource = existsSync(resolve(REPO, "components/base/buttons/button.tsx")) ? readFileSync(resolve(REPO, "components/base/buttons/button.tsx"), "utf8") : "";
if (buttonEntry) {
  const propsInterface = /const Button = \(\{([\s\S]*?)\}\): ReactElement|function Button\(\{([\s\S]*?)\}\)/m.exec(buttonSource);
  const propNames = [...buttonSource.matchAll(/\b(href|ref|isDisabled|isPending|isLoading|showTextWhileLoading|iconLeading|iconTrailing|size|color|className|isIconOnly|children|onPress|fullWidth|tooltip|as)\b(?=[,:\s])/g)].map((m) => m[1]);
  const contract = {
    $schema: "design-compiler/ReferenceContract@p0",
    id: "button",
    library: LIB,
    revision,
    source: buttonEntry.path,
    license: revisionInfo.license,
    exports: buttonEntry.exports,
    primitiveEngine: buttonEntry.primitiveEngine,
    variantVocabulary: buttonEntry.variantVocabulary,
    capabilities: buttonEntry.capabilities,
    propEvidence: [...new Set(propNames)].sort(),
    anatomy: [
      { role: "root", evidence: "Button from react-aria-components (renders native button)" },
      { role: "linkRoot", evidence: "AriaLink used when href is present — navigation capability" },
      { role: "leadingVisual", evidence: "iconLeading | element children detected via isValidElement" },
      { role: "label", evidence: "children / data-text marker" },
      { role: "trailingVisual", evidence: "iconTrailing | element children detected via isValidElement" },
      { role: "loadingIndicator", evidence: "Spinner when loading/isPending" },
      { role: "iconOnly", evidence: "derived from children shape (isIconOnly) + data-icon-only styling hook" },
    ],
    states: ["default", "hover", "focus-visible", "disabled", "loading", "pending", "icon-only"],
    openQuestionsForParity: [
      "exact loading motion contract (duration/easing) — Figma prototype says DISSOLVE 100ms LINEAR for hover; loading animation must come from the reference, not guessed",
      "link capability must be preserved by the target adapter (href -> anchor semantics)",
      "which upstream props are capability-required vs implementation-specific naming",
    ],
    parsedPropsBlockFound: Boolean(propsInterface),
  };
  writeFileSync(resolve(OUT, LIB, "contracts", "button.json"), JSON.stringify(contract, null, 2));
}

// ------------------------------------------------------------------ coverage states (COVERAGE_STRATEGY.md §7)
const KNOWN_LOCAL = new Set(["button"]); // already compiled here, as the Figma-first benchmark
const coverage = components.map((c) => {
  const id = c.path.split("/").pop().replace(/\.tsx?$/, "");
  const inBenchmark = KNOWN_LOCAL.has(id);
  return {
    id,
    path: c.path,
    kind: c.kind,
    primitiveEngine: c.primitiveEngine,
    status: inBenchmark ? "CONTRACT_RESOLVED" : "REFERENCE_INDEXED",
    parityStatus: inBenchmark ? "benchmark (figma-first) — pending reference-first migration" : "not-started",
    license: revisionInfo.license,
  };
});
writeFileSync(
  resolve(OUT, LIB, "coverage.json"),
  JSON.stringify(
    {
      $schema: "design-compiler/ReferenceCoverage@p0",
      library: LIB,
      revision,
      totals: {
        totalEligibleOss: components.length,
        referenceIndexed: coverage.length,
        contractResolved: coverage.filter((c) => c.status === "CONTRACT_RESOLVED").length,
        targetImplemented: 0,
        verified: 0,
        proOnlyDiscovered: 0,
        proOnlyCompiled: 0,
        unresolved: 0,
        notEligible: entries.length - components.length,
      },
      byKind: kindCounts,
      candidates: coverage,
    },
    null,
    2,
  ),
);

if (DIFF_ONLY) {
  const storedPath = resolve(OUT, LIB, "index.json");
  if (!existsSync(storedPath)) {
    console.error(`no stored index at ${storedPath} — run without --diff first`);
    process.exit(2);
  }
  const stored = JSON.parse(readFileSync(storedPath, "utf8"));
  const before = new Map(stored.entries.map((e) => [e.path, e]));
  const after = new Map(entries.map((e) => [e.path, e]));
  const added = [...after.keys()].filter((p) => !before.has(p));
  const removed = [...before.keys()].filter((p) => !after.has(p));
  const changed = [...after.entries()].filter(([p, e]) => before.has(p) && before.get(p).sha256 !== e.sha256).map(([p]) => p);
  const kindChanged = [...after.entries()]
    .filter(([p, e]) => before.has(p) && before.get(p).kind !== e.kind)
    .map(([p, e]) => ({ path: p, from: before.get(p).kind, to: e.kind }));
  console.log(
    JSON.stringify(
      {
        diff: "reference sync preview",
        library: LIB,
        storedRevision: stored.revision,
        currentRevision: revision,
        added: added.length,
        removed: removed.length,
        changed: changed.length,
        reclassified: kindChanged.length,
        samples: { added: added.slice(0, 5), removed: removed.slice(0, 5), changed: changed.slice(0, 5), reclassified: kindChanged.slice(0, 5) },
        action: added.length + removed.length + changed.length + kindChanged.length === 0 ? "no drift" : "review before replacing verified contracts",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(
  JSON.stringify(
    {
      library: LIB,
      revision,
      license: revisionInfo.license,
      files: entries.length,
      byKind: kindCounts,
      eligibleCandidates: components.length,
      byEngine: engineCounts,
      internalEdges: edges.length,
      dependencyLayers: layers.length,
      firstLayer: layers[0]?.slice(0, 8),
      button: buttonEntry ? { path: buttonEntry.path, engine: buttonEntry.primitiveEngine, exports: buttonEntry.exports.map((e) => e.name), capabilities: buttonEntry.capabilities, variants: Object.keys(buttonEntry.variantVocabulary) } : null,
      coverage: { totalEligibleOss: components.length, referenceIndexed: coverage.length, contractResolved: 1, notEligible: entries.length - components.length },
      written: [`${OUT}/libraries.json`, `${OUT}/${LIB}/revision.json`, `${OUT}/${LIB}/index.json`, `${OUT}/${LIB}/graph.json`, `${OUT}/${LIB}/coverage.json`, buttonEntry ? `${OUT}/${LIB}/contracts/button.json` : null].filter(Boolean),
    },
    null,
    2,
  ),
);
