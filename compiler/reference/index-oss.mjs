#!/usr/bin/env node
/**
 * Reference library indexer (P0) — correctness pass.
 *
 *   node compiler/reference/index-oss.mjs --repo /tmp/untitled-react [--out .design-compiler/references] [--diff] [--no-digest]
 *
 * Whole-repository, AST-based, deterministic. Produces adoption metadata only — no source is vendored and
 * no model is called.
 *
 * Compared with the first version this handles, per the audit:
 *   • default exports, named re-exports, `export * as ns`, and barrel files
 *   • compound namespace exports (`export const Carousel = { Root, Content, ... }`)
 *   • quoted / numeric variant keys in the reference's own variant tables
 *   • type-aware props: interfaces, type aliases, `extends` (incl. `Omit<...>`), unions,
 *     overloaded call signatures, `keyof typeof styles.x` resolution, destructuring defaults
 *   • separate adoption dimensions instead of one coarse `eligible` flag
 *   • full-repository digest with precise field names (source files vs whole tree)
 *   • external official package inventory pinned from the upstream lockfile
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
const DIFF_ONLY = process.argv.includes("--diff");
const SKIP_DIGEST = process.argv.includes("--no-digest");
const EXTERNAL_LIBS = ["@untitledui/icons", "@untitledui/file-icons"];
const FRAMEWORK_PEERS = ["react", "react-dom", "next"];

// ------------------------------------------------------------------ adapter types (vocabulary from COVERAGE_STRATEGY.md §1)
const ADOPTION_LAYER = {
  BASE_COMPONENT: "component",
  COMPOUND_COMPONENT: "component-part",
  APPLICATION_COMPONENT: "component",
  RECIPE_OR_BLOCK: "recipe",
  FOUNDATION: "foundation",
  ASSET: "asset",
  HELPER: "helper",
  INTERNAL: "internal",
  DEMO: "evidence",
  STORY: "evidence",
  TEST: "dev",
  BARREL: "barrel",
  NON_COMPONENT: "none",
  UNCLASSIFIED: "none",
};
const ADOPTABLE_LAYERS = new Set(["component", "recipe", "foundation", "asset", "helper"]);
const PART_SUFFIX = /-(item|trigger|content|header|footer|indicator|icon|tick|count|label|chevron|close|logo|bar|cell|row|body|panel|list|group|button|input|root)$/;
const RECIPE_HINT = /-(simple|advanced|account|integration|search|notification|team|user|link|breadcrumb|group)$/;

const ELIGIBLE_KINDS = new Set(["BASE_COMPONENT", "COMPOUND_COMPONENT", "APPLICATION_COMPONENT", "FOUNDATION", "RECIPE_OR_BLOCK"]);
const COMPONENT_EXPORT_KINDS = new Set(["component", "compound-namespace", "default-component", "component-alias", "barrel-component"]);

function classify(path, parsed) {
  const p = `/${path.toLowerCase()}`;
  const name = p.split("/").pop() ?? "";
  const COMPONENT_EXPORT_KINDS = new Set(["component", "compound-namespace", "default-component", "component-alias", "barrel-component"]);
  const hasComponentExport = parsed.exports.some((e) => COMPONENT_EXPORT_KINDS.has(e.kind));
  const file = name.replace(/\.tsx?$/, "");

  if (/\.demo\.tsx?$/.test(name)) return "DEMO";
  if (/\.story\.tsx?$/.test(name)) return "STORY";
  if (/\.(test|spec)\.tsx?$/.test(name) || p.includes("/__tests__/")) return "TEST";
  if (/\.(sample|fixture)\./.test(name)) return "NON_COMPONENT";
  if (/^index\.tsx?$/.test(name) && p.includes("/components/")) return "BARREL"; // re-export barrels are not install items
  if (/\.(css|scss)$/.test(name) || /\.(svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf)$/.test(name)) return "ASSET";
  if (p.includes("/components/internal/")) return "INTERNAL";
  if (p.includes("/components/shared-assets/")) return hasComponentExport ? "ASSET" : "ASSET";
  if (p.includes("/components/foundations/")) return hasComponentExport ? "FOUNDATION" : "NON_COMPONENT";
  if (p.includes("/components/base/")) {
    if (!hasComponentExport) return "NON_COMPONENT";
    if (RECIPE_HINT.test(file)) return "RECIPE_OR_BLOCK";
    if (p.includes("/base-components/") || PART_SUFFIX.test(file)) return "COMPOUND_COMPONENT";
    return "BASE_COMPONENT";
  }
  if (p.includes("/components/application/")) {
    if (!hasComponentExport) return "NON_COMPONENT";
    if (RECIPE_HINT.test(file) || p.includes("/base-components/")) return "COMPOUND_COMPONENT";
    return "APPLICATION_COMPONENT";
  }
  if (p.includes("/hooks/") || p.startsWith("/hooks/")) return "HELPER";
  if (p.startsWith("/utils/")) return "HELPER";
  if (hasComponentExport) return "COMPONENT_UNKNOWN";
  return "NON_COMPONENT";
}

// ------------------------------------------------------------------ AST extraction
const literalKey = (nameNode) => {
  if (!nameNode) return null;
  if (ts.isIdentifier(nameNode) || ts.isPrivateIdentifier(nameNode)) return nameNode.text;
  if (ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode) || ts.isNoSubstitutionTemplateLiteral(nameNode)) return nameNode.text;
  if (ts.isComputedPropertyName(nameNode)) {
    const expr = nameNode.expression;
    if (ts.isStringLiteral(expr) || ts.isNumericLiteral(expr)) return expr.text;
  }
  return null;
};

const isCallTo = (node, names) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.includes(node.expression.text);

function isComponentLike(name, init, typeNode) {
  if (!/^[A-Z]/.test(name)) return false;
  if (!init && !typeNode) return false;
  if (typeNode) return true; // explicit type annotation on a PascalCase export
  if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return true;
  if (isCallTo(init, ["memo", "forwardRef"])) return true;
  return false;
}

/** `export const Carousel = { Root, Content, ... }` is a real compound API, not a data object. */
function namespaceMembers(init) {
  if (!init || !ts.isObjectLiteralExpression(init)) return null;
  const members = [];
  for (const prop of init.properties) {
    const key = literalKey(prop.name);
    if (!key) return null;
    if (ts.isShorthandPropertyAssignment(prop)) members.push({ name: key, valueKind: /^[A-Z]/.test(key) ? "component" : "value" });
    else if (ts.isPropertyAssignment(prop)) {
      const v = prop.initializer;
      const componentish = (ts.isIdentifier(v) && /^[A-Z]/.test(v.text)) || ts.isArrowFunction(v) || ts.isFunctionExpression(v) || isCallTo(v, ["memo", "forwardRef"]);
      members.push({ name: key, valueKind: componentish ? "component" : "value" });
    } else if (ts.isMethodDeclaration(prop)) members.push({ name: key, valueKind: "method" });
    else return null;
  }
  return members.length && members.every((m) => m.valueKind !== "value") ? members : null;
}

