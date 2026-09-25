#!/usr/bin/env node
/**
 * Deterministic visual comparison.
 *
 *   node visual/compare.mjs --ref <figma.png> --refBox x,y,w,h@scale --actual <render.png> --out <report.json> [--threshold 0.1]
 *
 * refBox crops the Figma export to the component box (Figma pads exports with effect bleed),
 * then the crop is scaled to the actual capture's device pixels.
 *
 * Metrics:
 *   exactDiffPercent  - pixels where any RGB channel differs at all
 *   perceptualPercent - pixelmatch (YIQ, threshold) count, gamma 2.2, antialiasing detection ON
 *   channelDelta      - max / mean absolute channel delta over all pixels
 *   worstTiles        - 8x8 grid tiles ranked by mismatch, for region-based diagnosis
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, arr) => {
    if (v.startsWith("--")) acc.push([v.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const { ref, actual, out } = args;
if (!ref || !actual) {
  console.error("usage: compare.mjs --ref <png> --actual <png> --refBox x,y,w,h --out <json> [--threshold 0.1]");
  process.exit(1);
}
const threshold = Number(args.threshold ?? 0.1);

const loadPng = (p) => PNG.sync.read(readFileSync(p));

/**
 * Figma exports carry alpha (transparent outside the node's rounded/AA edges); browser captures are
 * opaque. Composite both over the same background so the comparison is about colour, not alpha encoding.
 */
const flatten = (png, bg = [255, 255, 255]) => {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.width * png.height; i++) {
    const o = i << 2;
    const a = png.data[o + 3] / 255;
    for (let c = 0; c < 3; c++) out.data[o + c] = Math.round(png.data[o + c] * a + bg[c] * (1 - a));
    out.data[o + 3] = 255;
  }
  return out;
};

const refPng = flatten(loadPng(ref));
const actPng = flatten(loadPng(actual));

const [rx, ry, rw, rh] = (args.refBox ?? `0,0,${refPng.width},${refPng.height}`).split(",").map(Number);

const crop = (png, x, y, w, h) => {
  const outPng = new PNG({ width: w, height: h });
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const src = ((y + j) * png.width + (x + i)) << 2;
      const dst = (j * w + i) << 2;
      outPng.data[dst] = png.data[src];
      outPng.data[dst + 1] = png.data[src + 1];
      outPng.data[dst + 2] = png.data[src + 2];
      outPng.data[dst + 3] = png.data[src + 3];
    }
  }
  return outPng;
};

const w = rw || refPng.width - rx;
const h = rh || refPng.height - ry;
if (w !== actPng.width || h !== actPng.height) {
  console.error(
    `size mismatch: reference crop ${w}x${h} vs actual ${actPng.width}x${actPng.height}. ` +
      `Pass --refBox x,y,w,h describing the component box inside the Figma export (exports include effect bleed).`,
  );
  process.exit(2);
}
const refFinal = crop(refPng, rx, ry, w, h);
const actFinal = crop(actPng, 0, 0, w, h);

const diff = new PNG({ width: w, height: h });
const perceptual = pixelmatch(refFinal.data, actFinal.data, diff.data, w, h, { threshold, includeAA: false, alpha: 0.5 });

let exact = 0;
let over2 = 0;
let over8 = 0;
let over32 = 0;
let maxDelta = 0;
let sumDelta = 0;
const TILES = 8;
const tiles = Array.from({ length: TILES * TILES }, () => ({ diff: 0, total: 0, maxDelta: 0 }));
for (let j = 0; j < h; j++) {
  for (let i = 0; i < w; i++) {
    const o = (j * w + i) << 2;
    const d = Math.max(Math.abs(refFinal.data[o] - actFinal.data[o]), Math.abs(refFinal.data[o + 1] - actFinal.data[o + 1]), Math.abs(refFinal.data[o + 2] - actFinal.data[o + 2]));
    if (d > 0) exact++;
    if (d > 2) over2++;
    if (d > 8) over8++;
    if (d > 32) over32++;
    maxDelta = Math.max(maxDelta, d);
    sumDelta += d;
    const t = Math.floor((j / h) * TILES) * TILES + Math.floor((i / w) * TILES);
    tiles[t].total++;
    if (d > 8) tiles[t].diff++;
    tiles[t].maxDelta = Math.max(tiles[t].maxDelta, d);
  }
}
const total = w * h;
const regionStats = (x0, y0, x1, y1) => {
  let over8 = 0;
  let over32 = 0;
  let exactRegion = 0;
  let tot = 0;
  let max = 0;
  for (let j = y0; j < y1; j++) {
    for (let i = x0; i < x1; i++) {
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const o = (j * w + i) << 2;
      const d = Math.max(Math.abs(refFinal.data[o] - actFinal.data[o]), Math.abs(refFinal.data[o + 1] - actFinal.data[o + 1]), Math.abs(refFinal.data[o + 2] - actFinal.data[o + 2]));
      tot++;
      if (d > 0) exactRegion++;
      if (d > 8) over8++;
      if (d > 32) over32++;
      max = Math.max(max, d);
    }
  }
  return { px: tot, exactPercent: +((exactRegion / tot) * 100).toFixed(2), over8Percent: +((over8 / tot) * 100).toFixed(2), over32Percent: +((over32 / tot) * 100).toFixed(2), maxDelta: max };
};

// Optional region split for diagnosis. --textBox is given in *device pixels of the comparison image*.
const byRegion = args.textBox
  ? (() => {
      const [tx, ty, tw, th] = args.textBox.split(",").map(Number);
      return { text: regionStats(tx, ty, tx + tw, ty + th), full: regionStats(0, 0, w, h), textBox: { x: tx, y: ty, w: tw, h: th } };
    })()
  : null;

const report = {
  reference: { file: ref, crop: { x: rx, y: ry, w, h } },
  actual: { file: actual },
  size: { w, h },
  threshold,
  pixels: { total, exactDiff: exact, perceptualDiff: perceptual, over2, over8, over32 },
  exactDiffPercent: +((exact / total) * 100).toFixed(3),
  perceptualPercent: +((perceptual / total) * 100).toFixed(3),
  structuralPercent: +((over8 / total) * 100).toFixed(3),
  channelDelta: { max: maxDelta, mean: +(sumDelta / total).toFixed(3) },
  byRegion,
  worstTiles: tiles
    .map((t, i) => ({ tile: `r${Math.floor(i / TILES)}c${i % TILES}`, x: (i % TILES) * Math.ceil(w / TILES), y: Math.floor(i / TILES) * Math.ceil(h / TILES), mismatchPercent: +((t.diff / t.total) * 100).toFixed(2), maxDelta: t.maxDelta }))
    .filter((t) => t.mismatchPercent > 0)
    .sort((a, b) => b.maxDelta - a.maxDelta || b.mismatchPercent - a.mismatchPercent)
    .slice(0, 6),
  pass: {
    perceptualUnder1Percent: perceptual / total < 0.01,
    structuralUnder1Percent: over8 / total < 0.01,
    maxChannelDelta: maxDelta,
  },
};
if (out) {
  writeFileSync(out, JSON.stringify(report, null, 2));
  writeFileSync(out.replace(/\.json$/, ".diff.png"), PNG.sync.write(diff));
}
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass.perceptualUnder1Percent ? 0 : 1);
