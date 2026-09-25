#!/usr/bin/env node
/**
 * Accessibility gate for the migration: axe-core WCAG A/AA over every migration case.
 *
 *   node compiler/migration/a11y.mjs [--port 5173] [--json]
 *
 * Runs against the same harness the parity gate uses, so "migrated and accessible" is one observation, not
 * two different pages. Violations are reported per case with the axe rule id and the offending node.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const args = new Map(
  process.argv
    .slice(2)
    .join(" ")
    .matchAll(/--([a-z-]+)(?:[= ]([^\s]+))?/g)
    .map((m) => [m[1], m[2] ?? "true"]),
);
const PORT = args.get("port") ?? "5173";
const LABEL = args.get("label") ?? "candidate";
const BASELINE = args.get("baseline") ?? ".design-compiler/base-ui-migration/a11y-baseline.json";
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--font-render-hinting=none"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1400 });
await page.goto(`http://127.0.0.1:${PORT}/migration.html`, { waitUntil: "networkidle0" });
await page.evaluate(readFileSync("node_modules/axe-core/axe.min.js", "utf8"));
// wait for the harness to finish rendering all cases before measuring
await page.waitForFunction(() => document.querySelectorAll("[data-case]").length > 0, { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));

const results = await page.evaluate(async () => {
  const axe = window.axe;
  const out = {};
  for (const section of document.querySelectorAll("[data-case]")) {
    const id = section.getAttribute("data-case");
    if (!section.isConnected || !section.querySelector("*")) {
      out[id] = [{ rule: "harness", impact: "n/a", description: "case rendered nothing (skipped)", nodes: [] }];
      continue;
    }
    const result = await axe.run(section, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    out[id] = result.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      description: violation.help,
      nodes: violation.nodes.slice(0, 3).map((n) => n.html.slice(0, 160)),
    }));
  }
  return out;
});

await browser.close();

const signature = (violations) => [...new Set(violations.map((v) => v.rule))].sort().join(",");
const violatingCases = Object.entries(results).filter(([, violations]) => violations.length > 0);

/**
 * The gate fails on NEW violations only. Pre-existing violations are captured in the baseline report and
 * listed as debt: a migration must not be blocked by accessibility gaps it did not introduce, and must never
 * hide one it did. Run with --label baseline to rewrite that baseline.
 */
const baseline = existsSync(BASELINE) && LABEL !== "baseline" ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
const newViolations = {};
const preExisting = {};
for (const [caseId, violations] of violatingCases) {
  const baseSig = signature(baseline?.violations?.[caseId] ?? []);
  const currentSig = signature(violations);
  const added = violations.filter((v) => !baseSig.split(",").includes(v.rule));
  if (added.length) newViolations[caseId] = added;
  const stillPresent = violations.filter((v) => baseSig.split(",").includes(v.rule));
  if (stillPresent.length) preExisting[caseId] = stillPresent;
}

const report = {
  $schema: "design-compiler/BaseUiA11yReport@p0",
  label: LABEL,
  standard: "axe-core wcag2a, wcag2aa, wcag21a, wcag21aa",
  cases: Object.keys(results).length,
  violatingCases: violatingCases.length,
  newViolations,
  preExisting,
  violations: LABEL === "baseline" ? Object.fromEntries(violatingCases) : undefined,
};
writeFileSync(`.design-compiler/base-ui-migration/a11y-${LABEL}.json`, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      status: Object.keys(newViolations).length === 0 ? "PASS" : "FAIL",
      label: LABEL,
      cases: report.cases,
      violatingCases: report.violatingCases,
      newViolations: Object.keys(newViolations).length,
      preExisting: Object.keys(preExisting),
      report: `.design-compiler/base-ui-migration/a11y-${LABEL}.json`,
      sample: Object.entries(newViolations).slice(0, 4),
    },
    null,
    2,
  ),
);
process.exit(Object.keys(newViolations).length === 0 ? 0 : 1);
