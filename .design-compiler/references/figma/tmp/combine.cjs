// combine.cjs — parse every raw page payload into one inventory
const fs = require("fs");
const path = require("path");
const ROOT = "/home/dhio/untitleduireact/.design-compiler/references/figma";
const rawDir = path.join(ROOT, "raw");
const files = fs.readdirSync(rawDir).filter(f => /^pages-|^page-/.test(f) && f.endsWith(".json")).sort();

const PAGE_ORDER = ["1480:0", "1083:118533", "3463:407484", "1025:31781", "12:539", "1:1183", "85:1269", "1052:485", "4938:371336", "1291:157819", "172:4293", "647:15097", "1054:557"];

function collect(file) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const data = d.data || d;
  const nodes = data.nodes || {};
  const out = { sourceFile: path.basename(file), pages: [] };
  for (const nk of Object.keys(nodes)) {
    const n = nodes[nk];
    const doc = n.document || {};
    const compSets = n.componentSets || {};
    const comps = n.components || {};
    const byName = (map, name) => { for (const mk of Object.keys(map)) if (map[mk].name === name) return { id: mk, ...map[mk] }; return null; };
    const page = { id: nk, name: doc.name, type: doc.type, families: [], others: [], counts: {} };
    const stack = [...(doc.children || [])];
    const seen = new Set();
    while (stack.length) {
      const c = c0(stack.shift());
      if (c.type === "COMPONENT_SET" || c.type === "COMPONENT") {
        const metaSet = c.type === "COMPONENT_SET" ? byName(compSets, c.name) : null;
        const metaComp = c.type === "COMPONENT" ? byName(comps, c.name) : null;
        const defs = c.componentPropertyDefinitions || null;
        const axes = {};
        const nonVariant = [];
        if (defs) for (const [k, v] of Object.entries(defs)) {
          if (v.type === "VARIANT") axes[k] = { values: v.variantOptions || [], default: v.defaultValue };
          else nonVariant.push({ name: k, type: v.type, default: v.defaultValue });
        }
        page.families.push({
          name: c.name, type: c.type,
          variantCount: c.type === "COMPONENT_SET" ? (c.children || []).filter(x => x.type === "COMPONENT").length : 0,
          axes, nonVariantProps: nonVariant,
          key: (metaSet && metaSet.key) || (metaComp && metaComp.key) || null,
          description: (metaSet && metaSet.description) || (metaComp && metaComp.description) || "",
          sampleVariants: (c.children || []).slice(0, 3).map(x => x.name),
        });
      } else {
        page.others.push({ name: c.name, type: c.type, kids: (c.children || []).length });
        for (const k of (c.children || [])) stack.push(k);
      }
    }
    page.counts = {
      componentSets: page.families.filter(f => f.type === "COMPONENT_SET").length,
      standaloneComponents: page.families.filter(f => f.type === "COMPONENT").length,
      otherNodes: page.others.length,
    };
    out.pages.push(page);
  }
  return out;
}
function c0(n) { return n; }

const acc = { fileKey: "sLqnzw7tFXpuPA1TbqsjZx", pagesById: {}, sources: {} };
for (const f of files) {
  const r = collect(path.join(rawDir, f));
  for (const pg of r.pages) {
    if (!acc.pagesById[pg.id]) acc.pagesById[pg.id] = { ...pg, sources: [] };
    else { // merge (e.g. depth upgrades)
      acc.pagesById[pg.id].families = pg.families.length > acc.pagesById[pg.id].families.length ? pg.families : acc.pagesById[pg.id].families;
      acc.pagesById[pg.id].counts = pg.counts; acc.pagesById[pg.id].others = pg.others;
    }
    acc.pagesById[pg.id].sources.push(f);
  }
}
const pages = PAGE_ORDER.filter(id => acc.pagesById[id]).map(id => acc.pagesById[id]);
fs.writeFileSync(path.join(ROOT, "tmp/combined.json"), JSON.stringify({ fileKey: acc.fileKey, pages }, null, 1));
for (const pg of pages) {
  console.log(`PAGE ${pg.id} ${JSON.stringify(pg.name)} :: sets=${pg.counts.componentSets} standalone=${pg.counts.standaloneComponents} other=${pg.counts.otherNodes} | families=${pg.families.length} | src=${pg.sources.join(",")}`);
}
console.log("MISSING:", PAGE_ORDER.filter(id => !acc.pagesById[id]).join(", ") || "none");