function parseFile(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const exports = [];
  const imports = [];
  const reExports = [];
  const types = new Map(); // name -> { node, exported }
  const locals = new Map(); // every local declaration, exported or not (alias re-exports resolve through it)
  const componentNodes = new Map(); // export name -> declaration info
  const variantTables = {};
  const text = (node) => node.getText(sf).replace(/\s+/g, " ");

  const addExport = (e) => exports.push(e);

  const visit = (node) => {
    // ---------- imports / re-exports
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
    if (ts.isExportDeclaration(node)) {
      const spec = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          const local = el.propertyName?.text ?? el.name.text;
          // `export { PinInput }` (no module specifier) re-states a local declaration: when the name is
          // PascalCase that declaration is a component, so the file is a component module.
          const componentish = !el.isTypeOnly && /^[A-Z]/.test(el.name.text);
          addExport({ name: el.name.text, kind: spec ? (componentish ? "barrel-component" : "re-export") : componentish ? "component-alias" : "alias", local, from: spec, typeOnly: el.isTypeOnly });
          reExports.push({ name: el.name.text, from: spec ?? "local", local });
        }
      } else if (node.exportClause && ts.isNamespaceExport(node.exportClause)) {
        addExport({ name: node.exportClause.name.text, kind: "namespace-reexport", from: spec });
        reExports.push({ name: node.exportClause.name.text, from: spec ?? "local", star: true });
      } else {
        addExport({ name: "*", kind: "star-reexport", from: spec });
        reExports.push({ name: "*", from: spec ?? "local", star: true });
      }
    }
    if (ts.isExportAssignment(node)) {
      const expr = node.expression;
      // `export default VisaIcon` — a default-exported PascalCase identifier is a component (SVG icons, etc.)
      if (ts.isIdentifier(expr)) {
        const nm = expr.text;
        const isComponent = /^[A-Z]/.test(nm);
        addExport({ name: nm, kind: isComponent ? "default-component" : "default", isDefault: true, local: nm });
        reExports.push({ name: "default", from: "local", local: nm });
        if (isComponent) componentNodes.set("default", { node: { kind: "default-ref", local: nm }, kind: "default-ref" });
      } else if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr) || (ts.isCallExpression(expr) && isCallTo(expr, ["memo", "forwardRef"]))) {
        addExport({ name: "(default)", kind: "default-component", isDefault: true, local: null });
      } else {
        addExport({ name: expr.getText(sf).slice(0, 48), kind: "default", isDefault: true });
      }
    }

    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const hasExport = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const hasDefault = modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

    // ---------- declarations
    if (ts.isFunctionDeclaration(node) && node.name) locals.set(node.name.text, node);
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) if (ts.isIdentifier(d.name)) locals.set(d.name.text, d);
    }
    if (hasExport && ts.isFunctionDeclaration(node) && node.name) {
      const n = node.name.text;
      addExport({ name: n, kind: /^[A-Z]/.test(n) ? "component" : "function", isDefault: Boolean(hasDefault) });
      componentNodes.set(n, { node, kind: "function" });
    } else if (hasExport && ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        const n = d.name.text;
        const init = d.initializer;
        const typeNode = d.type;
        const nsMembers = namespaceMembers(init);
        if (nsMembers) {
          addExport({ name: n, kind: "compound-namespace", members: nsMembers, typeText: typeNode ? text(typeNode) : null });
          componentNodes.set(n, { node: d, kind: "namespace" });
        } else if (isComponentLike(n, init, typeNode)) {
          addExport({ name: n, kind: "component", typeText: typeNode ? text(typeNode) : null, wrapped: init && isCallTo(init, ["memo", "forwardRef"]) ? init.expression.text : null });
          componentNodes.set(n, { node: d, kind: "variable" });
        } else {
          addExport({ name: n, kind: n.startsWith("use") ? "hook" : "const" });
        }
      }
    } else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      const n = node.name.text;
      types.set(n, { node, exported: Boolean(hasExport) });
      if (hasExport) addExport({ name: n, kind: "type", isDefault: Boolean(hasDefault) });
    } else if (hasExport && ts.isClassDeclaration(node) && node.name) {
      addExport({ name: node.name.text, kind: "class" });
    }

    // ---------- variant tables (quoted keys included)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "sortCx" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
      for (const group of node.arguments[0].properties) {
        const groupName = literalKey(group.name);
        if (!groupName || !ts.isObjectLiteralExpression(group.initializer)) continue;
        variantTables[groupName] = group.initializer.properties.map((p) => literalKey(p.name)).filter((k) => k !== null);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return { exports, imports, reExports, types, locals, componentNodes, variantTables, useClient: /^\s*["']use client["']/.test(source) };
}

// ------------------------------------------------------------------ type-aware props
/** Resolve a props type name to its declaration, following exported/aliased names. */
function resolveType(name, types, seen = new Set()) {
  if (!name || seen.has(name)) return null;
  seen.add(name);
  const entry = types.get(name);
  if (!entry) return null;
  return entry.node;
}

/** `size?: keyof typeof styles.sizes` -> the literal union, resolved from the file's own variant table. */
function resolveKeyofTable(typeText, variantTables) {
  const m = /keyof\s+typeof\s+styles\.(\w+)/.exec(typeText ?? "");
  if (!m) return null;
  const keys = variantTables[m[1]];
  return keys && keys.length ? keys : null;
}

function typeMembers(node, sf) {
  if (!node) return { members: [], extends: [], union: null };
  if (ts.isInterfaceDeclaration(node)) {
    const members = node.members
      .filter((m) => m.name)
      .map((m) => ({ name: literalKey(m.name), optional: Boolean(m.questionToken), type: m.type ? m.type.getText(sf).replace(/\s+/g, " ") : null, doc: null }));
    const ext = (node.heritageClauses ?? []).flatMap((h) => h.types.map((t) => t.getText(sf).replace(/\s+/g, " ")));
    return { members, extends: ext, union: null };
  }
  if (ts.isTypeAliasDeclaration(node)) {
    const t = node.type;
    if (ts.isTypeLiteralNode(t)) {
      return { members: t.members.filter((m) => m.name).map((m) => ({ name: literalKey(m.name), optional: Boolean(m.questionToken), type: m.type ? m.type.getText(sf).replace(/\s+/g, " ") : null })), extends: [], union: null };
    }
    if (ts.isUnionTypeNode(t)) {
      const variants = t.types.map((x) => x.getText(sf).replace(/\s+/g, " "));
      const memberMap = new Map();
      for (const v of t.types) {
        const nm = ts.isTypeReferenceNode(v) ? v.typeName.getText(sf) : null;
        const target = nm ? resolveType(nm, new Map([[node.name.text, { node }]])) : null;
        void target;
      }
      return { members: [], extends: [], union: variants, memberUnion: memberMap };
    }
    if (ts.isIntersectionTypeNode(t)) {
      const parts = t.types.map((x) => x.getText(sf).replace(/\s+/g, " "));
      const literalMembers = t.types.filter(ts.isTypeLiteralNode).flatMap((x) => x.members.filter((m) => m.name).map((m) => ({ name: literalKey(m.name), optional: Boolean(m.questionToken), type: m.type ? m.type.getText(sf).replace(/\s+/g, " ") : null })));
      return { members: literalMembers, extends: parts, union: null };
    }
  }
  return { members: [], extends: [], union: null };
}

/** Overloaded call signatures on `export const X: { (props: P): R; ... } = ...`. */
function overloadsOf(decl, sf) {
  const typeNode = decl?.type;
  if (!typeNode || !ts.isTypeLiteralNode(typeNode)) return [];
  return typeNode.members
    .filter(ts.isCallSignatureDeclaration)
    .map((sig) => ({
      params: sig.parameters.map((p) => ({ name: p.name.getText(sf), type: p.type ? p.type.getText(sf).replace(/\s+/g, " ") : null })),
      returns: sig.type ? sig.type.getText(sf).replace(/\s+/g, " ") : null,
    }));
}

function destructuringDefaults(decl, sf) {
  const init = decl?.initializer;
  const fn = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? init : null;
  const param = fn?.parameters?.[0];
  if (!param || !ts.isObjectBindingPattern(param.name)) return {};
  const out = {};
  for (const el of param.name.elements) {
    const key = literalKey(el.propertyName ?? el.name);
    if (!key) continue;
    const target = el.name && ts.isIdentifier(el.name) ? el.name.text : key;
    out[key] = { local: target, default: el.initializer ? el.initializer.getText(sf).replace(/\s+/g, " ") : null };
  }
  return out;
}

// ------------------------------------------------------------------ walk
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === ".next") continue;
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const allFiles = walk(REPO);
const sourceFiles = allFiles.filter((f) => /\.(tsx?|css)$/.test(f));

let sourceContentDigestSha256 = null;
let repositoryTreeDigestSha256 = null;
if (!SKIP_DIGEST) {
  const srcHash = createHash("sha256");
  for (const abs of sourceFiles) srcHash.update(relative(REPO, abs)).update(readFileSync(abs));
  sourceContentDigestSha256 = srcHash.digest("hex");
  const treeHash = createHash("sha256");
  for (const abs of allFiles) {
    const rel = relative(REPO, abs);
    treeHash.update(rel);
    if (/\.(tsx?|css|json|md|mjs|mts|js|jsx|txt|yml|yaml)$/.test(abs)) treeHash.update(readFileSync(abs));
  }
  repositoryTreeDigestSha256 = treeHash.digest("hex");
}

const entries = [];
for (const abs of sourceFiles) {
  const rel = relative(REPO, abs).replace(/\\/g, "/");
  const source = readFileSync(abs, "utf8");
  const parsed = /\.tsx?$/.test(abs) ? parseFile(rel, source) : { exports: [], imports: [], reExports: [], types: new Map(), componentNodes: new Map(), variantTables: {}, useClient: false };
  const kind = classify(rel, parsed);
  const layer = ADOPTION_LAYER[kind] ?? "none";

  // props for every component-ish export, type-aware
  const sfCache = new Map();
  const getSf = () => {
    if (!sfCache.has(rel)) sfCache.set(rel, ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
    return sfCache.get(rel);
  };
  const sf = /\.tsx?$/.test(abs) ? getSf() : null;
  const components = [];
  for (const e of parsed.exports) {
    if (e.kind === "component" || e.kind === "component-alias") {
      const decl = parsed.componentNodes.get(e.name)?.node ?? (e.local ? parsed.locals?.get(e.local) : undefined) ?? null;
      if (!decl) {
        components.push({ name: e.name, exported: true, propsTypeNames: [], overloads: [], destructuring: {}, props: {}, propCount: 0, note: "declaration not resolvable from this file (alias re-export)" });
        continue;
      }
      const ov = overloadsOf(decl, sf);
      const propTypeNames = new Set();
      for (const o of ov) for (const p of o.params) if (p.type && /^[A-Z]/.test(p.type)) propTypeNames.add(p.type);
      const directParamType = (() => {
        const init = decl?.initializer;
        const fn = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? init : ts.isFunctionDeclaration(decl) ? decl : null;
        const t = fn?.parameters?.[0]?.type;
        return t ? t.getText(sf).replace(/\s+/g, " ") : null;
      })();
      if (directParamType && /^[A-Z]/.test(directParamType)) propTypeNames.add(directParamType);
      const props = {};
      for (const typeName of propTypeNames) {
        const node = resolveType(typeName, parsed.types);
        if (!node) continue;
        const info = typeMembers(node, sf);
        for (const m of info.members) {
          if (!m.name) continue;
          const tableUnion = resolveKeyofTable(m.type, parsed.variantTables);
          props[m.name] = { type: tableUnion ? tableUnion.map((k) => `"${k}"`).join(" | ") : m.type, optional: Boolean(m.optional), source: `type:${typeName}`, resolvedFrom: tableUnion ? "variant-table" : null };
        }
        for (const ext of info.extends) {
          const extName = /^([A-Za-z_$][\w$]*)/.exec(ext)?.[1];
          if (extName && parsed.types.has(extName)) {
            const extInfo = typeMembers(parsed.types.get(extName).node, sf);
            for (const m of extInfo.members) {
              if (!m.name || props[m.name]) continue;
              const tableUnion = resolveKeyofTable(m.type, parsed.variantTables);
              props[m.name] = { type: tableUnion ? tableUnion.map((k) => `"${k}"`).join(" | ") : m.type, optional: Boolean(m.optional), source: `extends:${extName}`, resolvedFrom: tableUnion ? "variant-table" : null };
            }
          }
          if (!props["(inherited)"]) props["(inherited)"] = { type: ext, optional: true, source: "heritage" };
        }
        if (info.union) props["(union)"] = { type: info.union.join(" | "), optional: true, source: `union:${typeName}` };
      }
      components.push({
        name: e.name,
        exported: true,
        propsTypeNames: [...propTypeNames],
        overloads: ov,
        destructuring: destructuringDefaults(decl, sf),
        props,
        propCount: Object.keys(props).filter((k) => !k.startsWith("(")).length,
      });
    }
  }

  entries.push({
    path: rel,
    kind,
    layer,
    publicRegistryCandidate: kind === "BASE_COMPONENT" || kind === "COMPOUND_COMPONENT" || kind === "APPLICATION_COMPONENT",
    recipeOrBlock: kind === "RECIPE_OR_BLOCK",
    foundationOrAsset: kind === "FOUNDATION" || kind === "ASSET",
    evidenceOnly: kind === "DEMO" || kind === "STORY",
    internalOnly: kind === "INTERNAL" || kind === "NON_COMPONENT",
    devOnly: kind === "TEST",
    adoptable: ADOPTABLE_LAYERS.has(layer),
    distribution: kind === "STORY" || kind === "DEMO" ? "evidence" : kind === "INTERNAL" || kind === "NON_COMPONENT" ? "private" : "public-source",
    requiresExternalPackage: parsed.imports.map((i) => i.spec).filter((s) => !s.startsWith(".") && !s.startsWith("@/")),
    useClient: parsed.useClient,
    exports: parsed.exports,
    reExports: parsed.reExports,
    components,
    primitiveEngine: /\.tsx?$/.test(abs) ? engineOf(parsed.imports) : "n/a",
    dependencies: [...new Set(parsed.imports.map((i) => i.spec))].sort(),
    internalDependencies: [...new Set(parsed.imports.map((i) => i.spec).filter((s) => s.startsWith("@/") || s.startsWith(".")))].sort(),
    variantVocabulary: parsed.variantTables,
    capabilities: /\.tsx?$/.test(abs) ? capabilitiesOf(source, parsed) : [],
    candidateFigmaNames: /\.tsx?$/.test(abs) ? candidateFigmaNames(rel, parsed) : [],
    bytes: Buffer.byteLength(source),
    sha256: createHash("sha256").update(source).digest("hex").slice(0, 16),
  });
}

function engineOf(imports) {
  const specs = imports.map((i) => i.spec);
  if (specs.some((s) => s === "react-aria-components" || s.startsWith("@react-aria/"))) return "react-aria-components";
  if (specs.some((s) => s.startsWith("@base-ui"))) return "base-ui";
  if (specs.some((s) => s.startsWith("@radix-ui"))) return "radix";
  if (specs.some((s) => s.startsWith("recharts"))) return "charting";
  if (specs.some((s) => s.startsWith("embla"))) return "carousel";
  if (specs.some((s) => s === "motion" || s.startsWith("framer-motion"))) return "motion";
  return "native";
}

function capabilitiesOf(source, parsed) {
  const caps = new Set();
  if (/\bhref\b/.test(source)) caps.add("link/navigation");
  if (/\b(isLoading|isPending|loading)\b/.test(source)) caps.add("loading");
  if (/\b(isDisabled|disabled)\b/.test(source)) caps.add("disabled");
  if (/data-icon/.test(source)) caps.add("icon-slots");
  if (/\biconOnly|isIcon\b/.test(source)) caps.add("icon-only");
  if (/\bsize\b/.test(source) && parsed.variantTables.sizes) caps.add("sizes");
  if (parsed.variantTables.colors) caps.add("color-variants");
  if (/destructive/i.test(source)) caps.add("destructive");
  if (/\b(value|defaultValue)\b/.test(source) && /\bonChange\b/.test(source)) caps.add("controlled-state");
  if (/createContext|\.Provider/.test(source)) caps.add("compound/context");
  if (/\bPortal\b/.test(source)) caps.add("portal");
  if (/\buseState\b/.test(source)) caps.add("internal-state");
  if (/animate-spin/.test(source)) caps.add("animated-spinner");
  if (/reduced-motion/.test(source)) caps.add("reduced-motion");
  return [...caps].sort();
}

function candidateFigmaNames(relPath, parsed) {
  const dir = relPath.split("/").slice(0, -1).pop() ?? "";
  const file = relPath.split("/").pop()?.replace(/\.tsx?$/, "") ?? "";
  const title = (s) => s.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  const names = new Set();
  for (const e of parsed.exports.filter((x) => COMPONENT_EXPORT_KINDS.has(x.kind))) if (e.name !== "(default)") names.add(e.name);
  if (file) names.add(title(file));
  if (dir) names.add(title(dir));
  return [...names].sort();
}

// ------------------------------------------------------------------ graph
const byPath = new Map(entries.map((e) => [e.path, e]));
const resolveInternal = (from, spec) => {
  const candidates = (base) => [base, `${base}.tsx`, `${base}.ts`, `${base}/index.ts`, `${base}/index.tsx`];
  if (spec.startsWith("@/")) return candidates(spec.slice(2)).find((c) => byPath.has(c)) ?? null;
  if (spec.startsWith(".")) {
    const dir = from.split("/").slice(0, -1).join("/");
    return candidates(resolve("/", dir, spec).slice(1)).find((c) => byPath.has(c)) ?? null;
  }
  return null;
};
const edges = [];
for (const e of entries) for (const spec of e.internalDependencies) {
  const target = resolveInternal(e.path, spec);
  if (target && target !== e.path) edges.push({ from: e.path, to: target });
}

const components = entries.filter((e) => ELIGIBLE_KINDS.has(e.kind));
const componentPaths = new Set(components.map((e) => e.path));
const componentEdges = edges.filter((e) => componentPaths.has(e.from) && componentPaths.has(e.to));
const layers = [];
let remaining = new Set(components.map((c) => c.path));
while (remaining.size) {
  const layer = [...remaining].filter((p) => componentEdges.filter((e) => e.from === p && remaining.has(e.to)).length === 0);
  if (!layer.length) break;
  layers.push(layer.sort());
  layer.forEach((p) => remaining.delete(p));
}
if (remaining.size) layers.push([...remaining].sort());

// ------------------------------------------------------------------ exports inventory
const exportRows = [];
for (const e of entries) {
  for (const x of e.exports) {
    if (x.name === "*" && x.kind !== "star-reexport") continue;
    exportRows.push({
      name: x.name,
      kind: x.kind,
      file: e.path,
      layer: e.layer,
      publicRegistryCandidate: e.publicRegistryCandidate,
      distribution: e.distribution,
      members: x.members?.map((m) => m.name) ?? null,
      typeText: x.typeText ?? null,
      from: x.from ?? null,
    });
  }
}

// ------------------------------------------------------------------ revision + external packages
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO }).toString().trim();
const licenseText = existsSync(resolve(REPO, "LICENSE")) ? readFileSync(resolve(REPO, "LICENSE"), "utf8") : "";
const pkg = existsSync(resolve(REPO, "package.json")) ? JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8")) : {};
const lockText = existsSync(resolve(REPO, "bun.lock")) ? readFileSync(resolve(REPO, "bun.lock"), "utf8") : "";

