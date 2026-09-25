#!/usr/bin/env node
/**
 * Registry item builder (plan section "REGISTRY / DISTRIBUTION").
 *
 *   node compiler/registry/build.mjs --item button
 *
 * A registry item must carry everything a consumer needs — not just the component file: internal source
 * dependencies, hooks/utilities, styles/theme dependencies, external npm dependencies, icon packages,
 * reference provenance (repo + SHA + license), Figma mappings, coverage/parity status and the
 * public/private distribution policy.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const item = args.item ?? "button";
const REF = ".design-compiler/references";
const LIB = "untitledui";
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);

const adoption = read(resolve(REF, LIB, `adoption-${item}.json`));
const validation = read(resolve(REF, LIB, `validation/${item}.json`));
const parity = read(resolve(REF, LIB, `parity/${item}.json`));
const crosswalk = read(resolve(REF, LIB, "crosswalk.json"));
const external = read(resolve(REF, LIB, "external-packages.json"));
const revision = read(resolve(REF, LIB, "revision.json"));
const ossIndex = read(resolve(REF, LIB, "index.json"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = existsSync("pnpm-lock.yaml") ? readFileSync("pnpm-lock.yaml", "utf8") : "";

if (!adoption) {
  console.error(`no adoption record for item "${item}" — run compiler/adopt/adopt.mjs first`);
  process.exit(2);
}

const resolvedVersion = (name) => {
  const m = new RegExp(`^\\s{2}${name.replace(/[/@]/g, (c) => `\\${c}`)}@([^:\\s]+):`, "m").exec(lock);
  return m?.[1] ?? pkg.dependencies?.[name]?.replace(/^[^0-9]*/, "") ?? null;
};

// Figma mapping for this item, from the crosswalk (relationship + evidence)
// Only families that are actually about this component: the name must reference it and the mapped source
// must be the item's own file (axis-value expansion can otherwise pull unrelated families in).
const figmaKeys =
  crosswalk?.mappings?.filter((m) => new RegExp(item, "i").test(m.figma.name) && m.code?.some((c) => c.source === `components/base/buttons/${item}.tsx`)) ?? [];
const mapping = figmaKeys[0] ?? null;

const styleFiles = adoption.files.filter((f) => f.localPath.endsWith(".css")).map((f) => f.localPath);
const componentFiles = adoption.files.filter((f) => f.localPath.endsWith(".tsx")).map((f) => f.localPath);
const helperFiles = adoption.files.filter((f) => f.localPath.endsWith(".ts") && !f.localPath.endsWith(".d.ts")).map((f) => f.localPath);

const externalDeps = adoption.externalDependencies
  .filter((d) => !["react", "react-dom"].includes(d))
  .map((name) => ({
    name,
    resolvedVersion: resolvedVersion(name),
    reason: /icons/.test(name) ? "icon components used by the component's slots" : /react-aria/.test(name) ? "behaviour + accessibility primitives" : /tailwind-merge/.test(name) ? "class merging in cx()" : "runtime dependency of the adopted source",
  }));

const tailwindPlugins = ["tailwindcss-animate", "tailwindcss-react-aria-components", "@tailwindcss/typography"]
  .filter((p) => (pkg.dependencies?.[p] ?? pkg.devDependencies?.[p]))
  .map((name) => ({ name, resolvedVersion: resolvedVersion(name), reason: "required by the adopted stylesheet (globals.css @plugin directives)" }));

const statusChain = [
  ["REFERENCE_INDEXED", Boolean(ossIndex?.entries?.some((e) => e.path.includes(`/buttons/${item}.tsx`)))],
  ["SOURCE_ADOPTED", adoption.closureSize > 0],
  ["DEPENDENCIES_RESOLVED", Boolean(validation?.gates?.find((g) => g.gate === "DEPENDENCIES_RESOLVED")?.pass)],
  ["FIGMA_MAPPED", Boolean(mapping)],
  ["TYPECHECK_PASS", Boolean(validation?.gates?.find((g) => g.gate === "TYPECHECK_PASS")?.pass)],
  ["SSR_PASS", Boolean(validation?.gates?.find((g) => g.gate === "SSR_PASS")?.pass)],
  ["BEHAVIOR_PASS", Boolean(validation?.gates?.find((g) => g.gate === "BEHAVIOR_PASS")?.pass)],
  ["ACCESSIBILITY_PASS", Boolean(validation?.gates?.find((g) => g.gate === "ACCESSIBILITY_PASS")?.pass)],
  ["VISUAL_PASS", Boolean(validation?.gates?.find((g) => g.gate === "VISUAL_PASS")?.pass)],
  ["PRODUCTION_PASS", Boolean(validation?.gates?.find((g) => g.gate === "PRODUCTION_PASS")?.pass)],
];
const verified = statusChain.every(([, ok]) => ok);

