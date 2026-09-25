// build-surface.cjs — authoritative family inventory for the PRO Figma file
const fs = require("fs");
const path = require("path");
const ROOT = "/home/dhio/untitleduireact/.design-compiler/references/figma";
const RAW = path.join(ROOT, "raw");

// page id -> {raw file (deepest available), order}
const PAGE_SOURCES = [
  { id: "1480:0", file: "pages-01-gettingstarted.json" },
  { id: "1083:118533", file: "pages-02-logos.json" },
  { id: "3463:407484", file: "pages-03b-icons-depth3.json" },
  { id: "1025:31781", file: "pages-04b-miscicons-depth3.json" },
  { id: "12:539", file: "pages-05-badges.json" },
  { id: "1:1183", file: "pages-06-buttons.json" },
  { id: "85:1269", file: "pages-07-inputs.json" },
  { id: "1052:485", file: "pages-08-tooltips.json" },
  { id: "4938:371336", file: "pages-09-backgrounds.json" },
  { id: "1291:157819", file: "pages-10-miscassets.json" },
  { id: "172:4293", file: "pages-11-modals.json" },
  { id: "647:15097", file: "pages-12-content.json" },
  { id: "1054:557", file: "pages-13-designannotations.json" },
];

const notes = [];
const meta = {};
const allFamilies = [];
const iconLike = [];
const pageSummaries = [];

for (const src of PAGE_SOURCES) {
  const d = JSON.parse(fs.readFileSync(path.join(RAW, src.file), "utf8"));
  const data = d.data;
  meta.fileName = data.name;
  meta.lastModified = data.lastModified;
  meta.version = data.version;
  const nodes = data.nodes;
  const nk = src.id;
  if (!nodes[nk]) { notes.push(`page ${nk}: node missing from ${src.file}`); continue; }
  const n = nodes[nk];
  const doc = n.document || {};
  const compSets = n.componentSets || {};
  const comps = n.components || {};
  const setByName = {}; for (const [k, v] of Object.entries(compSets)) (setByName[v.name] = setByName[v.name] || []).push({ id: k, ...v });
  const compByName = {}; for (const [k, v] of Object.entries(comps)) (compByName[v.name] = compByName[v.name] || []).push({ id: k, ...v });
  const usedCompIds = new Set();

  const resolveSet = (name) => (setByName[name] && setByName[name][0]) || null;
  const resolveComp = (name) => {
    const list = compByName[name];
    if (!list) return null;
    const free = list.find(x => !usedCompIds.has(x.id)) || list[0];
    usedCompIds.add(free.id);
    return free;
  };

  const families = [];
  const walk = (node, pathParts) => {
    for (const c of node.children || []) {
      if (c.type === "COMPONENT_SET") {
        const s = resolveSet(c.name);
        const axes = {}; const nonVar = [];
        const defs = c.componentPropertyDefinitions || {};
        for (const [k, v] of Object.entries(defs)) {
          if (v.type === "VARIANT") axes[k] = { values: v.variantOptions || [], default: v.defaultValue };
          else nonVar.push({ name: k, type: v.type, default: v.defaultValue });
        }
        const variantNames = (c.children || []).filter(x => x.type === "COMPONENT").map(x => x.name);
        families.push({
          id: (s && s.id) || null, name: c.name, page: nk, pageName: doc.name, type: "COMPONENT_SET",
          variantCount: variantNames.length, axes, nonVariantProps: nonVar,
          key: (s && s.key) || null, description: (s && s.description) || "",
          parentPath: pathParts.join(" / ") || null,
          sampleVariants: variantNames.slice(0, 3),
        });
      } else if (c.type === "COMPONENT") {
        const s = resolveComp(c.name);
        families.push({
          id: (s && s.id) || null, name: c.name, page: nk, pageName: doc.name, type: "COMPONENT",
          variantCount: 0, axes: {}, nonVariantProps: [],
          key: (s && s.key) || null, description: (s && s.description) || "",
          parentPath: pathParts.join(" / ") || null, sampleVariants: [],
        });
      } else if (c.type === "FRAME" || c.type === "GROUP" || c.type === "SECTION") {
        walk(c, [...pathParts, c.name]);
      }
    }
  };
  walk(doc, []);

  const sets = families.filter(f => f.type === "COMPONENT_SET");
  const standalones = families.filter(f => f.type === "COMPONENT");
  const setVariants = sets.reduce((a, f) => a + f.variantCount, 0);
  pageSummaries.push({
    id: nk, name: doc.name, type: doc.type,
    familyCount: families.length,
    componentSetCount: sets.length,
    componentCount: standalones.length,
    variantCountAcrossSets: setVariants,
    componentKeyCount: families.filter(f => f.key).length,
    missingKeyCount: families.filter(f => !f.key).length,
  });
  allFamilies.push(...families);

  // icon-like classification: page 3463:407484 components + icon sets on Misc icons page
  if (nk === "3463:407484") {
    for (const f of standalones) iconLike.push({ kind: "icon", category: f.parentPath, name: f.name, id: f.id, key: f.key, variantCount: 0 });
  }
  if (nk === "1025:31781") {
    const ICON_SETS = new Set(["Featured icon", "Featured icon outline", "Payment method icon", "Star icon", "Check icon", "Integration icon", "Check item text", "Cursor", "_Dot", "Emoji", "File type icon", "Folder icon", "Social icon"]);
    for (const f of sets) if (ICON_SETS.has(f.name)) iconLike.push({ kind: "icon-set", category: f.parentPath, name: f.name, id: f.id, key: f.key, variantCount: f.variantCount });
    for (const f of standalones) iconLike.push({ kind: f.parentPath && f.parentPath.startsWith("App icons") ? "app-icon" : (f.parentPath && f.parentPath.startsWith("Country flag icons") ? "flag-icon" : "icon"), category: f.parentPath, name: f.name, id: f.id, key: f.key, variantCount: 0 });
  }
}

