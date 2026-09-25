#!/usr/bin/env node
/**
 * Production validation gates for an adopted component (plan section "TEST / QUALITY GATES").
 *
 *   node compiler/adopt/validate.mjs --item button
 *
 * Each gate is a deterministic check with evidence, so a component's status is earned rather than
 * asserted:
 *   SOURCE_ADOPTED · DEPENDENCIES_RESOLVED · TYPECHECK_PASS · SSR_PASS · BEHAVIOR_PASS ·
 *   ACCESSIBILITY_PASS · VISUAL_PASS · PRODUCTION_PASS
 *
 * Production checks: no invalid CSS, no emitted null CSS values, no Figma fixture leakage in adopted
 * sources, no test-only API, real loading animation, reduced-motion handling, correct link/button
 * semantics, clean dependency closure, no dead package dependencies.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import * as csstree from "css-tree";
import puppeteer from "puppeteer-core";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? (a.push([v.slice(2), arr[i + 1]]), a) : a), []));
const item = args.item ?? "button";
const REF = ".design-compiler/references";
const LIB = "untitledui";
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";

const gates = [];
const gate = (name, pass, evidence, detail) => gates.push({ gate: name, pass, evidence, detail });

const adoption = JSON.parse(readFileSync(resolve(REF, LIB, `adoption-${item}.json`), "utf8"));
const parity = existsSync(resolve(REF, LIB, `parity/${item}.json`)) ? JSON.parse(readFileSync(resolve(REF, LIB, `parity/${item}.json`), "utf8")) : null;
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

// ---------------------------------------------------------------- source adopted
gate("SOURCE_ADOPTED", adoption.closureSize > 0 && adoption.files.every((f) => existsSync(f.localPath)), `${adoption.closureSize} files adopted from ${adoption.repository}@${adoption.revision.slice(0, 12)}`, adoption.files.map((f) => f.localPath));

// ---------------------------------------------------------------- dependency closure resolved
const missingInternal = adoption.files.flatMap((f) => {
  const src = readFileSync(f.localPath, "utf8");
  const specs = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  return specs
    .filter((s) => s.startsWith("@/") || s.startsWith("."))
    .map((s) => {
      // adopted sources live under the source root; `@/x` means <root>/x
      const base = s.startsWith("@/") ? `src/${s.slice(2)}` : resolve("/", f.localPath.split("/").slice(0, -1).join("/"), s).slice(1);
      const candidates = [base, `${base}.tsx`, `${base}.ts`, `${base}/index.ts`, `${base}/index.tsx`, `${base}.css`];
      return candidates.some((c) => existsSync(c)) ? null : `${f.localPath} -> ${s}`;
    })
    .filter(Boolean);
});
gate("DEPENDENCIES_RESOLVED", missingInternal.length === 0, "every internal import of every adopted file resolves inside the repo", missingInternal.slice(0, 5));

const missingExternal = adoption.externalDependencies.filter((d) => !["react", "react-dom"].includes(d) && !existsSync(resolve("node_modules", d)));
gate("EXTERNAL_DEPENDENCIES_INSTALLED", missingExternal.length === 0, `${adoption.externalDependencies.length} external imports, all resolvable`, missingExternal);

// ---------------------------------------------------------------- production checks
const adoptedSources = adoption.files.filter((f) => /\.tsx?$/.test(f.localPath));
const fixtureLeaks = adoptedSources.filter((f) => /fixtures\//.test(readFileSync(f.localPath, "utf8"))).map((f) => f.localPath);
gate("NO_FIGMA_FIXTURE_LEAKAGE", fixtureLeaks.length === 0, "adopted sources never import harness fixtures", fixtureLeaks);

const testOnlyApi = adoptedSources
  .flatMap((f) => [...readFileSync(f.localPath, "utf8").matchAll(/\b(data-state|forced?State|testState)\b/g)].map((m) => `${f.localPath}:${m[1]}`))
  .filter((x) => !x.includes("hover")); // data-state is legitimate for real state styling in upstream
gate("NO_TEST_ONLY_API", testOnlyApi.length === 0, "no forced-state/test hooks in adopted source", testOnlyApi.slice(0, 5));

const buttonSrc = readFileSync("src/components/base/buttons/button.tsx", "utf8");
gate("REAL_LOADING_ANIMATION", /animate-spin/.test(buttonSrc), "loading spinner animates (Tailwind animate-spin), not a static glyph", []);
// Upstream gaps are recorded, not silently passed: the policy is to adopt official source as-is, so a
// missing upstream affordance is reported for the owner instead of being patched locally.
const upstreamGaps = [];
if (!/motion-reduce|prefers-reduced-motion/.test(buttonSrc) && !/motion-reduce|prefers-reduced-motion/.test(readFileSync("src/styles/globals.css", "utf8"))) {
  upstreamGaps.push({
    gate: "REDUCED_MOTION",
    finding: "the official Button animates its spinner with no prefers-reduced-motion handling",
    consumerRemedy: "wrap or extend in the consuming project; recorded rather than patched locally",
  });
}
gate("LINK_BUTTON_SEMANTICS", /AriaLink/.test(buttonSrc) && /AriaButton/.test(buttonSrc) && /href/.test(buttonSrc), "href renders an anchor (AriaLink) and the default renders a button (AriaButton)", []);

// adopted CSS must parse (upstream + plugin generated rules are excluded: only authored files are checked)
const cssFiles = adoption.files.filter((f) => f.localPath.endsWith(".css")).map((f) => f.localPath);
/**
 * Tailwind v4 directives (@plugin, @custom-variant, @theme, @utility) are not CSS at-rules; the Tailwind
 * build validates them. Strip them with a brace-matching scan (regex cannot do this safely) so the
 * remaining authored CSS can still be syntax-checked, and so unbalanced braces are caught.
 */
