#!/usr/bin/env node
// Compact structural outline of a cached Figma node payload (no full JSON dumps).
// usage: node compiler/figma/outline.mjs <raw.json> [maxDepth=3] [maxChildren=8]
import { readFileSync } from "node:fs";

const [file, maxDepthArg = "3", maxChildrenArg = "8"] = process.argv.slice(2);
if (!file) {
  console.error("usage: outline.mjs <raw.json> [maxDepth] [maxChildren]");
  process.exit(1);
}
const maxDepth = Number(maxDepthArg);
const maxChildren = Number(maxChildrenArg);

const raw = JSON.parse(readFileSync(file, "utf8"));
const nodesMap = raw?.data?.nodes ?? raw?.nodes ?? {};
const docs = Object.entries(nodesMap).map(([id, v]) => [id, v.document ?? v]);

const fmt = (v) => {
  if (v === undefined) return "-";
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

function box(n) {
  const b = n.absoluteBoundingBox;
  return b ? `[x${Math.round(b.x)} y${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}]` : "";
}

function line(n, depth) {
  const parts = [
    `${"  ".repeat(depth)}${n.id} ${n.type} "${n.name}"`,
    box(n),
    n.layoutMode ? `layout=${n.layoutMode}` : "",
    n.itemSpacing !== undefined ? `gap=${n.itemSpacing}` : "",
    n.paddingTop !== undefined ? `pad=${fmt(n.paddingTop)}/${fmt(n.paddingRight)}/${fmt(n.paddingBottom)}/${fmt(n.paddingLeft)}` : "",
    n.cornerRadius !== undefined ? `r=${n.cornerRadius}` : "",
    n.rectangleCornerRadii ? `r4=${n.rectangleCornerRadii.join(",")}` : "",
    n.fills?.length ? `fill=${n.fills.map((f) => f.type + (f.color ? "#" + [f.color.r, f.color.g, f.color.b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("") : "")).join(",")}` : "",
    n.strokes?.length ? `stroke=${n.strokes.map((s) => s.type + (s.color ? "#" + [s.color.r, s.color.g, s.color.b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("") : "")).join(",")}@${n.strokeWeight}` : "",
    n.effects?.length ? `effects=${n.effects.map((e) => e.type).join(",")}` : "",
    n.characters !== undefined ? `text=${JSON.stringify(n.characters.slice(0, 40))}` : "",
    n.style ? `font=${n.style.fontFamily} ${n.style.fontWeight} ${n.style.fontSize}px/${n.style.lineHeightPx}` : "",
    n.boundVariables ? `boundVars=${Object.keys(n.boundVariables).join("|")}` : "",
    n.componentId ? `componentId=${n.componentId}` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

function walk(n, depth) {
  console.log(line(n, depth));
  if (depth >= maxDepth) {
    if (n.children?.length) console.log(`${"  ".repeat(depth + 1)}… ${n.children.length} children elided`);
    return;
  }
  const kids = n.children ?? [];
  kids.slice(0, maxChildren).forEach((c) => walk(c, depth + 1));
  if (kids.length > maxChildren) console.log(`${"  ".repeat(depth + 1)}… ${kids.length - maxChildren} more children`);
}

for (const [id, doc] of docs) {
  console.log(`=== ${file} :: ${id} ===`);
  if (doc.componentPropertyDefinitions) {
    console.log("componentPropertyDefinitions:");
    for (const [name, def] of Object.entries(doc.componentPropertyDefinitions)) {
      console.log(`  ${name} :: ${def.type} default=${fmt(def.defaultValue)} variantOptions=${fmt(def.variantOptions)?.slice(0, 200)}`);
    }
  }
  walk(doc, 0);
}