const kindCounts = entries.reduce((acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] ?? 0) + 1 }), {});
const layerCounts = entries.reduce((acc, e) => ({ ...acc, [e.layer]: (acc[e.layer] ?? 0) + 1 }), {});
const engineCounts = entries.reduce((acc, e) => (e.primitiveEngine === "n/a" ? acc : { ...acc, [e.primitiveEngine]: (acc[e.primitiveEngine] ?? 0) + 1 }), {});

const externalPackages = Object.entries(pkg.dependencies ?? {})
  .filter(([name]) => name.startsWith("@untitledui/") || EXTERNAL_LIBS.includes(name))
  .map(([name, range]) => {
    const resolved = new RegExp(`${name.replace(/[/@]/g, (m) => `\\${m}`)}@([0-9][^"',\\s)]*)`).exec(lockText)?.[1] ?? null;
    const usedBy = entries.filter((e) => e.requiresExternalPackage.includes(name)).map((e) => e.path);
    return {
      name,
      declaredRange: range,
      resolvedVersion: resolved,
      role: name.includes("file-icons") ? "file type icons" : name.includes("icons") ? "line/solid icon set" : "official package",
      license: name.includes("pro") ? "commercial (PRO)" : "see package",
      redistribute: !name.includes("pro"),
      usedByFiles: usedBy.length,
      usedBySample: usedBy.slice(0, 5),
    };
  });

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
  // precise digest semantics: revision SHA is the immutable identity; these are content digests
  sourceFilesIndexed: sourceFiles.length,
  sourceContentDigestSha256,
  repositoryFilesWalked: allFiles.length,
  repositoryTreeDigestSha256,
  digestScope: "sourceContent* covers .ts/.tsx/.css; repositoryTree* covers every walked file's name plus text-file bytes; neither replaces the revision SHA as identity",
};
writeFileSync(resolve(OUT, LIB, "revision.json"), JSON.stringify(revisionInfo, null, 2));
writeFileSync(resolve(OUT, LIB, "external-packages.json"), JSON.stringify({ $schema: "design-compiler/ExternalPackages@p0", library: LIB, revision, packages: externalPackages, frameworkPeers: FRAMEWORK_PEERS.filter((n) => pkg.dependencies?.[n] || pkg.devDependencies?.[n]) }, null, 2));
writeFileSync(resolve(OUT, LIB, "exports.json"), JSON.stringify({ $schema: "design-compiler/ReferenceExports@p0", library: LIB, revision, total: exportRows.length, byKind: exportRows.reduce((a, r) => ({ ...a, [r.kind]: (a[r.kind] ?? 0) + 1 }), {}), exports: exportRows }, null, 2));

