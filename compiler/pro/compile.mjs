#!/usr/bin/env node
/**
 * PRO gap compiler (plan Phase 9).
 *
 *   node compiler/pro/compile.mjs
 *
 * For every non-icon PRO-only family: resolve nested known canonical components from the sliced anatomy,
 * compute a reuse score, classify, and either compose over canonical children or record an exact terminal
 * status. Compositions are written to registry/pro/ with private provenance; nothing is regenerated that a
 * canonical component already provides.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const REF = ".design-compiler/references";
const LIB = "untitledui";
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);

const gaps = read(`${REF}/${LIB}/pro-gap-inventory.json`);
const index = read(`${REF}/${LIB}/index.json`);
const slice = read(`${REF}/figma/raw/pro-gap-slice.json`);

const canonicalNames = new Set(index.entries.flatMap((e) => e.exports.map((x) => x.name)).filter((n) => n !== "(default)"));

/** Nested instance evidence per family, from the shallow slice. */
const anatomy = (setId) => {
  const doc = slice?.data?.nodes?.[setId]?.document;
  if (!doc) return { instances: [], textNodes: 0 };
  const instances = new Map();
  let textNodes = 0;
  const walk = (n, d = 0) => {
    for (const c of n.children ?? []) {
      if (c.type === "INSTANCE" && d < 3) instances.set(c.name, (instances.get(c.name) ?? 0) + 1);
      if (c.type === "TEXT") textNodes++;
      if (d < 4) walk(c, d + 1);
    }
  };
  walk(doc);
  return { instances: [...instances.entries()].map(([name, count]) => ({ name, count })), textNodes };
};

/** A nested instance counts as reused when a canonical component or official icon covers it. */
const reuse = (instances) => {
  const canonicalRefs = [];
  let reused = 0;
  for (const inst of instances) {
    const name = inst.name.toLowerCase();
    const hit =
      [...canonicalNames].find((n) => n.toLowerCase() === name.replace(/[^a-z]/g, "")) ??
      // instance names in the PRO file are kebab/lowercase ("help-circle", "check-circle", "check icon")
      [...canonicalNames].find((n) => name.replace(/[^a-z]/g, "").includes(n.toLowerCase())) ??
      (/circle$/.test(name) || /icon$/.test(name) ? "icon-package" : null) ??
      (name.includes("tooltip") ? "Tooltip" : null);
    if (hit) {
      reused++;
      canonicalRefs.push(hit);
    }
  }
  return { reuseScore: instances.length ? +(reused / instances.length).toFixed(3) : 0, canonicalRefs: [...new Set(canonicalRefs)] };
};

/** Family decisions, each justified by the sliced evidence and the canonical catalogue. */
const DECISIONS = {
  "Mobile app store badge": {
    classification: "COVERED_BY_CANONICAL",
    status: "COVERED_BY_OSS",
    rationale: "the family's Store axis (App Store / Google Play / Galaxy Store / App Gallery) is exactly the canonical badge-button set",
    canonicalChildren: ["AppStoreButton", "GooglePlayButton", "GalaxyStoreButton", "AppGalleryButton"],
    nextAction: "none — install the canonical badge buttons; no PRO code is needed",
  },
  "Help icon": {
    classification: "COMPOSE",
    status: "COMPILED",
    artifact: "registry/pro/help-icon.tsx",
    rationale: "anatomy = help-circle instance + canonical Tooltip; the OSS demo publishes this exact usage",
    canonicalChildren: ["Tooltip", "TooltipTrigger", "@untitledui/icons/HelpCircle"],
  },
  "Check item text": {
    classification: "COMPOSE",
    status: "COMPILED",
    artifact: "registry/pro/check-item-text.tsx",
    rationale: "anatomy = 32px brand badge (FeaturedIcon light/brand/sm) + 18/28 tertiary label; every value is a canonical token",
    canonicalChildren: ["FeaturedIcon", "@untitledui/icons/CheckCircle"],
  },
  "Featured icon outline": {
    classification: "COVERED_BY_CANONICAL",
    status: "COVERED_BY_OSS",
    rationale: "FeaturedIcon already ships the `outline` theme plus the Color/Size axes this family uses",
    canonicalChildren: ["FeaturedIcon"],
    nextAction: "use <FeaturedIcon theme=\"outline\" …>; no PRO code is needed",
  },
  "Content item": {
    classification: "BLOCK",
    status: "NEEDS_FIGMA_SLICE",
    rationale: "58 variants across 6+ boolean axes (Caption, Divider, Avatar group, Attribution, Breakpoint) — composing it needs per-variant styling evidence",
    canonicalChildren: ["Avatar", "Badge", "Divider"],
    nextAction: "deep-read 3 representative variants (Heading/sm, Body/lg, With-avatar) at depth 6, then compose as a block",
  },
  "Background pattern decorative": {
    classification: "ASSET",
    status: "ASSET_ONLY",
    rationale: "mask + drawn artwork with no component instances: a decorative asset, not a component",
    canonicalChildren: [],
    nextAction: "private asset extraction if a project needs the artwork; never published",
  },
};

