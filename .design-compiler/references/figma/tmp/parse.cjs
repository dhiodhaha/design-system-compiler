// parse.js <rawFile>  -> compact family inventory JSON on stdout (or to outfile with --out)
const fs = require("fs");
const file = process.argv[2];
const outArg = process.argv.indexOf("--out");
const d = JSON.parse(fs.readFileSync(file, "utf8"));
const data = d.data || d;
const nodes = data.nodes || {};
const result = [];
const stylesAgg = {};
for (const nk of Object.keys(nodes)) {
  const n = nodes[nk];
  const doc = n.document || {};
  const compSets = n.componentSets || {};
  const comps = n.components || {};
  const page = { pageId: nk, pageName: doc.name, pageType: doc.type, families: [], components: [], otherChildren: [] };
  const stack = [...(doc.children || [])];
  while (stack.length) {
    const c = stack.shift();
    if (c.type === "COMPONENT_SET" || c.type === "COMPONENT") {
      const variantChildren = (c.children || []).filter(x => x.type === "COMPONENT");
      const setMeta = compSets[keyOf(c)] || null;
      // find the componentSet entry via name match when ids are redacted
      let meta = null;
      for (const mk of Object.keys(compSets)) { if (compSets[mk].name === c.name) { meta = compSets[mk]; break; } }
      let cmeta = null;
      for (const mk of Object.keys(comps)) { if (comps[mk].name === c.name) { cmeta = comps[mk]; break; } }
      const defs = c.componentPropertyDefinitions || null;
      const axes = {};
      if (defs) for (const [k, v] of Object.entries(defs)) {
        axes[k] = { type: v.type, default: v.defaultValue, values: v.variantOptions || null };
      }
      const nonVariantAxes = defs ? Object.entries(defs).filter(([k, v]) => v.type !== "VARIANT").map(([k, v]) => `${k} [${v.type}] default=${JSON.stringify(v.defaultValue)}`) : [];
      page.families.push({
        name: c.name, type: c.type,
        variantCount: c.type === "COMPONENT_SET" ? variantChildren.length : 0,
        axes, nonVariantAxes,
        key: (meta && meta.key) || (cmeta && cmeta.key) || null,
        description: (meta && meta.description) || (cmeta && cmeta.description) || "",
        childNames: variantChildren.slice(0, 4).map(x => x.name),
      });
    } else {
      page.otherChildren.push({ name: c.name, type: c.type, kids: (c.children || []).length });
    }
    // do not descend into COMPONENT_SET variants; descend into frames/groups
    if (c.type !== "COMPONENT_SET" && c.type !== "COMPONENT") {
      for (const k of (c.children || [])) stack.push(k);
    }
  }
  page.counts = { componentSets: page.families.filter(f => f.type === "COMPONENT_SET").length, standaloneComponents: page.families.filter(f => f.type === "COMPONENT").length };
  result.push(page);
}
function keyOf(n) { return n.id; }
const out = { fileKey: null, fileName: data.name || null, pages: result };
const s = JSON.stringify(out, null, 1);
if (outArg >= 0) fs.writeFileSync(process.argv[outArg + 1], s);
else console.log(s);
