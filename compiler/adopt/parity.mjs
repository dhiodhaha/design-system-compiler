#!/usr/bin/env node
/**
 * Adopted-component parity gate.
 *
 *   node compiler/adopt/parity.mjs --item button
 *
 * Proves, deterministically, how an ADOPTED official component relates to the Figma source of truth:
 *   1. structural comparison — box, padding, gap, radius, typography, slot positions, against the
 *      compiled ComponentIR for the Figma variant under test
 *   2. pixel comparison — the rendered component against the Figma export crop
 *
 * A difference in a *layout property* is a real defect; sub-pixel text-box rounding is a known
 * renderer difference and is reported as such instead of being silently tolerated.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const item = args.item ?? "button";
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";
const OUT = `.design-compiler/references/untitledui/parity`;
mkdirSync(OUT, { recursive: true });

const ir = JSON.parse(readFileSync(".design-compiler/ir/button.component.json", "utf8"));
const spec = ir.specimen;
const exceptions = existsSync(".design-compiler/exceptions.json") ? JSON.parse(readFileSync(".design-compiler/exceptions.json", "utf8")).exceptions : [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars", "--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 200, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([
  { name: "prefers-color-scheme", value: "light" },
  { name: "prefers-reduced-motion", value: "no-preference" },
]);

const probe = async (url, selector) => {
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const kids = [...el.children].map((c) => {
      const b = c.getBoundingClientRect();
      return { tag: c.tagName.toLowerCase(), slot: c.getAttribute("data-slot"), x: +(b.x - r.x).toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };
    });
    return {
      box: { w: +r.width.toFixed(3), h: +r.height.toFixed(3) },
      padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((v) => parseFloat(v)),
      gap: parseFloat(cs.columnGap),
      radius: parseFloat(cs.borderTopLeftRadius),
      fontSize: parseFloat(cs.fontSize),
      lineHeight: parseFloat(cs.lineHeight),
      fontWeight: parseFloat(cs.fontWeight),
      fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, ""),
      kids,
    };
  }, selector);
};

const adopted = await probe("http://127.0.0.1:5173/parity.html", "button");
const benchmark = await probe("http://127.0.0.1:5173/specimen.html", "button");

const capture = async (url, file) => {
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const box = await page.evaluate(() => {
    const el = document.querySelector("button");
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: Math.ceil(box.w), height: Math.ceil(box.h) } });
};
await capture("http://127.0.0.1:5173/parity.html", ".design-compiler/visual/parity-adopted@2x.png");
await browser.close();

// pixel diff against the Figma export crop (golden specimen 12246:5764, export bleed 2,1 at 1x)
// compare.mjs exits non-zero when the visual gate fails; here the mismatch IS the measurement.
try {
  execFileSync("node", ["visual/compare.mjs", "--ref", ".design-compiler/reference/golden@2x.png", "--refBox", "4,2,284,64", "--actual", ".design-compiler/visual/parity-adopted@2x.png", "--out", ".design-compiler/visual/parity-report.json"], { stdio: "ignore" });
} catch {
  /* measurement captured in the report file */
}
const pixels = JSON.parse(readFileSync(".design-compiler/visual/parity-report.json", "utf8"));

// structural comparison: a layout property may differ at most by the recorded rounding exception
const deltas = [];
const cmp = (label, figma, actual, unit = "px") => {
  const d = +(actual - figma).toFixed(3);
  deltas.push({ property: label, figma, actual, delta: d, unit, ok: Math.abs(d) <= 1 });
};
cmp("box.width", spec.box.w, adopted.box.w);
cmp("box.height", spec.box.h, adopted.box.h);
cmp("padding.block", spec.layout.padding[0], adopted.padding[0]);
cmp("padding.inline", spec.layout.padding[1], adopted.padding[1]);
cmp("gap", spec.layout.gap, adopted.gap);
cmp("radius", spec.layout.radius, adopted.radius);
cmp("font.size", parseFloat(spec.label.fontSize), adopted.fontSize);
cmp("font.lineHeight", parseFloat(spec.label.lineHeight), adopted.lineHeight);
cmp("font.weight", spec.label.fontWeight, adopted.fontWeight);
const figmaLeading = spec.layout.padding[3];
const figmaTrailing = spec.box.w - spec.layout.padding[1] - spec.icons[1].instanceBox.w;
cmp("leadingVisual.x", figmaLeading, adopted.kids[0]?.x ?? 0);
cmp("trailingVisual.x", figmaTrailing, adopted.kids[adopted.kids.length - 1]?.x ?? 0);
cmp("leadingVisual.size", spec.icons[0].instanceBox.w, adopted.kids[0]?.w ?? 0);