const missingIds = allFamilies.filter(f => !f.id);
if (missingIds.length) notes.push(`${missingIds.length} families have no resolvable published id/key (not in the per-node components/componentSets maps)`);

const surfaces = {
  fileKey: "sLqnzw7tFXpuPA1TbqsjZx",
  fileName: meta.fileName,
  collectedAt: new Date().toISOString(),
  figmaLastModified: meta.lastModified,
  figmaVersion: meta.version,
  source: "FIGMA_GET_FILE_NODES (depth=3 per page, geometry omitted); ids read from nodes[page].components / componentSets map keys",
  pages: pageSummaries,
  counts: {
    pagesRead: pageSummaries.length,
    componentSets: allFamilies.filter(f => f.type === "COMPONENT_SET").length,
    standaloneComponents: allFamilies.filter(f => f.type === "COMPONENT").length,
    variantsAcrossAllSets: allFamilies.reduce((a, f) => a + f.variantCount, 0),
    families: allFamilies.length,
    familiesWithPublishedKey: allFamilies.filter(f => f.key).length,
  },
  families: allFamilies,
  iconLikeFamilies: iconLike,
  notes: [
    "Raw payloads are saved under raw/; every family id comes from the real map key of nodes[page].components / componentSets (inline node.id fields are redacted by the API proxy).",
    "Variant counts are the number of COMPONENT children of each COMPONENT_SET as returned by FIGMA_GET_FILE_NODES at depth=3; deeper variant subtrees were NOT read for large families.",
    "Figma variables API is unavailable for this file (missing file_variables:read scope) — no variable collections/modes were read, so axes default values are literal Figma property defaults, not variable bindings.",
    "Code Connect is not available on this seat (no Dev/Full seat) — no code-connect mappings were read.",
    "Published Figma STYLES were not enumerated (out of scope for this inventory).",
    "Motion/prototype interactions were not re-checked (previous investigation found zero prototype nodes on the Button component sets).",
    "Page 1480:0 (Getting started) contains zero components and zero component sets — documentation frames only.",
    "Icon category assignment for page 3463:407484 comes from the containing FRAME name (19 category frames); icons sit inside those frames, not directly on the canvas.",
    "families[] excludes the variant children of COMPONENT_SETs (recorded as variantCount) and stops recursing at component boundaries, so components nested inside another component subtree are not listed.",
    "The Buttons families are named Buttons/Button etc.; there is no family named plain \"Button\" on page 1:1183.",
    "Page 1025:31781 frame \"Cursor\" set variants and Misc icons standalone components are published individually, not as sets (variantCount 0 by type).",
  ],
};
fs.writeFileSync(path.join(ROOT, "figma-surface.json"), JSON.stringify(surfaces, null, 1));
console.log("wrote figma-surface.json bytes=", fs.statSync(path.join(ROOT, "figma-surface.json")).size);
console.log("counts:", JSON.stringify(surfaces.counts));
for (const p of pageSummaries) console.log(` ${p.id.padEnd(12)} ${JSON.stringify(p.name).padEnd(30)} sets=${String(p.componentSetCount).padStart(3)} comps=${String(p.componentCount).padStart(5)} variantsInSets=${String(p.variantCountAcrossSets).padStart(5)} noKey=${p.missingKeyCount}`);
console.log("iconLike entries:", iconLike.length, JSON.stringify(iconLike.reduce((a, x) => { a[x.kind] = (a[x.kind] || 0) + 1; return a; }, {})));
console.log("notes:", notes);
