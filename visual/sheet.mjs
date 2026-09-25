#!/usr/bin/env node
/**
 * Build a review sheet: reference (Figma export) / render / diff, stacked and upscaled.
 *   node visual/sheet.mjs [--dpr 2] [--scale 2]
 * Writes .design-compiler/visual/sheet@<dpr>x.png
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const dpr = Number(args.dpr ?? 2);
const scale = Number(args.scale ?? 2);
const out = `.design-compiler/visual/sheet@${dpr}x.png`;

const ir = JSON.parse(readFileSync(".design-compiler/ir/button.component.json", "utf8"));
const { w, h } = { w: ir.specimen.box.w * dpr, h: ir.specimen.box.h * dpr };
const bleed = dpr === 2 ? [4, 2] : [2, 1];

const load = (file) => PNG.sync.read(readFileSync(file));
const crop = (png, x, y, cw, ch) => {
  const o = new PNG({ width: cw, height: ch });
  for (let j = 0; j < ch; j++)
    for (let i = 0; i < cw; i++) {
      const s = ((y + j) * png.width + x + i) << 2;
      const d = (j * cw + i) << 2;
      o.data[d] = png.data[s];
      o.data[d + 1] = png.data[s + 1];
      o.data[d + 2] = png.data[s + 2];
      o.data[d + 3] = png.data[s + 3];
    }
  return o;
};
// alpha-composite over white so the transparent Figma export is comparable to the browser capture
const flatten = (png) => {
  const o = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.width * png.height; i++) {
    const k = i << 2;
    const a = png.data[k + 3] / 255;
    for (let c = 0; c < 3; c++) o.data[k + c] = Math.round(png.data[k + c] * a + 255 * (1 - a));
    o.data[k + 3] = 255;
  }
  return o;
};

const rows = [
  flatten(crop(load(`.design-compiler/reference/golden@${dpr}x.png`), bleed[0], bleed[1], w, h)),
  flatten(load(`.design-compiler/visual/golden@${dpr}x.png`)),
  flatten(crop(load(`.design-compiler/visual/report@${dpr}x.diff.png`), 0, 0, w, h)),
];

const gap = 4 * scale;
const W = w * scale;
const H = rows.length * h * scale + (rows.length - 1) * gap;
const sheet = new PNG({ width: W, height: H });
sheet.data.fill(255);
rows.forEach((row, r) => {
  const oy = r * (h * scale + gap);
  for (let j = 0; j < h * scale; j++)
    for (let i = 0; i < W; i++) {
      const s = (Math.floor(j / scale) * w + Math.floor(i / scale)) << 2;
      const d = ((oy + j) * W + i) << 2;
      sheet.data[d] = row.data[s];
      sheet.data[d + 1] = row.data[s + 1];
      sheet.data[d + 2] = row.data[s + 2];
      sheet.data[d + 3] = 255;
    }
});
writeFileSync(out, PNG.sync.write(sheet));
console.log(JSON.stringify({ out, order: ["figma reference", "browser render", "diff (reference vs render)"], size: { w: W, h: H } }));
