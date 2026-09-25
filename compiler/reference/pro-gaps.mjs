#!/usr/bin/env node
/**
 * PRO-only gap inventory.
 *
 *   node compiler/reference/pro-gaps.mjs
 *
 * Turns the crosswalk into the work queue the plan describes: what the licensed PRO Figma contains that the
 * pinned OSS repository does not implement, ranked so the highest-value, lowest-risk items come first.
 *
 * Every entry carries the classification the plan asks for:
 *   FIGMA_ONLY · PRO_ONLY_ICON · OSS_COMPOSITION · OSS_COMPONENT_SPLIT · EXTERNAL_PACKAGE_RESOLVED ·
 *   NOT_PRESENT_IN_CURRENT_FIGMA_FILE
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REF = ".design-compiler/references";
const LIB = "untitledui";
const crosswalk = JSON.parse(readFileSync(resolve(REF, LIB, "crosswalk.json"), "utf8"));
const gaps = JSON.parse(readFileSync(resolve(REF, LIB, "gaps.json"), "utf8"));
const ossIndex = JSON.parse(readFileSync(resolve(REF, LIB, "index.json"), "utf8"));
const registryBootstrapped = existsSync(".design-compiler/registry") ? readdirSync(".design-compiler/registry").map((f) => f.replace(/\.json$/, "")) : [];

const surface = JSON.parse(readFileSync(resolve(REF, "figma", "figma-surface.json"), "utf8"));
const cleanPage = (n) => String(n ?? "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
const pageName = new Map((surface.pages ?? []).map((p) => [p.id, cleanPage(p.name)]));
const ICON_PAGES = new Set(["Icons", "Misc icons", "Logos", "Background elements", "Miscellaneous assets", "Design annotations", "Content"]);

/** Best-guess next action per gap, derived from what the family looks like — never invented semantics. */
const nextAction = (m) => {
  const codeTargets = m.code?.length ?? 0;
  if (m.relationship === "OSS_COMPOSITION") return "COMPOSE: build as a recipe over verified components; do not create a new primitive";
  if (m.relationship === "OSS_COMPONENT_SPLIT") return codeTargets > 1 ? "SPLIT: multiple verified components cover this family; map each axis value" : "MAP: single component already covers it";
  const pageLabel = pageName.get(m.figma.page) ?? m.figma.page;
  if (codeTargets === 0 && ICON_PAGES.has(pageLabel)) return "ASSET: icon/asset surface — belongs to an icon or asset package path, not a component port";
  if (codeTargets === 0) return "DISCOVER: needs a semantic pass before it can be classified as component/recipe/block";
  return "REUSE";
};

const entries = crosswalk.mappings.map((m) => ({
  id: m.figma.componentSetId,
  name: m.figma.name,
  page: pageName.get(m.figma.page) ?? m.figma.page,
  pageId: m.figma.page,
  variants: m.figma.variants,
  relationship: m.relationship,
  verified: m.verified,
  codeTargets: (m.code ?? []).map((c) => c.export),
  recipeValues: (m.recipeCandidates ?? []).length,
  nextAction: nextAction(m),
  evidence: m.evidence,
}));

const isIconGap = (e) => ICON_PAGES.has(e.page) && e.codeTargets.length === 0;
const category = (e) => {
  if (e.relationship === "EXTERNAL_PACKAGE" && e.codeTargets.length) return "EXTERNAL_PACKAGE_RESOLVED";
  if (isIconGap(e)) return "PRO_ONLY_ICON";
  if (e.relationship === "OSS_COMPOSITION") return "OSS_COMPOSITION";
  if (e.relationship === "OSS_COMPONENT_SPLIT") return "OSS_COMPONENT_SPLIT";
  if (e.relationship === "FIGMA_ONLY") return "FIGMA_ONLY";
  if (e.relationship === "EXACT_OSS_MATCH" || e.relationship === "OSS_COMPONENT_SET_MERGE") return "MAPPED";
  return e.relationship;
};

const byCategory = {};
for (const e of entries) {
  const c = category(e);
  (byCategory[c] ??= []).push(e);
}

/** Work queue: components/recipes first (smallest surface, real semantics), icons last (package concern). */
const workQueue = [...(byCategory.OSS_COMPOSITION ?? []), ...(byCategory.FIGMA_ONLY ?? []), ...(byCategory.OSS_COMPONENT_SPLIT ?? [])]
  .filter((e) => e.codeTargets.length === 0 || e.relationship === "OSS_COMPOSITION")
  .sort((a, b) => (a.recipeValues > 0 ? -1 : 1) - (b.recipeValues > 0 ? -1 : 1) || b.variants - a.variants)
  .slice(0, 40)
  .map((e, i) => ({ rank: i + 1, ...e }));

const report = {
  $schema: "design-compiler/ProGapInventory@p0",
  library: LIB,
  revision: crosswalk.revision,
  figmaFile: crosswalk.figmaFile,
  totals: {
    figmaFamilies: entries.length,
    mapped: (byCategory.MAPPED ?? []).length,
    externalPackageResolved: (byCategory.EXTERNAL_PACKAGE_RESOLVED ?? []).length,
    proOnlyIcons: (byCategory.PRO_ONLY_ICON ?? []).length,
    compositionCandidates: (byCategory.OSS_COMPOSITION ?? []).length,
    componentSplit: (byCategory.OSS_COMPONENT_SPLIT ?? []).length,
    figmaOnlyUnclassified: (byCategory.FIGMA_ONLY ?? []).length,
    ossWithoutFigmaFamily: gaps.ossWithoutFigmaFamily.length,
    registryItemsBuilt: registryBootstrapped,
  },
  byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v.length])),
  workQueue,
  ossWithoutFigmaFamily: gaps.ossWithoutFigmaFamily.map((o) => ({ ...o, classification: "NOT_PRESENT_IN_CURRENT_FIGMA_FILE" })),
  notes: [
    "absence from the current PRO STYLES v8.0 file is NOT_PRESENT_IN_CURRENT_FIGMA_FILE; the user may supply further PRO files",
    "PRO-derived output keeps private/licensed provenance and is not published as an OSS clone",
    "icons are a package concern (@untitledui/icons / file-icons / PRO icons), not a component-port concern",
    "the existing OSS inventory stands at " + ossIndex.inventory.adoptable + " adoptable files (" + ossIndex.inventory.publicRegistryCandidates + " public registry candidates)",
  ],
};

writeFileSync(resolve(REF, LIB, "pro-gap-inventory.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      totals: report.totals,
      byCategory: report.byCategory,
      topOfWorkQueue: workQueue.slice(0, 8).map((w) => `${w.rank}. ${w.name} (${w.variants} variants, page ${w.page}) -> ${w.nextAction}`),
      compositionCandidates: (byCategory.OSS_COMPOSITION ?? []).slice(0, 6).map((c) => `${c.name} (${c.variants}) recipeValues=${c.recipeValues}`),
    },
    null,
    2,
  ),
);