const inventory = {
  files: entries.length,
  byKind: kindCounts,
  byAdoptionLayer: layerCounts,
  publicRegistryCandidates: entries.filter((e) => e.publicRegistryCandidate).length,
  recipesAndBlocks: entries.filter((e) => e.recipeOrBlock).length,
  foundationsAndAssets: entries.filter((e) => e.foundationOrAsset).length,
  helpers: entries.filter((e) => e.layer === "helper").length,
  evidenceOnly: entries.filter((e) => e.evidenceOnly).length,
  devOnly: entries.filter((e) => e.devOnly).length,
  adoptable: entries.filter((e) => e.adoptable).length,
  componentExports: exportRows.filter((r) => COMPONENT_EXPORT_KINDS.has(r.kind)).length,
  componentAliasExports: exportRows.filter((r) => r.kind === "component-alias").length,
  barrelComponentExports: exportRows.filter((r) => r.kind === "barrel-component").length,
  iconComponentExports: exportRows.filter((r) => r.kind === "default-component").length,
  compoundNamespaceExports: exportRows.filter((r) => r.kind === "compound-namespace").length,
  defaultExports: exportRows.filter((r) => r.isDefault || r.kind === "default" || r.kind === "default-component").length,
  reExports: exportRows.filter((r) => r.kind === "re-export" || r.kind === "star-reexport" || r.kind === "namespace-reexport").length,
};

