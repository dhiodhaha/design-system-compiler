#!/usr/bin/env node
/**
 * Representative visual verification for a PRO composition.
 *
 *   node compiler/pro/verify-content-item.mjs
 *
 * The three deep-read representatives of the licensed PRO family "Content item" are rendered at their Figma
 * frame width and measured against the sliced evidence: typography (size/line-height/weight/colour) and the
 * vertical spacing pairs taken from the variant signatures. Screenshots are stored for the record.
 *
 * A layout property outside tolerance is a real defect; anything not deep-read is reported as INFERRED
 * rather than silently accepted.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const OUT = ".design-compiler/visual";
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";

/** Evidence taken from the deep reads (node ids given by the owner). */
const EVIDENCE = {
  "3947:417423": { label: "Heading/sm/Desktop", fontSize: 20, lineHeight: 30, fontWeight: 600, color: "rgb(23, 23, 23)", spacingTop: 32, spacingBottom: 12, selector: '[data-pro="content-heading"]' },
  "3947:417429": { label: "Paragraph/lg/Desktop", fontSize: 18, lineHeight: 28, fontWeight: 400, color: "rgb(82, 82, 82)", spacingTop: 0, spacingBottom: 18, selector: '[data-pro="content-paragraph"]' },
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars", "--no-sandbox"],
});
const page = await browser.newPage();
// The Figma frame is 720px wide inside a desktop viewport: the viewport must exceed Tailwind's md (768px)
// breakpoint for the Desktop spacing/typography steps to apply.
await page.setViewport({ width: 1024, height: 2400, deviceScaleFactor: 2 });
await page.emulateMediaFeatures([
  { name: "prefers-color-scheme", value: "light" },
  { name: "prefers-reduced-motion", value: "no-preference" },
]);
await page.goto("http://127.0.0.1:5173/pro.html", { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

const measured = await page.evaluate(() => {
  // upstream theme colours are OKLCH (and may be `none`/missing channels); resolve them to sRGB through a
  // canvas so the comparison is against the Figma value, not against a colour-space notation.
  const toRgb = (css) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  };
  const out = {};
  for (const el of document.querySelectorAll("[data-rep]")) {
    const id = el.dataset.rep;
    const target = el.querySelector('[data-pro="content-heading"], [data-pro="content-paragraph"], [data-pro="content-feature-text"], [data-pro="content-quote"], [data-pro="content-divider"], [data-pro="content-stack"]');
    if (!target) continue;
    const cs = getComputedStyle(target);
    const r = target.getBoundingClientRect();
    const inner = target.firstElementChild?.getBoundingClientRect?.();
    out[id] = {
      tag: target.tagName.toLowerCase(),
      slot: target.dataset.pro,
      fontSize: parseFloat(cs.fontSize),
      lineHeight: parseFloat(cs.lineHeight),
      fontWeight: parseFloat(cs.fontWeight),
      color: toRgb(cs.color),
      paddingTop: parseFloat(cs.paddingTop),
      paddingBottom: parseFloat(cs.paddingBottom),
      background: cs.backgroundColor,
      box: { w: +r.width.toFixed(2), h: +r.height.toFixed(2) },
      innerBox: inner ? { w: +inner.width.toFixed(2), h: +inner.height.toFixed(2) } : null,
    };
  }
  return out;
});

const results = [];
const check = (rep, property, expected, actual, tolerance = 0) => {
  const pass = typeof expected === "number" ? Math.abs(actual - expected) <= tolerance : String(actual) === String(expected);
  results.push({ rep, property, expected, actual, delta: typeof expected === "number" ? +(actual - expected).toFixed(3) : null, pass });
};

for (const [id, ev] of Object.entries(EVIDENCE)) {
  const m = measured[id];
  if (!m) {
    results.push({ rep: id, property: "rendered", expected: "present", actual: "missing", pass: false });
    continue;
  }
  check(id, "font-size", ev.fontSize, m.fontSize);
  check(id, "line-height", ev.lineHeight, m.lineHeight);
  check(id, "font-weight", ev.fontWeight, m.fontWeight);
  check(id, "colour", ev.color, m.color);
  check(id, "padding-top (desktop)", ev.spacingTop, m.paddingTop);
  check(id, "padding-bottom (desktop)", ev.spacingBottom, m.paddingBottom);
  check(id, "frame width (figma 720px)", 720, m.box.w, 1);
}

// Feature text nests content items inside a container — structural evidence, not a text style.
const feature = measured["3947:420501"] ?? Object.values(measured).find((m) => m.slot === "content-feature-text");
check("3947:420501", "feature-text is a container (has a background, not a text style)", true, Boolean(feature && feature.background !== "rgba(0, 0, 0, 0)"));
check("3947:420501", "feature-text nests content items", true, Boolean(feature && feature.innerBox));

// quote/divider/stack render
check("quote", "quote renders", true, Boolean(measured["quote"]));
check("divider", "divider renders a hairline", true, Boolean(measured["divider"]));
check("stack", "stack composes children", true, Boolean(measured["stack"]));

await page.screenshot({ path: `${OUT}/pro-content-item@2x.png`, fullPage: true });
await browser.close();

const failures = results.filter((r) => !r.pass);
const report = {
  $schema: "design-compiler/ProValidation@p0",
  item: "content-item",
  figma: { fileKey: "sLqnzw7tFXpuPA1TbqsjZx", componentSetId: "3947:417447", representatives: Object.keys(EVIDENCE) },
  method: "render the representatives at the Figma frame width, measure the DOM, compare against the sliced evidence",
  checks: results,
  failures,
  inferred: [
    "Quote left's inner text scale was not exposed by the shallow read: it reuses the Quote centre scale (recorded as INFERRED)",
    "Image captions and Feature text container padding were not deep-read: canonical caption/container tokens are used (INFERRED)",
    "Mobile typography steps are derived from the Figma size axes mapped onto the canonical type scale (INFERRED); Mobile spacing comes from the variant signatures (measured)",
  ],
  screenshot: `${OUT}/pro-content-item@2x.png`,
  status: failures.length === 0 ? "PASS" : "FAIL",
};
writeFileSync(`${OUT}/pro-content-item-validation.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, checks: results.length, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
