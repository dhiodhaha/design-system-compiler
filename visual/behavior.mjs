#!/usr/bin/env node
/**
 * Behavioral + accessibility gate (ACCURACY_STRATEGY.md §10, §11; COMPONENT_SEMANTICS.md BehaviorIR/AccessibilityIR).
 *
 *   node visual/behavior.mjs
 *
 * Static screenshots cannot validate behaviour, so this drives the real component in Chromium and asserts
 * observed interaction: hover, keyboard focus, disabled, loading, activation (mouse/keyboard), and the
 * accessible name of an icon-only button. Then it runs axe-core over the visual grid and this page.
 *
 * Output: .design-compiler/visual/behavior-report.json (categories from the §21 error taxonomy).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const out = ".design-compiler/visual";
mkdirSync(out, { recursive: true });
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";
const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars", "--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 700, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([
  { name: "prefers-color-scheme", value: "light" },
  { name: "prefers-reduced-motion", value: "no-preference" },
]);
await page.goto("http://127.0.0.1:5173/behavior.html", { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

const results = [];
const check = (category, name, pass, expected, actual) => results.push({ category, check: name, pass, expected, actual });

const bgOf = (testid) => page.$eval(`[data-testid="${testid}"]`, (el) => getComputedStyle(el).backgroundColor);
const boxShadowOf = (testid) => page.$eval(`[data-testid="${testid}"]`, (el) => getComputedStyle(el).boxShadow);

// ---- hover: real pointer, real :hover
const before = await bgOf("case-primary");
await page.hover('[data-testid="case-primary"]');
await new Promise((r) => setTimeout(r, 250));
const after = await bgOf("case-primary");
check("BEHAVIOR", "hover changes background to the Hover rule", before !== after && after === "rgb(105, 65, 198)", "rgb(105, 65, 198)", `${before} -> ${after}`);

// ---- keyboard focus: Tab reaches the button and :focus-visible paints the focus ring
await page.evaluate(() => document.body.focus());
await page.keyboard.press("Tab");
const focused = await page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.getAttribute("data-testid"));
check("BEHAVIOR", "Tab focuses the first Button", focused === "case-primary", "case-primary", String(focused));
const focusRingFull = await page.$eval('[data-testid="case-primary"]', (el) => getComputedStyle(el).boxShadow);
check("BEHAVIOR", "focus-visible renders the focus ring", /158, 119, 237/.test(focusRingFull) && /255, 255, 255/.test(focusRingFull), "white 2px + #9E77ED 4px ring", focusRingFull);

// ---- activation: mouse click and keyboard activation both fire exactly once
await page.evaluate(() => (window.__events = []));
await page.click('[data-testid="case-secondary"]');
await page.focus('[data-testid="case-keyboard"]');
await page.keyboard.press("Enter");
await page.keyboard.press("Space");
const events = await page.evaluate(() => window.__events);
check("BEHAVIOR", "click fires once", events.filter((e) => e.key === "secondary").length === 1, 1, events.filter((e) => e.key === "secondary").length);
check("BEHAVIOR", "Enter and Space both activate", events.filter((e) => e.key === "keyboard").length === 2, 2, events.filter((e) => e.key === "keyboard").length);

// ---- composition slots: child order resolves to leading/trailing visuals
const composed = await page.evaluate(() => {
  const read = (id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return [...el.children].map((c) => c.dataset.slot ?? "label");
  };
  return { leading: read("case-composed-leading"), trailing: read("case-composed-trailing"), leadingText: document.querySelector('[data-testid="case-composed-leading"] [data-slot="label"]')?.textContent };
});
check("BEHAVIOR", "composition: leading element child becomes the leading visual", JSON.stringify(composed.leading) === JSON.stringify(["icon", "label"]), '["icon","label"]', JSON.stringify(composed.leading));
check("BEHAVIOR", "composition: trailing element child becomes the trailing visual", JSON.stringify(composed.trailing) === JSON.stringify(["label", "icon"]), '["label","icon"]', JSON.stringify(composed.trailing));

// ---- shadcn-grade surface: icon size sugar, explicit data-icon slots, buttonVariants on an anchor
const surface = await page.evaluate(() => {
  const attr = (id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return { variant: el.dataset.variant, size: el.dataset.size, iconOnly: el.dataset.iconOnly, slots: [...el.children].map((c) => c.dataset.slot ?? "label"), bg: getComputedStyle(el).backgroundColor, radius: getComputedStyle(el).borderTopLeftRadius };
  };
  return { iconSize: attr("case-icon-size"), marked: attr("case-marked-slots"), spinnerChild: attr("case-composed-spinner"), link: attr("case-variants-helper"), reference: attr("case-secondary") };
});
check("BEHAVIOR", "size=\"icon-lg\" sets the icon-only layout", surface.iconSize.size === "lg" && surface.iconSize.iconOnly === "true", 'size=lg iconOnly=true', JSON.stringify(surface.iconSize));
check("BEHAVIOR", "data-icon markers place both visuals explicitly", JSON.stringify(surface.marked.slots) === JSON.stringify(["icon", "label", "icon"]), '["icon","label","icon"]', JSON.stringify(surface.marked.slots));
check("BEHAVIOR", "composed <Spinner data-icon> renders in the leading slot", surface.spinnerChild.slots[0] === "icon", "icon", JSON.stringify(surface.spinnerChild.slots));
check("BEHAVIOR", "buttonVariants on a plain <a> matches the <Button> styling", surface.link.variant === "secondary" && surface.link.bg === surface.reference.bg && surface.link.radius === surface.reference.radius, `bg ${surface.reference.bg} r ${surface.reference.radius}`, `bg ${surface.link.bg} r ${surface.link.radius}`);

// ---- disabled: native disabled blocks pointer + keyboard activation
await page.evaluate(() => (window.__events = []));
await page.click('[data-testid="case-disabled"]').catch(() => {});
await page.focus('[data-testid="case-disabled"]').catch(() => {});
await page.keyboard.press("Enter");
const disabledEvents = await page.evaluate(() => window.__events);
const disabledOpacity = await page.$eval('[data-testid="case-disabled"]', (el) => getComputedStyle(el).opacity);
const disabledAttr = await page.$eval('[data-testid="case-disabled"]', (el) => el.disabled);
const domContract = await page.$eval('[data-testid="case-secondary"]', (el) => ({ variant: el.dataset.variant, size: el.dataset.size, iconOnly: el.dataset.iconOnly, figma: el.dataset.figmaVariant }));
check("BEHAVIOR", "DOM exposes the public contract, not Figma vocabulary", domContract.variant === "secondary" && !/\s/.test(domContract.variant), 'data-variant="secondary"', JSON.stringify(domContract));
check("BEHAVIOR", "disabled blocks activation", disabledEvents.length === 0, 0, disabledEvents.length);
check("BEHAVIOR", "disabled uses the native attribute", disabledAttr === true, true, disabledAttr);
check("BEHAVIOR", "disabled keeps the Figma opacity", disabledOpacity === "0.5", "0.5", disabledOpacity);

// ---- loading: aria-busy + activation blocked
const loadingBusy = await page.$eval('[data-testid="case-loading"]', (el) => el.getAttribute("aria-busy"));
await page.evaluate(() => (window.__events = []));
await page.click('[data-testid="case-loading"]', { delay: 10 }).catch(() => {});
await new Promise((r) => setTimeout(r, 100));
const loadingEvents = await page.evaluate(() => window.__events);
check("BEHAVIOR", "loading exposes aria-busy", loadingBusy === "true", "true", String(loadingBusy));
check("BEHAVIOR", "loading blocks activation (no double submit)", loadingEvents.length === 0, 0, loadingEvents.length);
const loadingAriaDisabled = await page.$eval('[data-testid="case-loading"]', (el) => el.getAttribute("aria-disabled"));
check("BEHAVIOR", "loading exposes aria-disabled while staying focusable", loadingAriaDisabled === "true", "true", String(loadingAriaDisabled));
const keyboardLoading = await page.evaluate(async () => {
  const el = document.querySelector('[data-testid="case-loading"]');
  window.__events = [];
  el.focus();
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  el.click();
  return window.__events.length;
});
check("BEHAVIOR", "loading blocks keyboard and programmatic activation", keyboardLoading === 0, 0, keyboardLoading);

// ---- icon-only: accessible name from aria-label
const snapshot = await page.accessibility.snapshot();
const findNode = (node, name) => {
  if (!node) return null;
  if (node.role === "button" && node.name === name) return node;
  for (const child of node.children ?? []) {
    const hit = findNode(child, name);
    if (hit) return hit;
  }
  return null;
};
check("ACCESSIBILITY", "icon-only button exposes an accessible name", Boolean(findNode(snapshot, "Settings")), "Settings", findNode(snapshot, "Settings")?.name ?? "(none)");

// ---- axe-core over both pages
for (const [label, url] of [["behavior", "http://127.0.0.1:5173/behavior.html"], ["grid", "http://127.0.0.1:5173/grid.html"]]) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 1700, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: "networkidle0" });
  await p.evaluate(AXE);
  const axe = await p.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ["violations"], runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
  });
  check("ACCESSIBILITY", `axe-core: no WCAG A/AA violations on ${label}`, axe.length === 0, 0, JSON.stringify(axe));
  await p.close();
}

const failures = results.filter((r) => !r.pass);
const report = {
  component: "Button",
  environment: {
    browser: await browser.version(),
    viewport: "800x700 (behavior) / 1440x1700 (axe)",
    dpr: 1,
    colorScheme: "light",
    reducedMotion: "no-preference",
    fonts: "pinned via src/styles/tokens.css",
  },
  byCategory: results.reduce((acc, r) => ({ ...acc, [r.category]: { total: (acc[r.category]?.total ?? 0) + 1, pass: (acc[r.category]?.pass ?? 0) + (r.pass ? 1 : 0) } }), {}),
  checks: results,
  failures,
  status: failures.length === 0 ? "PASS" : "FAIL",
};
writeFileSync(`${out}/behavior-report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify({ status: report.status, checks: results.length, failures: failures.map((f) => `${f.category}:${f.check} expected ${f.expected} got ${f.actual}`) }, null, 2));
process.exit(report.status === "PASS" ? 0 : 1);