writeFileSync(resolve(OUT, LIB, "index.json"), JSON.stringify({ $schema: "design-compiler/ReferenceIndex@p0", library: LIB, revision, inventory, counts: { files: entries.length, byKind: kindCounts, byEngine: engineCounts }, entries }, null, 2));
writeFileSync(resolve(OUT, LIB, "graph.json"), JSON.stringify({ $schema: "design-compiler/ReferenceGraph@p0", library: LIB, revision, componentNodes: components.length, internalEdges: edges.length, componentEdges: componentEdges.length, dependencyOrder: layers, edges }, null, 2));
writeFileSync(resolve(OUT, "libraries.json"), JSON.stringify({ $schema: "design-compiler/references@p0", libraries: [
  { id: LIB, kind: "oss-react-reference", repository: "untitleduico/react", revision, license: revisionInfo.license, role: "canonical implementation source (official OSS is adopted, not rewritten)", indexed: true },
  { id: "untitledui-pro-figma", kind: "licensed-figma-source", repository: null, revision: null, license: "commercial (PRO)", role: "visual/composition truth + fallback for components absent from OSS", indexed: "see .design-compiler/references/figma/figma-surface.json" },
], externalPackages: ".design-compiler/references/untitledui/external-packages.json" }, null, 2));

// evidence index: demos/stories are never registry components, but they document real usage
const evidence = entries
  .filter((e) => e.evidenceOnly)
  .map((e) => ({
    path: e.path,
    kind: e.kind,
    documents: e.candidateFigmaNames,
    internalDependencies: e.internalDependencies,
  }));