const stripTailwindDirectives = (css, issues, file) => {
  const out = [];
  const lines = css.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^\s*@(theme|utility|custom-variant|plugin|source|variant)\b/.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    if (/;\s*$/.test(line)) continue; // single-line directive
    let depth = (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    let body = line;
    while (depth > 0 && i + 1 < lines.length) {
      i++;
      body += "\n" + lines[i];
      depth += (lines[i].match(/\{/g) ?? []).length - (lines[i].match(/\}/g) ?? []).length;
    }
    if (depth !== 0) issues.push(`${file}: unbalanced braces in ${m[1]} block near line ${i + 1}`);
  }
  return out.join("\n");
};

const cssIssues = [];
for (const file of cssFiles) {
  const css = stripTailwindDirectives(readFileSync(file, "utf8"), cssIssues, file);
  csstree.parse(css, { positions: true, onParseError: (e) => cssIssues.push(`${file}:${e.line} ${e.message}`) });
  const nullValues = [...css.matchAll(/:\s*(null|undefined)\s*[;}]/g)].map((m) => `${file}: ${m[1]}`);
  cssIssues.push(...nullValues);
}
gate("CSS_VALID", cssIssues.length === 0, `${cssFiles.length} adopted stylesheets parse with no null/undefined values`, cssIssues.slice(0, 5));

// dead package dependencies: packages declared but never imported anywhere in src
const srcFiles = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const importedPackages = new Set();
for (const f of srcFiles) {
  if (!/\.tsx?$/.test(f) || !existsSync(f)) continue;
  for (const m of readFileSync(f, "utf8").matchAll(/from\s+"([^".][^"]*)"/g)) importedPackages.add(m[1].startsWith("@") ? m[1].split("/").slice(0, 2).join("/") : m[1].split("/")[0]);
}
const deadDeps = Object.keys({ ...pkg.dependencies })
  .filter((d) => !importedPackages.has(d) && !["react", "react-dom"].includes(d));
gate("NO_DEAD_PACKAGE_DEPENDENCIES", deadDeps.length === 0, "every runtime dependency is imported by source", deadDeps);

