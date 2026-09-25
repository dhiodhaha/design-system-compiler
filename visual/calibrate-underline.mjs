#!/usr/bin/env node
/**
 * Renderer calibration: measure how Figma and Chromium place the link underline, per size.
 *
 *   node visual/calibrate-underline.mjs [--force]
 *
 * Figma draws text-decoration underlines from font metrics Chromium interprets differently; the property
 * does not exist in the Figma API, so it can only be measured. This script measures it against the
 * component-set reference and records the offset in .design-compiler/ir/renderer-calibration.json, which
 * compiler/figma/emit.mjs turns into `text-underline-offset`.
 *
 * `text-underline-offset` is measured from the alphabetic baseline, while Chromium's `auto` already applies
 * the font's own offset, so the update is incremental: new = applied + (figmaRow - chromiumRow). The
 * relation is 1:1 in pixels, so it converges in one step and is stable (no oscillation) thereafter.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const calibrationPath = ".design-compiler/ir/renderer-calibration.json";
const previous = existsSync(calibrationPath) ? JSON.parse(readFileSync(calibrationPath, "utf8"))["link-underline-offset"]?.sizes ?? {} : {};

const index = JSON.parse(readFileSync(".design-compiler/ir/button.index.json", "utf8"));
const ref = PNG.sync.read(readFileSync(".design-compiler/reference/button-set@1x.png"));
const act = PNG.sync.read(readFileSync(".design-compiler/visual/matrix@1x.png"));

/** Last row containing underlined link text (the row below the glyph block, ignoring AA). */
const underlineRow = (img, x0, y0, w, h) => {
  const rows = [];
  for (let j = 0; j < h; j++) {
    let ink = 0;
    for (let i = 20; i < w - 20; i++) {
      const s = ((y0 + j) * img.width + (x0 + i)) << 2;
      const l = 0.299 * img.data[s] + 0.587 * img.data[s + 1] + 0.114 * img.data[s + 2];
      if (l < 210) ink++;
    }
    if (ink > 20) rows.push(j);
  }
  return rows[rows.length - 1] ?? null;
};

const sizes = {};
for (const size of index.axes.Size) {
  const variant = index.variants.find((v) => v.axes.Size === size && v.axes.Hierarchy === "Link color" && v.axes.State === "Hover" && v.axes["Icon only"] === "False");
  if (!variant) continue;
  const x = Math.round(variant.at.x - index.frame.origin.x);
  const y = Math.round(variant.at.y - index.frame.origin.y);
  const w = Math.round(variant.sig.box.w);
  const h = Math.round(variant.sig.box.h);
  const refRow = underlineRow(ref, x, y, w, h);
  const actRow = underlineRow(act, x, y, w, h);
  const applied = previous[size] ?? 0;
  sizes[size] = {
    figmaRow: refRow,
    chromiumRow: actRow,
    appliedOffset: applied,
    offset: refRow != null && actRow != null ? applied + (refRow - actRow) : applied,
    fontSize: variant.sig.label.fontSize,
  };
}

const calibration = {
  $schema: "design-compiler/renderer-calibration@p0",
  note: "Measured renderer differences, not authored Figma properties. Consumed by compiler/figma/emit.mjs.",
  measuredFrom: { reference: ".design-compiler/reference/button-set@1x.png", capture: ".design-compiler/visual/matrix@1x.png" },
  "link-underline-offset": {
    mechanism: "text-underline-offset",
    unit: "px",
    sizes: Object.fromEntries(Object.entries(sizes).map(([size, v]) => [size, v.offset])),
    evidence: sizes,
  },
};
writeFileSync(calibrationPath, JSON.stringify(calibration, null, 2));
console.log(JSON.stringify(calibration["link-underline-offset"], null, 2));
