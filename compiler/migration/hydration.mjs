#!/usr/bin/env node
/**
 * Hydration smoke gate.
 *
 *   node compiler/migration/hydration.mjs [--port 5173]
 *
 * Loads `/hydration.html`, which renders the migration cases with `renderToString`, injects that HTML and
 * hydrates it. Fails when hydration produced mismatches, recoverable errors, or did not complete.
 */
import puppeteer from "puppeteer-core";

const args = new Map(
  process.argv
    .slice(2)
    .join(" ")
    .matchAll(/--([a-z-]+)(?:[= ]([^\s]+))?/g)
    .map((m) => [m[1], m[2] ?? "true"]),
);
const PORT = args.get("port") ?? "5173";
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--force-color-profile=srgb", "--font-render-hinting=none"],
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 300)));
await page.setViewport({ width: 1200, height: 1400 });
await page.goto(`http://127.0.0.1:${PORT}/hydration.html`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2500));

const result = await page.evaluate(() => {
  const report = window.__hydration ?? null;
  return {
    report,
    renderedCases: document.querySelectorAll("[data-case]").length,
  };
});
await browser.close();

const mismatches = result.report?.mismatches ?? [];
const failures = [
  ...(!result.report?.hydrated ? [{ class: "HYDRATION_FAILURE", detail: `hydration did not complete: ${result.report?.error ?? "unknown"}` }] : []),
  ...mismatches.map((m) => ({ class: "HYDRATION_FAILURE", detail: m })),
  ...pageErrors.map((e) => ({ class: "SSR_FAILURE", detail: e })),
  ...(result.renderedCases === 0 ? [{ class: "HYDRATION_FAILURE", detail: "no cases present after hydration" }] : []),
];

console.log(
  JSON.stringify(
    {
      status: failures.length === 0 ? "PASS" : "FAIL",
      hydrated: result.report?.hydrated ?? false,
      cases: result.report?.caseCount ?? 0,
      renderedCases: result.renderedCases,
      ssrBytes: result.report?.ssrBytes ?? 0,
      mismatches: mismatches.length,
      failures,
    },
    null,
    2,
  ),
);
process.exit(failures.length ? 1 : 0);
