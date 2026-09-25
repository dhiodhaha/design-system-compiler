#!/usr/bin/env node
/**
 * React Aria residue gate (Phase 15).
 *
 *   node compiler/migration/residue.mjs [--json]
 *
 * Classifies every React Aria reference in the repository into:
 *   CANONICAL_RUNTIME   shipping component code — must reach zero
 *   HARNESS             migration evidence (baseline captures, comparison fixtures) — allowed while migrating
 *   BENCHMARK           the Figma-first benchmark implementation — allowed, must never become canonical
 *   DOCUMENTATION       prose/doc references — allowed
 *
 * Exit code is non-zero only for CANONICAL_RUNTIME residue, so this can gate the migration without pretending
 * the migration harness itself is a defect.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";

const RA_RE = /(from|import|require)\s*\(?\s*["'](react-aria-components|react-aria|react-stately|@react-aria\/[a-z-]+|@react-stately\/[a-z-]+)["']/;

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", ".vite"].includes(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(tsx?|mjs|js|css|md|json)$/.test(entry.name)) out.push(path);
  }
  return out;
};

const classify = (path) => {
  if (/^\.design-compiler\//.test(path)) return "HARNESS";
  if (/^src\/components\/ui\//.test(path) || /^visual\//.test(path)) return "BENCHMARK";
  if (/^tests\//.test(path) || /^compiler\/migration\//.test(path)) return "HARNESS";
  if (/^registry\/untitledui\//.test(path) || /^src\//.test(path)) return "CANONICAL_RUNTIME";
  return "DOCUMENTATION";
};

const files = ["registry", "src", "compiler", "visual", "tests", ".design-compiler", "docs", "README.md"].filter((p) => {
  try {
    return statSync(p);
  } catch {
    return false;
  }
});

const occurrences = [];
for (const target of files) {
  const paths = statSync(target).isDirectory() ? walk(target) : [target];
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    if (!RA_RE.test(source)) continue;
    const lines = source.split("\n").filter((l) => RA_RE.test(l));
    const kinds = classify(path);
    for (const line of lines) {
      occurrences.push({ path, kind: kinds, line: line.trim().slice(0, 140) });
    }
  }
}

const byKind = occurrences.reduce((m, o) => ((m[o.kind] = (m[o.kind] ?? 0) + 1), m), {});
const canonical = occurrences.filter((o) => o.kind === "CANONICAL_RUNTIME");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const declared = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).filter((d) => /^(react-aria|react-stately|@react-aria\/|@react-stately\/)/.test(d));

const report = {
  $schema: "design-compiler/BaseUiResidueReport@p0",
  baseUiVersion: JSON.parse(readFileSync("node_modules/@base-ui/react/package.json", "utf8")).version,
  totals: { occurrences: occurrences.length, byKind, canonicalRuntimeFiles: [...new Set(canonical.map((o) => o.path))].length },
  canonicalRuntime: canonical,
  declaredReactAriaPackages: declared,
  gate: { passed: canonical.length === 0, rule: "no React Aria import may remain in canonical runtime code" },
};

console.log(JSON.stringify({ ...report, canonicalRuntime: canonical.slice(0, 20) }, null, 2));
process.exit(canonical.length === 0 ? 0 : 1);
