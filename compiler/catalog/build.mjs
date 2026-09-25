#!/usr/bin/env node
/**
 * Builds `.design-compiler/catalog.json` — the browsable index behind /catalog.html.
 *
 *   node compiler/catalog/build.mjs
 *
 * `.design-compiler/registry/index.json` stays authoritative for membership, tier, layer, status and
 * installability; this script only joins the per-item registry files (module, export, install command)
 * and the PRO/verification records, so the catalog can never drift from the registry.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = ".design-compiler";
const index = JSON.parse(readFileSync(`${ROOT}/registry/index.json`, "utf8"));
const sourceIndex = JSON.parse(readFileSync(`${ROOT}/references/untitledui/index.json`, "utf8"));
const byUpstream = new Map(sourceIndex.entries.map((e) => [e.path, e]));

const readItem = (id) => {
  for (const file of [`${ROOT}/registry/${id}.json`, `${ROOT}/registry/${id.toLowerCase()}.json`]) {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  }
  return null;
};

/** Where a reader would look for it: the upstream directory, not the tier bookkeeping. */
const groupOf = (upstream, layer) => {
  if (!upstream) return layer ?? "other";
  const m = /^components\/([^/]+)\/([^/]+)/.exec(upstream);
  if (m) return m[1] === "foundations" ? `${m[1]} / ${m[2]}` : `${m[1]} / ${m[2]}`;
  if (/^utils\//.test(upstream)) return "primitives / utils";
  if (/^hooks\//.test(upstream)) return "primitives / hooks";
  if (/^styles\//.test(upstream)) return "styles";
  return layer ?? "other";
};

/** Props a component can be previewed with, taken from its own destructuring (literals) plus text-like
 *  props the source declares without a default. Nothing outside the declared props is ever invented. */
const TEXT_PROPS = new Set(["children", "label", "placeholder", "title", "description", "text", "heading", "content", "name", "value", "aria-label"]);
const previewPropsFor = (entry, exportName) => {
  const component = entry?.components?.find((c) => c.name === exportName);
  const destructuring = component?.destructuring ?? {};
  const props = {};
  for (const [prop, info] of Object.entries(destructuring)) {
    const raw = info?.default;
    if (raw == null) {
      if (TEXT_PROPS.has(prop)) props[prop] = null; // filled per item by the viewer
      continue;
    }
    try {
      const literal = JSON.parse(raw);
      if (["string", "number", "boolean"].includes(typeof literal)) props[prop] = literal;
    } catch {
      // non-literal default (an expression): skip rather than guess
    }
  }
  return props;
};

/** Reading order: the design-system primitives first, application screens later, bookkeeping last. */
const GROUP_PRIORITY = [/^base \//, /^foundations \//, /^primitives \//, /^application \//, /^styles$/, /^shared-assets/];
const groupRank = (group) => {
  const rank = GROUP_PRIORITY.findIndex((re) => re.test(group));
  return rank === -1 ? GROUP_PRIORITY.length : rank;
};

const items = index.items
  .map((entry) => {
    const item = readItem(entry.id);
    const files = item?.files ?? [];
    // first source-owning file: helpers and styles come after the component in every registry item
    const entryFile = files.find((f) => /\.tsx$/.test(f.path) && f.kind !== "HELPER") ?? files.find((f) => /\.tsx?$/.test(f.path));
    const upstream = entryFile?.upstream ?? entry.mapping?.upstream ?? null;
    const source = upstream ? byUpstream.get(upstream) : undefined;
    const candidates = (source?.exports ?? []).filter((e) => e.kind === "component" || e.kind === "default-component");
    const pascal = entry.id.split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join("");
    // prefer the public export: an exact name match, then any export that is not a *Base/*Item building block
    const component = candidates.find((e) => e.name === pascal) ?? candidates.find((e) => !/(Base|Item|Raw)$/.test(e.name)) ?? candidates[0];
    return {
      id: entry.id,
      layer: entry.layer ?? null,
      tier: entry.tier ?? null,
      status: entry.status ?? null,
      installable: Boolean(entry.installable),
      files: entry.files ?? files.length,
      figmaPresence: entry.figmaPresence ?? null,
      group: groupOf(upstream, entry.layer),
      upstream: upstream,
      module: entryFile?.path ?? null,
      exportName: component?.name ?? null,
      isDefaultExport: component?.kind === "default-component" || Boolean(component?.isDefault),
      sourceKind: source?.kind ?? null,
      engine: source?.primitiveEngine ?? null,
      previewProps: previewPropsFor(source, component?.name),
      external: item?.external ?? [],
      install: item?.install?.command ?? null,
      distribution: item?.distribution ?? "public-source",
      figma: item?.figma?.componentSet ?? item?.figma?.figmaComponentSet ?? null,
    };
  })
  .sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.group.localeCompare(b.group) || a.id.localeCompare(b.id));

const pro = existsSync(`${ROOT}/references/untitledui/pro-gap-compile.json`)
  ? JSON.parse(readFileSync(`${ROOT}/references/untitledui/pro-gap-compile.json`, "utf8")).families.map((f) => ({
      name: f.figma.name,
      status: f.status,
      classification: f.classification,
      artifact: f.artifact ?? null,
      reuse: f.reuseScore,
    }))
  : [];

const manifest = existsSync(`${ROOT}/manifest.json`) ? JSON.parse(readFileSync(`${ROOT}/manifest.json`, "utf8")) : {};
const verifiedCanaries = Object.values(manifest)
  .filter((m) => m.status === "verified")
  .map((m) => ({ source: m.source, figma: m.figmaComponentSet, specimens: m.verifiedSpecimens?.length ?? 0 }));

const tally = (key) => items.reduce((m, i) => ((m[i[key] ?? "unknown"] = (m[i[key] ?? "unknown"] ?? 0) + 1), m), {});
const byGroup = tally("group");
const catalog = {
  $schema: "design-compiler/Catalog@p0",
  library: index.library,
  reference: index.reference,
  source: `${ROOT}/registry/index.json`,
  totals: {
    items: items.length,
    installable: items.filter((i) => i.installable).length,
    byLayer: tally("layer"),
    byTier: tally("tier"),
    byStatus: tally("status"),
    byGroup,
    previewable: items.filter((i) => i.exportName && i.module?.endsWith(".tsx")).length,
    figmaVerifiedCanaries: verifiedCanaries.length,
    proFamilies: pro.length,
  },
  groups: Object.keys(byGroup).sort(),
  verifiedCanaries,
  proFamilies: pro,
  items,
};
writeFileSync(`${ROOT}/catalog.json`, JSON.stringify(catalog, null, 2));

// the catalog must not invent membership: reconcile against the registry index it derives from
const drift = items.length !== index.counts.items || catalog.totals.installable !== index.counts.installable;
console.log(
  JSON.stringify(
    {
      wrote: `${ROOT}/catalog.json`,
      items: items.length,
      installable: catalog.totals.installable,
      registryIndex: { items: index.counts.items, installable: index.counts.installable },
      groups: catalog.groups.length,
      previewable: catalog.totals.previewable,
      byLayer: catalog.totals.byLayer,
      reconciled: !drift,
    },
    null,
    2,
  ),
);
process.exit(drift ? 1 : 0);
