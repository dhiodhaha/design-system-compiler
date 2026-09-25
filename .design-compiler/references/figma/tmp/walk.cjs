// walk.cjs <rawFile> ... -> print path-annotated component inventory summary
const fs = require("fs");
for (const file of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const data = d.data || d;
  const nodes = data.nodes || {};
  for (const nk of Object.keys(nodes)) {
    const doc = nodes[nk].document || {};
    console.log(`# ${file} :: ${nk} ${JSON.stringify(doc.name)} type=${doc.type}`);
    const walk = (node, path) => {
      const kids = node.children || [];
      const comps = kids.filter(c => c.type === "COMPONENT" || c.type === "COMPONENT_SET");
      const groups = {};
      for (const c of comps) groups[c.type] = (groups[c.type] || 0) + 1;
      if (comps.length) console.log(`  ${path} :: ${JSON.stringify(node.type + ":" + node.name)} -> components=${JSON.stringify(groups)}`);
      for (const c of kids) {
        if (c.type === "COMPONENT" || c.type === "COMPONENT_SET") continue;
        if (c.type === "FRAME" || c.type === "GROUP" || c.type === "SECTION") walk(c, path + "/" + c.name);
      }
    };
    // top-level page children
    const pageKids = doc.children || [];
    const direct = pageKids.filter(c => c.type === "COMPONENT" || c.type === "COMPONENT_SET");
    const dg = {}; for (const c of direct) dg[c.type] = (dg[c.type] || 0) + 1;
    console.log(`  <canvas-direct> -> components=${JSON.stringify(dg)}`);
    for (const c of pageKids) {
      if (c.type === "COMPONENT" || c.type === "COMPONENT_SET") continue;
      if (c.type === "FRAME" || c.type === "GROUP" || c.type === "SECTION") walk(c, c.name);
    }
  }
}