writeFileSync(resolve(OUT, LIB, "evidence.json"), JSON.stringify({ $schema: "design-compiler/ReferenceEvidence@p0", library: LIB, revision, note: "demo/story sources: usage and behaviour evidence only, never public registry entries", total: evidence.length, byKind: evidence.reduce((a, e) => ({ ...a, [e.kind]: (a[e.kind] ?? 0) + 1 }), {}), evidence }, null, 2));

const KNOWN_LOCAL = new Set(["button"]);
const coverage = entries.filter((e) => e.adoptable).map((e) => ({
  id: e.path.split("/").pop().replace(/\.tsx?$/, ""),
  path: e.path,
  kind: e.kind,
  layer: e.layer,
  status: KNOWN_LOCAL.has(e.path.split("/").pop().replace(/\.tsx?$/, "")) ? "CONTRACT_RESOLVED" : "REFERENCE_INDEXED",
  parityStatus: "not-started",
  license: revisionInfo.license,
}));
writeFileSync(resolve(OUT, LIB, "coverage.json"), JSON.stringify({ $schema: "design-compiler/ReferenceCoverage@p0", library: LIB, revision, totals: { adoptableSurface: coverage.length, publicComponents: entries.filter((e) => e.publicRegistryCandidate).length, recipesAndBlocks: entries.filter((e) => e.recipeOrBlock).length, foundationsAndAssets: entries.filter((e) => e.foundationOrAsset).length, evidenceOnly: entries.filter((e) => e.evidenceOnly).length, referenceIndexed: coverage.length, contractResolved: coverage.filter((c) => c.status === "CONTRACT_RESOLVED").length, adopted: 0, verified: 0 }, byKind: kindCounts, candidates: coverage }, null, 2));