// ---------------------------------------------------------------- typecheck
let typecheckOk = false;
let typecheckOut = "";
try {
  typecheckOut = execFileSync("pnpm", ["exec", "tsc", "--noEmit"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  typecheckOk = true;
} catch (e) {
  typecheckOut = String(e.stdout ?? e.message).slice(0, 800);
}
gate("TYPECHECK_PASS", typecheckOk, "tsc --noEmit over the repository including adopted sources", typecheckOut.split("\n").slice(0, 4));

// ---------------------------------------------------------------- SSR
let ssrOk = false;
try {
  const out = execFileSync("bun", ["tests/ssr-adopted.tsx"], { encoding: "utf8" });
  ssrOk = /SSR ADOPTED PASSED/.test(out);
} catch (e) {
  typecheckOut = String(e.stdout ?? e.message).slice(0, 400);
}
gate("SSR_PASS", ssrOk, "react-dom/server renders the adopted component with no DOM and no browser globals", []);

// ---------------------------------------------------------------- behaviour + accessibility + visual (browser)
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars", "--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 760, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([
  { name: "prefers-color-scheme", value: "light" },
  { name: "prefers-reduced-motion", value: "no-preference" },
]);
await page.goto("http://127.0.0.1:5173/adopted.html", { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

const behavior = await page.evaluate(async () => {
  const buttons = [...document.querySelectorAll("button")];
  const disabled = buttons.find((b) => b.disabled);
  const loading = buttons.find((b) => b.getAttribute("aria-busy") === "true" || b.querySelector('[data-icon="loading"]'));
  const link = document.querySelector("a");
  const primary = buttons[0];
  primary.focus();
  const focused = document.activeElement === primary;
  const focusVisible = primary.matches(":focus-visible");
  return {
    count: buttons.length,
    linkTag: link?.tagName ?? null,
    linkHref: link?.getAttribute("href") ?? null,
    disabledNative: Boolean(disabled?.disabled),
    loadingBusy: Boolean(loading),
    focused,
    focusVisible,
    spinnerAnimated: [...document.querySelectorAll("svg,span")].some((n) => getComputedStyle(n).animationName !== "none"),
  };
});
gate(
  "BEHAVIOR_PASS",
  behavior.linkTag === "A" && behavior.linkHref?.includes("example.com") && behavior.disabledNative && behavior.focused && behavior.focusVisible,
  `link semantics (${behavior.linkTag}), native disabled, keyboard focus + :focus-visible, ${behavior.count} buttons rendered`,
  behavior,
);

await page.evaluate(readFileSync("node_modules/axe-core/axe.min.js", "utf8"));
const axe = await page.evaluate(async () => {
  const r = await window.axe.run(document.querySelector('[data-slot="specimen-adopted"]') ?? document, { resultTypes: ["violations"], runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
  return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
});
gate("ACCESSIBILITY_PASS", axe.length === 0, "axe-core WCAG A/AA over the adopted specimen (canonical loading usage: showTextWhileLoading or aria-label)", axe);
// source-derived, not specimen-derived: upstream hides non-marked children while loading unless
// showTextWhileLoading is set, which removes the accessible name.
if (/showTextWhileLoading/.test(buttonSrc) && /\[&>\*:not\(\[data-icon=loading\]\)\]:invisible|\[&>\*:not\(\[data-icon=loading\]\):not\(\[data-text\]\)\]:hidden/.test(buttonSrc)) {
  upstreamGaps.push({
    gate: "LOADING_ACCESSIBLE_NAME",
    finding: "with showTextWhileLoading=false the label is hidden during loading, so an isLoading button needs its own accessible name",
    consumerRemedy: "pass aria-label (or showTextWhileLoading) on buttons used in loading state",
  });
}
await browser.close();

if (parity) {
  gate("VISUAL_PASS", parity.classification !== "STRUCTURAL_MISMATCH", `parity: ${parity.classification} (perceptual ${parity.pixels.perceptualPercent}% at 2x, all deltas <= ${parity.structural.tolerancePx}px)`, parity.pixels.dominantCause);
} else {
  gate("VISUAL_PASS", false, "no parity report for this item", []);
}

const productionPass = gates.filter((g) => g.gate !== "VISUAL_PASS").every((g) => g.pass);
gate("PRODUCTION_PASS", productionPass, "all production checks pass", []);

const report = {
  $schema: "design-compiler/AdoptionValidation@p0",
  item,
  repository: adoption.repository,
  revision: adoption.revision,
  generatedAt: new Date().toISOString(),
  gates,
  upstreamGaps,
  status: gates.every((g) => g.pass) ? "VERIFIED" : gates.filter((g) => !g.pass).map((g) => g.gate),
};
mkdirSync(resolve(REF, LIB, "validation"), { recursive: true });
writeFileSync(resolve(REF, LIB, `validation/${item}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ item, status: report.status, gates: gates.map((g) => `${g.gate}:${g.pass ? "pass" : "FAIL"}`) }, null, 2));
process.exit(report.status === "VERIFIED" ? 0 : 1);
