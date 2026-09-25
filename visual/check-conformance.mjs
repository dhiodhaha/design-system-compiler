#!/usr/bin/env node
/**
 * Deterministic conformance check: rendered DOM geometry + computed styles vs the compiled IR/tokens.
 * This is the "geometry deviation <= 1px / spacing deviation <= 1px / semantic token mismatch = 0" gate.
 *
 * usage: node visual/check-conformance.mjs <geometry.json> <ir.json> <tokens.json> [out.json]
 */
import { readFileSync, writeFileSync } from "node:fs";

const [geometryPath, irPath, tokensPath, outPath] = process.argv.slice(2);
const geometry = JSON.parse(readFileSync(geometryPath, "utf8"));
const ir = JSON.parse(readFileSync(irPath, "utf8"));
const { tokens } = JSON.parse(readFileSync(tokensPath, "utf8"));

const results = [];
const flatten = (v) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").replace(/["']/g, "").trim();
const add = (name, expected, actual, tolerance, unit = "px") => {
  const isNum = typeof expected === "number" || unit === "px" || unit === "ms";
  const e = isNum ? parseFloat(expected) : flatten(expected);
  const a = isNum ? parseFloat(actual) : flatten(actual);
  const delta = isNum && Number.isFinite(e) && Number.isFinite(a) ? +(a - e).toFixed(3) : null;
  results.push({ check: name, expected, actual, delta, tolerance, unit, pass: isNum ? delta !== null && Math.abs(delta) <= tolerance : e === a });
};

const spec = ir.specimen;
const sizeToken = (k) => tokens[k]?.value;

/** Chromium hex-normalises colours; Tailwind v4 composes box-shadow from --tw-* slots, so empty
 *  transparent layers and `inset` position must be normalised before comparison. */
const norm = (s) =>
  String(s ?? "")
    .replace(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/g, (m, r, g, b, a) => (a === undefined || a === "1" ? "#" + [r, g, b].map((v) => (+v).toString(16).padStart(2, "0")).join("") : m))
    .split(",")
    .map((layer) => layer.trim())
    .filter((layer) => layer && !/^\S+ 0px 0px 0px 0px$/.test(layer) && layer !== "")
    .map((layer) => layer.replace(/\s+/g, " ").replace(/ inset$/, "").trim())
    .sort()
    .join(", ")
    .toLowerCase();

/** Canonicalise a box-shadow layer: colour form, term order, implicit spread all vary by engine. */
const parseShadowLayer = (layer) => {
  const inset = /(?:^|\s)inset(?:\s|$)/.test(layer);
  const colorMatch = layer.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
  let color = "";
  if (colorMatch) {
    const m = colorMatch[0];
    if (m.startsWith("#")) color = m.toLowerCase();
    else {
      const [r, g, b, a = 1] = m.replace(/rgba?\(|\)/g, "").split(",").map((v) => parseFloat(v));
      color = `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}@${a}`;
    }
  }
  const [x = 0, y = 0, blur = 0, spread = 0] = [...layer.matchAll(/(-?\d*\.?\d+)px/g)].map((m) => parseFloat(m[1]));
  return `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px ${color}`.trim();
};
const normShadow = (s) =>
  String(s ?? "")
    .split(/,(?![^(]*\))/)
    .map((layer) => layer.trim().replace(/\s+/g, " "))
    .filter((layer) => layer && !/^(rgba?\([^)]*\) )?0px 0px 0px 0px$/.test(layer))
    .map(parseShadowLayer)
    .sort()
    .join(", ");

const ms = (v) => (String(v).trim().endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000);

// ---- geometry vs Figma specimen box
add("button.width", spec.box.w, geometry.box.width, 1);
add("button.height", spec.box.h, geometry.box.height, 1);
add("button.x", 0, geometry.box.x - geometry.clip.x, 0.5);
add("button.y", 0, geometry.box.y - geometry.clip.y, 0.5);
add("label.x", spec.layout.padding[3] + 16 + spec.layout.gap, geometry.label.box.x, 1);
add("label.contentStart", spec.label.wrapperPaddingInline + spec.layout.padding[3] + 16 + spec.layout.gap, geometry.label.box.x + geometry.label.padding[3], 1);
add("label.inlinePadding", tokens["space.label-padding-inline"].value, geometry.label.padding[3], 0.5);
add("icon.leading.x", spec.layout.padding[3], geometry.icons[0].box.x, 1);
add("icon.trailing.x", spec.box.w - spec.layout.padding[1] - 16, geometry.icons[1].box.x, 1);
add("icon.width", 16, geometry.icons[0].box.width, 0.5);
add("icon.opacity", tokens["opacity.button.icon"].value, geometry.icons[0].opacity, 0.001, "");

// ---- spacing vs size tokens
add("padding.blockStart", parseFloat(sizeToken("padding.button.xs")), geometry.computed.padding[0], 0.5);
add("padding.inlineEnd", parseFloat(sizeToken("padding.button.xs").split(" ")[1]), geometry.computed.padding[1], 0.5);
add("gap", parseFloat(sizeToken("gap.button.xs")), geometry.computed.gap, 0.5);
add("radius", parseFloat(tokens["radius.button"].value), geometry.computed.borderRadius, 0.5);

// ---- semantic tokens vs computed styles (token mismatch must be zero)
add("color.background", tokens["color.brand.solid"].value, norm(geometry.computed.backgroundColor), 0, "hex");
add("shadow", normShadow(tokens["shadow.button.default"].value), normShadow(geometry.computed.boxShadow), 0, "shadow");
add("ring.width", tokens["ring.width"].value, geometry.ring.padding.split(" ")[0], 0, "px");
add("ring.maskComposite", "exclude", geometry.ring.maskComposite.split(",")[0].trim(), 0, "");
add("typography.family", tokens["typography.label.sm"].value.fontFamily, geometry.computed.font.replace(/^.*?\d+px\/\d+px /, "").split(",")[0].replace(/["']/g, "").trim(), 0, "");
add("typography.weight", tokens["typography.label.sm"].value.fontWeight, parseFloat(geometry.computed.font.split(" ")[1]), 0, "");
add("typography.size", parseFloat(tokens["typography.label.sm"].value.fontSize), parseFloat(geometry.computed.font.split(" ")[2].split("/")[0]), 0, "px");
add("typography.lineHeight", parseFloat(tokens["typography.label.sm"].value.lineHeight), parseFloat(geometry.computed.font.split(" ")[2].split("/")[1]), 0, "px");
add("motion.duration", ms(tokens["motion.duration-fast"].value), ms(geometry.computed.transition.split(" ").slice(-2)[0]), 0.001, "ms");

const failed = results.filter((r) => !r.pass);
const report = {
  component: "Button",
  variant: "primary",
  size: "xs",
  specimen: spec.nodeId,
  checks: results,
  failures: failed,
  status: failed.length === 0 ? "PASS" : "FAIL",
  geometryMaxDelta: Math.max(...results.filter((r) => r.unit === "px").map((r) => Math.abs(r.delta ?? 0))),
  tokenMismatches: failed.filter((r) => r.unit === "hex" || r.unit === "shadow" || r.unit === "").length,
};
if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === "PASS" ? 0 : 1);
