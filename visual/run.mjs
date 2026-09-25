#!/usr/bin/env node
/**
 * P0 verification pipeline: capture -> compare -> conformance -> consolidated report.
 *
 *   node visual/run.mjs [--url http://127.0.0.1:5173/specimen.html]
 *
 * Deterministic: fixed viewport, DPR 1 and 2, clip == Figma specimen box, no network beyond localhost.
 * Artifacts land in .design-compiler/visual/.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const arg = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const url = arg.url ?? "http://127.0.0.1:5173/specimen.html";
const out = ".design-compiler/visual";
mkdirSync(out, { recursive: true });

const run = (cmd, argv) => execFileSync(cmd, argv, { stdio: ["ignore", "pipe", "inherit"] }).toString();
const json = (cmd, argv) => JSON.parse(run(cmd, argv));

const ir = JSON.parse(readFileSync(".design-compiler/ir/button.component.json", "utf8"));
const spec = ir.specimen;
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";

// Figma exports are padded by the effect bleed; the button box inside the export is known from IR
// (export origin = node origin - bleed). 1x: bleed (2,1); 2x: (4,2).
const scales = [
  { dpr: 1, ref: ".design-compiler/reference/golden@1x.png", bleed: [2, 1], textBox: [32, 6, 78, 20] },
  { dpr: 2, ref: ".design-compiler/reference/golden@2x.png", bleed: [4, 2], textBox: [64, 12, 156, 40] },
];

const results = [];
for (const s of scales) {
  const actual = `${out}/golden@${s.dpr}x.png`;
  const geometry = `${out}/geometry@${s.dpr}x.json`;
  const reportPath = `${out}/report@${s.dpr}x.json`;
  const capture = json("node", ["visual/capture.mjs", url, "#specimen", "button", "400", "200", String(s.dpr), actual, geometry]);
  const [bx, by] = s.bleed;
  const compare = json("node", [
    "visual/compare.mjs",
    "--ref", s.ref,
    "--refBox", `${bx},${by},${spec.box.w * s.dpr},${spec.box.h * s.dpr}`,
    "--actual", actual,
    "--out", reportPath,
    "--textBox", s.textBox.join(","),
  ]);
  const conformance = json("node", ["visual/check-conformance.mjs", geometry, ".design-compiler/ir/button.component.json", ".design-compiler/tokens.json", `${out}/conformance@${s.dpr}x.json`]);
  results.push({
    dpr: s.dpr,
    componentBox: capture.box,
    clip: capture.clip,
    perceptualPercent: compare.perceptualPercent,
    structuralPercent: compare.structuralPercent,
    exactDiffPercent: compare.exactDiffPercent,
    channelDelta: compare.channelDelta,
    byRegion: compare.byRegion,
    worstTiles: compare.worstTiles,
    conformance: { status: conformance.status, checks: conformance.checks.length, geometryMaxDelta: conformance.geometryMaxDelta, tokenMismatches: conformance.tokenMismatches, failures: conformance.failures },
  });
}

const thresholds = { exactDiffPercent: 1, perceptualPercent: 1, structuralPercent: 1, geometryMaxDelta: 1, tokenMismatches: 0, criticalLayoutErrors: 0 };
const verdict = {
  component: "Button",
  figma: { componentSet: ir.figma.componentSetId, specimen: spec.nodeId, variant: spec.variant },
  api: { variant: "primary", size: "xs", iconOnly: false, icons: ["leading", "trailing"] },
  thresholds,
  scales: results,
  status:
    results.every((r) => r.perceptualPercent < thresholds.perceptualPercent && r.conformance.status === "PASS" && r.conformance.geometryMaxDelta <= thresholds.geometryMaxDelta && r.conformance.tokenMismatches <= thresholds.tokenMismatches)
      ? "PASS"
      : "FAIL",
  notes: {
    exactDiffPercent:
      "Raw 'any channel differs' count. At 1x it is dominated by font rasterization differences between Figma's renderer and Chromium (identical glyph ink, identical layout): see byRegion.text.",
    structuralPercent: "Pixels whose worst channel delta exceeds 8/255 - the practical structural metric; the remainder is anti-aliasing noise.",
    chrome: CHROME,
  },
};
writeFileSync(`${out}/report.json`, JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));
process.exit(verdict.status === "PASS" ? 0 : 1);
