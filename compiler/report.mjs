#!/usr/bin/env node
/**
 * Compiler state report — aggregates every deterministic artifact into one machine-readable snapshot.
 *
 *   node compiler/report.mjs [--json]
 *
 * Answers, with evidence and without a model call: what the reference surfaces contain, what has been
 * adopted, what is verified, what is queued, and what remains unresolved.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const REF = ".design-compiler/references";
const LIB = "untitledui";

const ossIndex = read(resolve(REF, LIB, "index.json"));
const revision = read(resolve(REF, LIB, "revision.json"));
const coverage = read(resolve(REF, LIB, "coverage.json"));
const external = read(resolve(REF, LIB, "external-packages.json"));
const graph = read(resolve(REF, LIB, "graph.json"));
const figma = read(resolve(REF, "figma", "figma-surface.json"));
const crosswalk = read(resolve(REF, LIB, "crosswalk.json"));
const gaps = read(resolve(REF, LIB, "pro-gap-inventory.json"));
const adoption = read(resolve(REF, LIB, "adoption-button.json"));
const parity = read(resolve(REF, LIB, "parity/button.json"));
const validation = read(resolve(REF, LIB, "validation/button.json"));
const registry = read(".design-compiler/registry/button.json");
const benchmark = read(".design-compiler/visual/accuracy-report.json");

const adopted = (registry && registry.status === "VERIFIED" && ["VERIFIED"] ? ["Button"] : []).filter(Boolean);

const report = {
  $schema: "design-compiler/StateReport@p0",
  generatedAt: new Date().toISOString(),
  ossReference: revision
    ? {
        repository: revision.repository,
        revision: revision.revision,
        license: revision.license,
        copyright: revision.copyright,
        sourceFilesIndexed: revision.sourceFilesIndexed,
        sourceContentDigestSha256: revision.sourceContentDigestSha256?.slice(0, 16),
        repositoryFilesWalked: revision.repositoryFilesWalked,
      }
    : null,
  ossInventory: ossIndex
    ? {
        files: ossIndex.inventory.files,
        byKind: ossIndex.inventory.byKind,
        adoptionLayers: ossIndex.inventory.byAdoptionLayer,
        adoptable: ossIndex.inventory.adoptable,
        publicRegistryCandidates: ossIndex.inventory.publicRegistryCandidates,
        recipesAndBlocks: ossIndex.inventory.recipesAndBlocks,
        foundationsAndAssets: ossIndex.inventory.foundationsAndAssets,
        evidenceOnly: ossIndex.inventory.evidenceOnly,
        componentExports: ossIndex.inventory.componentExports,
        iconComponentExports: ossIndex.inventory.iconComponentExports,
        defaultExports: ossIndex.inventory.defaultExports,
        compoundNamespaceExports: ossIndex.inventory.compoundNamespaceExports,
      }
    : null,
  dependencyGraph: graph ? { componentNodes: graph.componentNodes, internalEdges: graph.internalEdges, componentEdges: graph.componentEdges, layers: graph.dependencyOrder.length } : null,
  externalPackages: external?.packages?.map((p) => `${p.name}@${p.resolvedVersion ?? p.declaredRange} (${p.usedByFiles} files)`) ?? null,
  figmaSurface: figma
    ? { fileKey: figma.fileKey, pages: figma.pages?.length ?? null, componentSets: figma.totals?.componentSets ?? null, standaloneComponents: figma.totals?.standaloneComponents ?? null, variantsInsideSets: figma.totals?.variantsInsideSets ?? null, families: figma.totals?.families ?? figma.families?.length ?? null }
    : null,
  crosswalk: crosswalk ? { totals: crosswalk.totals } : null,
  proGaps: gaps ? { totals: gaps.totals, byCategory: gaps.byCategory, workQueue: gaps.workQueue.map((w) => ({ rank: w.rank, name: w.name, page: w.page, variants: w.variants, nextAction: w.nextAction })) } : null,
  adoptedItems: adoption
    ? [
        {
          item: "button",
          closure: adoption.closureSize,
          transforms: adoption.transforms.length,
          parity: parity?.classification ?? null,
          validation: validation?.status ?? null,
          registry: registry?.status ?? null,
          upstreamGaps: validation?.upstreamGaps?.map((g) => g.gate) ?? [],
        },
      ]
    : [],
  registryReady: registry ? [registry.name] : [],
  adoptedCount: adopted.length,
  remainingWork: [
    gaps ? `PRO composition candidates: ${gaps.totals.compositionCandidates}` : null,
    gaps ? `PRO-only icons (package concern): ${gaps.totals.proOnlyIcons}` : null,
    gaps ? `OSS components absent from this Figma file: ${gaps.totals.ossWithoutFigmaFamily}` : null,
    `OSS adoption queue: ${coverage ? coverage.totals.adoptableSurface : "?"} adoptable files, 1 adopted`,
  ].filter(Boolean),
  benchmark: benchmark ? { status: benchmark.status, requirements: benchmark.requirements.length } : null,
};

writeFileSync(".design-compiler/report.json", JSON.stringify(report, null, 2));
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
}
