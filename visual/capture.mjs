#!/usr/bin/env node
/**
 * Deterministic capture: renders a URL at a fixed viewport/DPR, waits for fonts + paint,
 * extracts DOM geometry + computed styles for a selector, and screenshots a clip rect.
 *
 * usage: node visual/capture.mjs <url> <selector> <width> <height> <dpr> <outPng> <outJson>
 * The clip rect is the selector's bounding box (must start at 0,0 for specimen stages).
 */
import { writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const [url, clipSelector, probeSelector, wArg, hArg, dprArg, outPng, outJson] = process.argv.slice(2);
if (!url || !clipSelector || !outPng) {
  console.error("usage: capture.mjs <url> <clipSelector> <probeSelector|-> <width> <height> <dpr> <out.png> [out.json]");
  process.exit(1);
}
const viewport = { width: Number(wArg ?? 1440), height: Number(hArg ?? 900), deviceScaleFactor: Number(dprArg ?? 2) };

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome",
  headless: true,
  args: ["--force-device-scale-factor=1", "--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars", "--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport(viewport);
await page.goto(url, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

const probe = await page.evaluate(([probeSel, clipSel]) => {
  const el = document.querySelector(probeSel === "-" ? clipSel : probeSel);
  const clipEl = document.querySelector(clipSel);
  if (!el) return { error: `probe selector not found: ${probeSel}` };
  if (!clipEl) return { error: `clip selector not found: ${clipSel}` };
  const clipRect = clipEl.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const after = getComputedStyle(el, "::after");
  const label = el.querySelector('[data-slot="label"]');
  const px = (v) => Math.round(parseFloat(v) * 1000) / 1000;
  return {
    clip: { x: px(clipRect.x), y: px(clipRect.y), width: px(clipRect.width), height: px(clipRect.height) },
    offsetInClip: { x: px(r.x - clipRect.x), y: px(r.y - clipRect.y) },
    box: { x: px(r.x), y: px(r.y), width: px(r.width), height: px(r.height) },
    computed: {
      boxSizing: cs.boxSizing,
      padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px),
      gap: px(cs.columnGap),
      borderRadius: px(cs.borderTopLeftRadius),
      backgroundColor: cs.backgroundColor,
      backgroundImage: cs.backgroundImage,
      boxShadow: cs.boxShadow,
      color: cs.color,
      font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`,
      letterSpacing: cs.letterSpacing,
      transition: `${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction}`,
      margin: [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].map(px),
    },
    ring: {
      content: after.content,
      padding: after.padding,
      maskComposite: after.maskComposite || after.webkitMaskComposite,
      backgroundImage: after.backgroundImage,
    },
    label: label
      ? (() => {
          const lr = label.getBoundingClientRect();
          const lcs = getComputedStyle(label);
          return { box: { x: px(lr.x), y: px(lr.y), width: px(lr.width), height: px(lr.height) }, text: label.textContent, padding: [lcs.paddingTop, lcs.paddingRight, lcs.paddingBottom, lcs.paddingLeft].map(px), font: `${lcs.fontWeight} ${lcs.fontSize}/${lcs.lineHeight}`, textWidthPx: (() => { const range = document.createRange(); range.selectNodeContents(label); return px(range.getBoundingClientRect().width); })() };
        })()
      : null,
    icons: [...el.querySelectorAll('[data-slot^="icon"]')].map((n) => {
      const ir = n.getBoundingClientRect();
      return { slot: n.dataset.slot, box: { x: px(ir.x), y: px(ir.y), width: px(ir.width), height: px(ir.height) }, opacity: getComputedStyle(n).opacity };
    }),
  };
}, [probeSelector, clipSelector]);

if (probe.error) {
  console.error(JSON.stringify(probe, null, 2));
  await browser.close();
  process.exit(2);
}

const clip = probe.clip;
await page.screenshot({ path: outPng, clip, captureBeyondViewport: false });
if (outJson) writeFileSync(outJson, JSON.stringify({ url, viewport, clipSelector, probeSelector, ...probe }, null, 2));
await browser.close();
console.log(JSON.stringify({ png: outPng, clip, box: probe.box, label: probe.label?.box, icons: probe.icons }, null, 2));