const registryItem = {
  $schema: "design-compiler/registry-item@p0",
  name: item,
  type: "design-system-component",
  title: item.charAt(0).toUpperCase() + item.slice(1),
  description: "Adopted from the official Untitled UI OSS React source; visuals reconciled against the licensed PRO Figma.",
  files: adoption.files.map((f) => ({ path: f.localPath, upstream: f.upstreamPath, sha256: f.localSha256, kind: f.kind })),
  dependencies: {
    components: componentFiles,
    helpers: helperFiles,
    styles: styleFiles,
    projectStyles: ["src/styles/fonts.css"],
    external: externalDeps,
    tailwindPlugins,
    iconPackages: (external?.packages ?? []).filter((p) => /icons/.test(p.name)).map((p) => ({ name: p.name, resolvedVersion: p.resolvedVersion, redistribute: p.redistribute })),
  },
  reference: {
    repository: adoption.repository,
    revision: adoption.revision,
    license: adoption.license,
    copyright: revision?.copyright ?? null,
    attributionRequired: true,
    transforms: adoption.transforms,
  },
  figma: {
    fileKey: crosswalk?.figmaFile ?? null,
    componentSets: figmaKeys.map((m) => ({ id: m.figma.componentSetId, name: m.figma.name, variants: m.figma.variants, relationship: m.relationship, evidence: m.evidence })),
    parity: parity ? { classification: parity.classification, perceptualPercent: parity.pixels.perceptualPercent, dominantCause: parity.pixels.dominantCause, report: `${REF}/${LIB}/parity/${item}.json` } : null,
  },
  coverage: { status: statusChain.map(([name, pass]) => ({ state: name, pass })), upstreamGaps: validation?.upstreamGaps ?? [] },
  install: {
    command: `npx ds-compiler add ${item}`,
    files: adoption.files.map((f) => f.localPath),
    consumes: ["src/styles/fonts.css (or an equivalent Inter face)", ...styleFiles],
    postInstall: [
      "import the adopted stylesheet in the app entry so Tailwind sees the upstream theme",
      "Tailwind v4 plugins declared in the stylesheet must be installed (listed under dependencies.tailwindPlugins)",
      ...(validation?.upstreamGaps ?? []).map((g) => `upstream gap: ${g.gate} — ${g.consumerRemedy}`),
    ],
  },
  distribution: {
    policy: "public-source",
    license: adoption.license,
    note: "MIT-licensed upstream source; keep the provenance header and the upstream LICENSE notice. PRO-derived compositions stay private unless their license permits publication.",
  },
  status: verified ? "VERIFIED" : statusChain.filter(([, ok]) => !ok).map(([name]) => name),
};

mkdirSync(".design-compiler/registry", { recursive: true });
writeFileSync(resolve(".design-compiler/registry", `${item}.json`), JSON.stringify(registryItem, null, 2));
console.log(
  JSON.stringify(
    {
      item,
      status: registryItem.status,
      files: registryItem.files.length,
      external: externalDeps.map((d) => `${d.name}@${d.resolvedVersion}`),
      plugins: tailwindPlugins.map((p) => p.name),
      figmaMappings: registryItem.figma.componentSets.map((c) => `${c.name} (${c.relationship})`),
      parity: registryItem.figma.parity?.classification ?? null,
      upstreamGaps: (validation?.upstreamGaps ?? []).map((g) => g.gate),
    },
    null,
    2,
  ),
);
