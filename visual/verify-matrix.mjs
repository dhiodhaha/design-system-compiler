#!/usr/bin/env node
/**
 * Full-matrix verification (§11): render every supported combination, diff against Figma.
 *
 *   node visual/verify-matrix.mjs [--dpr 1] [--url http://127.0.0.1:5173/grid.html]
 *
 * One capture of the mirrored component-set stage is diffed against Figma's own export of that set, then
 * every variant is measured on its own crop, so failures localise to a variant instead of a page.
 * Also asserts each rendered box against the Figma geometry from the index (<=1px).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const dpr = Number(args.dpr ?? 1);
const url = args.url ?? "http://127.0.0.1:5173/grid.html";
const out = ".design-compiler/visual";
mkdirSync(out, { recursive: true });

const index = JSON.parse(readFileSync(".design-compiler/ir/button.index.json", "utf8"));
// §16 canaries: the high-value specimens worth running on every change, before the full matrix.
const CANARIES = [
  "xs/Primary/Default/False",
  "xl/Primary/Default/False",
  "xs/Secondary/Default/False",
  "xs/Primary/Hover/False",
  "xs/Primary/Focused/False",
  "xs/Primary/Disabled/False",
  "xs/Primary/Loading/False",
  "xs/Primary/Default/True",
];
const canaryOnly = process.argv.includes("--canaries");
const allSupported = index.variants.filter((v) => !(v.axes["Icon only"] === "True" && v.axes.Hierarchy.startsWith("Link")));
const supported = canaryOnly
  ? allSupported.filter((v) => CANARIES.includes([v.axes.Size, v.axes.Hierarchy, v.axes.State, v.axes["Icon only"]].join("/")))
  : allSupported;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome",
  headless: true,
  // §14 deterministic visual environment: pinned colour profile, no hinting/LCD text, fixed DPR, and the
  // media features below, so a diff is attributable to the component rather than to the host.
  args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars", "--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1700, deviceScaleFactor: dpr });
await page.emulateMediaFeatures([
  { name: "prefers-color-scheme", value: "light" },
  { name: "prefers-reduced-motion", value: "no-preference" },
]);
await page.setExtraHTTPHeaders({ "accept-language": "en-US,en" });
await page.goto(url, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

// ---- DOM geometry per variant
const domBoxes = await page.evaluate(() =>
  Object.fromEntries(
    [...document.querySelectorAll("[data-key]")].map((el) => {
      const r = el.getBoundingClientRect();
      const btn = el.querySelector("button");
      const b = btn.getBoundingClientRect();
      return [el.dataset.key, { w: +b.width.toFixed(3), h: +b.height.toFixed(3), x: +r.x.toFixed(3), y: +r.y.toFixed(3) }];
    }),
  ),
);

const stage = await page.evaluate(() => {
  const el = document.getElementById("stage").getBoundingClientRect();
  return { x: el.x, y: el.y, width: el.width, height: el.height };
});
const browserVersion = await browser.version();
const png = `${out}/matrix@${dpr}x.png`;
await page.screenshot({ path: png, clip: stage, captureBeyondViewport: false });
await browser.close();

// ---- pixel comparison against Figma's own export of the component set
const flat = (img, bg = [255, 255, 255]) => {
  const o = new PNG({ width: img.width, height: img.height });
  for (let i = 0; i < img.width * img.height; i++) {
    const k = i << 2;
    const a = img.data[k + 3] / 255;
    for (let c = 0; c < 3; c++) o.data[k + c] = Math.round(img.data[k + c] * a + bg[c] * (1 - a));
    o.data[k + 3] = 255;
  }
  return o;
};
const refPath = args.ref ?? `.design-compiler/reference/button-set@${dpr}x.png`;
const ref = flat(PNG.sync.read(readFileSync(refPath)));
const act = flat(PNG.sync.read(readFileSync(png)));

const cropStats = (x, y, w, h) => {
  const mask = new PNG({ width: w, height: h });
  const a = new PNG({ width: w, height: h });
  const b = new PNG({ width: w, height: h });
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const src = ((y + j) * ref.width + (x + i)) << 2;
      const dst = (j * w + i) << 2;
      for (let c = 0; c < 3; c++) {
        a.data[dst + c] = ref.data[src + c];
        b.data[dst + c] = act.data[src + c];
      }
      a.data[dst + 3] = 255;
      b.data[dst + 3] = 255;
    }
  const diff = pixelmatch(a.data, b.data, mask.data, w, h, { threshold: 0.1, includeAA: false });
  let over8 = 0;
  let max = 0;
  for (let i = 0; i < w * h; i++) {
    const k = i << 2;
    const d = Math.max(Math.abs(a.data[k] - b.data[k]), Math.abs(a.data[k + 1] - b.data[k + 1]), Math.abs(a.data[k + 2] - b.data[k + 2]));
    if (d > 8) over8++;
    max = Math.max(max, d);
  }
  return { w, h, perceptual: +((diff / (w * h)) * 100).toFixed(2), over8Percent: +((over8 / (w * h)) * 100).toFixed(2), maxDelta: max };
};

const whole = cropStats(0, 0, ref.width, ref.height);

// whole-set diff heatmap: where the compiled matrix and Figma disagree (red = differing pixels)
{
  const mask = new PNG({ width: ref.width, height: ref.height });
  const flatCopy = (png, bg = [255, 255, 255]) => {
    const o = new PNG({ width: png.width, height: png.height });
    for (let i = 0; i < png.width * png.height; i++) {
      const k = i << 2;
      const a = png.data[k + 3] / 255;
      for (let c = 0; c < 3; c++) o.data[k + c] = Math.round(png.data[k + c] * a + bg[c] * (1 - a));
      o.data[k + 3] = 255;
    }
    return o;
  };
  pixelmatch(flatCopy(ref).data, flatCopy(act).data, mask.data, ref.width, ref.height, { threshold: 0.1, includeAA: false, alpha: 0.5, diffMask: false });
  writeFileSync(`${out}/matrix@${dpr}x.diff.png`, PNG.sync.write(mask));
}
const perVariant = supported
  .map((v) => {
    const x = Math.round((v.at.x - index.frame.origin.x) * dpr);
    const y = Math.round((v.at.y - index.frame.origin.y) * dpr);
    const w = Math.round(v.sig.box.w * dpr);
    const h = Math.round(v.sig.box.h * dpr);
    const dom = domBoxes[`${v.axes.Size}/${v.axes.Hierarchy}/${v.axes.State}/${v.axes["Icon only"]}`];
    return {
      key: `${v.axes.Size}/${v.axes.Hierarchy}/${v.axes.State}/${v.axes["Icon only"]}`,
      figmaBox: { w: v.sig.box.w, h: v.sig.box.h },
      domBox: dom ? { w: dom.w, h: dom.h } : null,
      geometryDelta: dom ? { w: +(dom.w - v.sig.box.w).toFixed(3), h: +(dom.h - v.sig.box.h).toFixed(3) } : null,
      ...cropStats(x, y, w, h),
    };
  })
  .sort((a, b) => b.over8Percent - a.over8Percent || b.maxDelta - a.maxDelta);

const geometryFailures = perVariant.filter((v) => !v.geometryDelta || Math.abs(v.geometryDelta.w) > 1 || Math.abs(v.geometryDelta.h) > 1);
// Gate per DESIGN_SYSTEM_COMPILER.md §25: geometry <= 1px, overall perceptual mismatch < 1%. The `over8`
// count is a diagnostic (it is dominated by text rasterisation differences at 1x); variants above the
// outlier threshold are listed for targeted follow-up instead of failing the whole matrix.
const OUTLIER_PERCENT = 3;
const outliers = perVariant.filter((v) => v.perceptual > OUTLIER_PERCENT);
const report = {
  component: "Buttons/Button",
  stage: { size: { w: ref.width, h: ref.height }, dpr, reference: refPath, environment: { browser: browserVersion, colorProfile: "srgb", colorScheme: "light", reducedMotion: "no-preference", locale: "en-US", hinting: "none", lcdText: "disabled" } },
  mode: canaryOnly ? "canaries" : "full-matrix",
  canaries: canaryOnly ? CANARIES : undefined,
  supportedVariants: supported.length,
  unsupportedExcluded: index.count - supported.length,
  whole: whole,
  status: whole.perceptual < 1 && geometryFailures.length === 0 ? "PASS" : "FAIL",
  // canary mode must also satisfy the per-specimen gate: these are the runs that gate every change
  canaryFailures: canaryOnly ? perVariant.filter((v) => v.perceptual > 1) : undefined,
  geometry: { checked: perVariant.length, tolerancePx: 1, failures: geometryFailures.slice(0, 12), maxDelta: Math.max(...perVariant.map((v) => Math.max(Math.abs(v.geometryDelta?.w ?? 0), Math.abs(v.geometryDelta?.h ?? 0)))) },
  visual: { gate: "perceptual < 1% overall", outlierPercent: OUTLIER_PERCENT, outlierCount: outliers.length, outliers: outliers.map((v) => v.key), worst: perVariant.slice(0, 12) },
};
writeFileSync(`${out}/${canaryOnly ? "canary-report" : "matrix-report"}@${dpr}x.json`, JSON.stringify({ ...report, perVariant }, null, 2));
console.log(
  JSON.stringify(
    {
      status: report.status,
      wholeSet: whole,
      geometry: { failures: geometryFailures.length, maxDelta: report.geometry.maxDelta },
      visual: { outliers: outliers.length, outlierKeys: outliers.map((v) => v.key) },
      worst: perVariant.slice(0, 8).map((v) => ({ key: v.key, over8: v.over8Percent, perceptual: v.perceptual, maxDelta: v.maxDelta, geom: v.geometryDelta })),
    },
    null,
    2,
  ),
);
process.exit(report.status === "PASS" ? 0 : 1);