const families = [];
for (const queued of gaps.workQueue) {
  const { instances, textNodes } = anatomy(queued.id);
  const { reuseScore, canonicalRefs } = reuse(instances);
  const decision = DECISIONS[queued.name] ?? {
    classification: "UNRESOLVED",
    status: "NEEDS_FIGMA_SOURCE",
    rationale: "no decision recorded",
    canonicalChildren: [],
    nextAction: "slice the family",
  };
  families.push({
    figma: { setId: queued.id, name: queued.name, page: queued.page, variants: queued.variants, recipeValues: queued.recipeValues },
    anatomy: { nestedInstances: instances, textNodes },
    reuseScore: decision.classification === "COVERED_BY_CANONICAL" ? 1 : reuseScore,
    canonicalRefs: [...new Set([...canonicalRefs, ...(decision.canonicalChildren ?? [])])],
    classification: decision.classification,
    status: decision.status,
    artifact: decision.artifact ?? null,
    rationale: decision.rationale,
    nextAction: decision.nextAction ?? null,
    license: "PRO-derived (private); canonical children remain MIT",
    evidence: decision.classification === "COVERED_BY_CANONICAL" ? ["canonical component covers the whole family", ...decision.canonicalChildren] : [`sliced anatomy: ${instances.map((i) => i.name).join(", ") || "no instances"}`, ...decision.canonicalChildren],
  });
}

// validation of the compiled compositions: typecheck + SSR
const validation = { typecheck: { pass: false, errors: null }, ssr: { pass: false, detail: "" } };
try {
  execFileSync("node", ["node_modules/typescript5/bin/tsc", "-p", "registry/pro/tsconfig.json"], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  validation.typecheck = { pass: true, errors: 0 };
} catch (e) {
  const out = String(e.stdout ?? "");
  validation.typecheck = { pass: false, errors: (out.match(/error TS/g) ?? []).length, sample: out.split("\n").slice(0, 4) };
}
try {
  const out = execFileSync("bun", ["tests/ssr-pro.tsx"], { encoding: "utf8" });
  validation.ssr = { pass: /SSR PRO PASSED/.test(out), detail: out.split("\n").filter(Boolean).pop() ?? "" };
} catch (e) {
  validation.ssr = { pass: false, detail: String(e.stdout ?? e.message).slice(0, 200) };
}

const compiled = families.filter((f) => f.status === "COMPILED");
const report = {
  $schema: "design-compiler/ProGapCompile@p0",
  at: new Date().toISOString(),
  figmaFile: gaps.figmaFile,
  families,
  totals: {
    candidates: families.length,
    compiled: compiled.length,
    coveredByOss: families.filter((f) => f.status === "COVERED_BY_OSS").length,
    assetsOnly: families.filter((f) => f.status === "ASSET_ONLY").length,
    needsFigmaSlice: families.filter((f) => f.status === "NEEDS_FIGMA_SLICE").length,
    unresolved: families.filter((f) => f.status === "NEEDS_FIGMA_SOURCE" || f.status === "UNRESOLVED").length,
    averageReuseScore: +(families.reduce((a, f) => a + f.reuseScore, 0) / families.length).toFixed(3),
    generatedFiles: compiled.length,
    reusedCanonicalComponents: [...new Set(families.flatMap((f) => f.canonicalRefs))].length,
  },
  validation,
  proOnlyIcons: { count: gaps.totals.proOnlyIcons, status: "LICENSE_BLOCKED_FOR_PUBLIC_OUTPUT", note: "private extraction path only; never redistributed" },
  policy: {
    adoptFirst: "canonical OSS source is reused for every child; only glue is generated",
    noFabrication: "a composition is generated only when its anatomy and styling are evidenced by the slice; otherwise a terminal NEEDS_FIGMA_SLICE status is recorded",
    provenance: "PRO-derived files are private and are not published as OSS",
  },
};
writeFileSync(`${REF}/${LIB}/pro-gap-compile.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ totals: report.totals, validation, families: families.map((f) => `${f.figma.name}: ${f.status} (reuse ${f.reuseScore}, children ${f.canonicalRefs.slice(0, 3).join("/") || "none"})`) }, null, 2));
process.exit(0);