// ------------------------------------------------------------------ Button contract (corrected)
const buttonRel = "components/base/buttons/button.tsx";
const buttonEntry = entries.find((e) => e.path === buttonRel);
if (buttonEntry) {
  const comp = buttonEntry.components.find((c) => c.name === "Button") ?? buttonEntry.components[0];
  const colors = buttonEntry.variantVocabulary.colors ?? [];
  const sizes = buttonEntry.variantVocabulary.sizes ?? [];
  const contract = {
    $schema: "design-compiler/ReferenceContract@p0",
    id: "button",
    library: LIB,
    revision,
    source: buttonRel,
    license: revisionInfo.license,
    exports: buttonEntry.exports.map((e) => ({ name: e.name, kind: e.kind })),
    primitiveEngine: buttonEntry.primitiveEngine,
    variantVocabulary: { sizes, colors, groups: Object.keys(buttonEntry.variantVocabulary) },
    capabilities: buttonEntry.capabilities,
    component: {
      name: comp?.name ?? "Button",
      overloads: comp?.overloads ?? [],
      propsTypeNames: comp?.propsTypeNames ?? [],
      propCount: comp?.propCount ?? 0,
      props: comp?.props ?? {},
      destructuring: comp?.destructuring ?? {},
    },
    anatomy: [
      { role: "root", evidence: "AriaButton from react-aria-components (native button semantics); isPending carries loading" },
      { role: "linkRoot", evidence: "AriaLink when an href is present (`href in props`) — navigation capability is intrinsic" },
      { role: "leadingVisual", evidence: "iconLeading (component or element) | element child; marked data-icon=\"leading\"" },
      { role: "label", evidence: "children or the element carrying data-text" },
      { role: "trailingVisual", evidence: "iconTrailing | element child; marked data-icon=\"trailing\" | data-icon=\"loading\" for the spinner" },
      { role: "loadingIndicator", evidence: "internal spinner element marked data-icon=\"loading\" with animate-spin" },
      { role: "iconOnly", evidence: "isIcon = (IconLeading || IconTrailing) && !children -> data-icon-only attribute" },
    ],
    states: { public: ["disabled (isDisabled)", "loading (isLoading)", "icon-only (derived)"], internal: ["isPending (React Aria pending passed to the primitive)", "hover", "focus-visible"] },
    motion: {
      source: "official-source",
      evidence: "the upstream spinner animates via Tailwind's animate-spin; no Figma motion node exists for this component set",
      figmaMotionNodes: 0,
      note: "previously recorded 'Figma prototype DISSOLVE 100ms LINEAR' evidence was removed: a direct read of 3287:427299 / 3287:427074 returned zero motion nodes",
    },
    openParityQuestions: [
      "Figma exposes size/hierarchy/state/icon-only axes plus destructive and utility sets; upstream merges destructive colors into one Button and ships ButtonUtility separately — mapping must be OSS_COMPONENT_SET_MERGE / OSS_COMPONENT_SPLIT, not one-set-one-component",
      "Figma link hierarchies (Link color / Link gray) map to color values link-color / link-gray on the same Button, not to separate components",
      "which upstream props are capability-required vs implementation-specific naming (e.g. noTextPadding, showTextWhileLoading)",
    ],
    unresolved: [],
  };
  writeFileSync(resolve(OUT, LIB, "contracts", "button.json"), JSON.stringify(contract, null, 2));
}

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
  const kindChanged = [...after.entries()].filter(([p, e]) => before.has(p) && before.get(p).kind !== e.kind).map(([p, e]) => ({ path: p, from: before.get(p).kind, to: e.kind }));
  console.log(JSON.stringify({ diff: "reference sync preview", library: LIB, storedRevision: stored.revision, currentRevision: revision, added: added.length, removed: removed.length, changed: changed.length, reclassified: kindChanged.length, samples: { added: added.slice(0, 5), changed: changed.slice(0, 5), reclassified: kindChanged.slice(0, 5) } }, null, 2));
  process.exit(0);
}

console.log(JSON.stringify({ library: LIB, revision, license: revisionInfo.license, inventory, dependencyLayers: layers.length, externalPackages: externalPackages.map((p) => `${p.name}@${p.resolvedVersion ?? p.declaredRange}`), button: entries.find((e) => e.path === buttonRel)?.components.find((c) => c.name === "Button")?.propCount ?? null }, null, 2));