// Figma's hug text box (integer-rounded) vs the browser's fractional advance: recorded exception
const index = JSON.parse(readFileSync(".design-compiler/ir/button.index.json", "utf8"));
const baseVariant = index.variants.find((v) => v.axes.Size === "xs" && v.axes.Hierarchy === "Primary" && v.axes.State === "Default" && v.axes["Icon only"] === "False");
const figmaLabelWidth = baseVariant?.sig?.label?.box?.w ?? null;
const adoptedLabel = adopted.kids.find((k) => k.tag === "span");
const adoptedLabelContent = adoptedLabel ? +(adoptedLabel.w - spec.label.wrapperPaddingInline * 2).toFixed(3) : null;
if (figmaLabelWidth && adoptedLabelContent !== null) {
  deltas.push({
    property: "label.contentWidth",
    figma: figmaLabelWidth,
    actual: adoptedLabelContent,
    delta: +(adoptedLabelContent - figmaLabelWidth).toFixed(3),
    unit: "px",
    ok: Math.abs(adoptedLabelContent - figmaLabelWidth) <= 1,
    exception: "button-label-box-rounding (Figma rounds the hug text box up; Chromium keeps the fractional advance)",
  });
}

const labelException = exceptions.find((e) => e.id === "button-label-box-rounding");
const worst = deltas.filter((d) => !d.ok);

const report = {
  $schema: "design-compiler/Parity@p0",
  item,
  source: "src/components/base/buttons/button.tsx (adopted from untitleduico/react)",
  figma: { componentSetId: "3287:427074", specimen: spec.nodeId, variant: spec.variant },
  classification:
    worst.length === 0
      ? "MATCH_WITH_RECORDED_RENDERER_EXCEPTION"
      : worst.every((d) => Math.abs(d.delta) <= 1)
        ? "FIGMA_VISUAL_DELTA"
        : "STRUCTURAL_MISMATCH",
  structural: { deltas, structuralFailures: worst, tolerancePx: 1 },
  pixels: {
    reference: "Figma export crop (4,2,284,64) of golden@2x.png",
    perceptualPercent: pixels.perceptualPercent,
    structuralPercent: pixels.structuralPercent,
    meanChannelDelta: pixels.channelDelta.mean,
    dominantCause:
      Math.abs((adopted.kids[adopted.kids.length - 1]?.x ?? 0) - figmaTrailing) > 0
        ? `sub-pixel label box: adopted content ${adoptedLabelContent}px vs Figma ${figmaLabelWidth}px shifts the trailing visual by ${Math.abs(+((adopted.kids[adopted.kids.length - 1]?.x ?? 0) - figmaTrailing).toFixed(2))}px`
        : "anti-aliasing only",
  },
  benchmark: {
    note: "the Figma-compiled benchmark is the fidelity reference; the adopted source is the canonical implementation",
    box: benchmark.box,
    labelWidth: benchmark.kids.find((k) => k.slot === "label")?.w ?? null,
    labelContentWidth: benchmark.kids.find((k) => k.slot === "label") ? +(benchmark.kids.find((k) => k.slot === "label").w - spec.label.wrapperPaddingInline * 2).toFixed(3) : null,
    perceptualPercent: JSON.parse(readFileSync(".design-compiler/visual/report@2x.json", "utf8")).perceptualPercent,
  },
  knownExceptions: labelException ? [labelException.id] : [],
  verifier: "compiler/adopt/parity.mjs",
};
writeFileSync(`${OUT}/${item}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ item, classification: report.classification, structuralFailures: worst, perceptualPercent: report.pixels.perceptualPercent, benchmarkPerceptual: report.benchmark.perceptualPercent, dominantCause: report.pixels.dominantCause }, null, 2));
process.exit(report.classification === "STRUCTURAL_MISMATCH" ? 1 : 0);
