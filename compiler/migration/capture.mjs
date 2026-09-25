#!/usr/bin/env node
/**
 * Captures the behaviour of every migration case through the browser: ARIA semantics, focus/keyboard
 * outcomes, semantic-slot geometry and computed styles, and a screenshot.
 *
 *   node compiler/migration/capture.mjs --label baseline     # React Aria implementation
 *   node compiler/migration/capture.mjs --label migrated     # Base UI implementation
 *
 * The capture is deliberately blind to implementation: it drives the harness through its public API and reads
 * only what a user or an assistive technology can observe. That makes the baseline honest evidence, and the
 * comparison in parity.mjs meaningful.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const args = new Map(
  process.argv
    .slice(2)
    .join(" ")
    .matchAll(/--([a-z-]+)(?:[= ]([^\s]+))?/g)
    .map((m) => [m[1], m[2] ?? "true"]),
);
const LABEL = args.get("label") ?? "baseline";
const PORT = args.get("port") ?? "5173";
const OUT = `.design-compiler/base-ui-migration/captures/${LABEL}`;
const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";

mkdirSync(`${OUT}/shots`, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars", "--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([
  { name: "prefers-color-scheme", value: "light" },
  { name: "prefers-reduced-motion", value: "reduce" },
]);
await page.goto(`http://127.0.0.1:${PORT}/migration.html`, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

/** Everything observable about the case: roles/names/states, focus, and slot metrics. */
const probe = (caseId, slots) =>
  page.evaluate(
    (id, slotSelectors) => {
      const section = document.querySelector(`[data-case="${id}"]`);
      if (!section) return { missing: true };
      const body = section.querySelector("[data-case-body]");
      const describe = (el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role"),
          type: el.getAttribute("type"),
          name: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 60) ?? null,
          attrs: Object.fromEntries(
            [...el.attributes]
              .filter((a) => /^(aria-|data-|type|name|value|role|href|disabled|required|readonly|checked|placeholder|id|for)/.test(a.name))
              .map((a) => [a.name, a.value.slice(0, 80)]),
          ),
          styles: {
            display: cs.display,
            position: cs.position,
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            borderColor: cs.borderTopColor,
            borderRadius: cs.borderTopLeftRadius,
            fontFamily: cs.fontFamily.split(",")[0],
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
            margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
            gap: cs.gap,
            width: Math.round(rect.width * 100) / 100,
            height: Math.round(rect.height * 100) / 100,
            opacity: cs.opacity,
            visibility: cs.visibility,
          },
        };
      };
      const slotMetrics = {};
      for (const selector of slotSelectors ?? []) {
        const el = body?.querySelector(selector);
        if (el) slotMetrics[selector] = describe(el);
        else slotMetrics[selector] = { missing: true };
      }
      const controlState = [...(body?.querySelectorAll("input,select,textarea") ?? [])].map((el) => ({
        type: el.getAttribute("type"),
        checked: "checked" in el ? el.checked : null,
        indeterminate: "indeterminate" in el ? el.indeterminate : null,
        value: el.value?.slice(0, 40) ?? null,
        disabled: el.disabled,
        required: el.required,
        name: el.getAttribute("name"),
      }));
      // overlays render through portals, so they are observed on the document, and only when visible
      const portals = [...document.querySelectorAll("[role=listbox],[role=option],[role=dialog],[role=alertdialog],[role=menu],[role=menuitem],[role=tooltip],[role=grid],[role=tree]")]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          const owner = el.closest("[data-case]");
          const belongsElsewhere = owner && owner !== section;
          return rect.width > 0 && rect.height > 0 && !belongsElsewhere;
        })
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            role: el.getAttribute("role"),
            text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
            styles: { backgroundColor: cs.backgroundColor, borderColor: cs.borderTopColor, borderRadius: cs.borderTopLeftRadius, boxShadow: cs.boxShadow.slice(0, 40), zIndex: cs.zIndex },
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          };
        });
      const focusVisible = document.activeElement instanceof HTMLElement && document.activeElement.matches(":focus-visible");
      return {
        text: body?.innerText?.replace(/\s+/g, " ").trim().slice(0, 300) ?? "",
        controlState,
        portals,
        focusVisible,
        pointerEvents: body ? getComputedStyle(body).pointerEvents : null,
        roles: [...(body?.querySelectorAll("[role]") ?? [])].map((el) => `${el.getAttribute("role")}${el.getAttribute("aria-expanded") ? `[expanded=${el.getAttribute("aria-expanded")}]` : ""}`),
        focusable: [...(body?.querySelectorAll("a[href],button,input,select,textarea,summary,[tabindex]") ?? [])].map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type"),
          tabIndex: el.getAttribute("tabindex"),
          disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40),
        })),
        interactiveCount: body?.querySelectorAll("a[href],button,input,select,textarea,[role=button],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=option],[role=slider],[role=combobox]").length ?? 0,
        activeElement: document.activeElement ? `${document.activeElement.tagName.toLowerCase()}:${(document.activeElement.getAttribute("aria-label") ?? document.activeElement.textContent ?? "").trim().slice(0, 30)}` : null,
        slotMetrics,
      };
    },
    caseId,
    slots,
  );

// Cases and their interaction scripts come from the harness itself so this script never restates them.
const cases = await page.evaluate(() =>
  [...document.querySelectorAll("[data-case]")].map((el) => el.getAttribute("data-case")),
);

const capture = { $schema: "design-compiler/BaseUiMigrationCapture@p0", label: LABEL, capturedAt: new Date().toISOString(), cases: {} };

for (const id of cases) {
  const section = await page.$(`[data-case="${id}"]`);
  await page.evaluate((caseId) => document.querySelector(`[data-case="${caseId}"]`)?.scrollIntoView({ block: "center" }), id);
  await new Promise((r) => setTimeout(r, 120));

  const slots = await page.evaluate((caseId) => {
    const el = document.querySelector(`[data-case="${caseId}"]`);
    return el ? JSON.parse(el.getAttribute("data-slots") ?? "null") : null;
  }, id);
  const staticState = await probe(id, slots);

  // reset any state the previous case left behind (focus, open popups) before interacting
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    document.body.click();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await new Promise((r) => setTimeout(r, 120));

  // Each step is traced: parity later has to know WHICH interaction changed state, not just the end state.
  const stepState = () =>
    page.evaluate(
      (caseId) => {
        const section = document.querySelector(`[data-case="${caseId}"]`);
        const controls = [...(section?.querySelectorAll("input,select,textarea") ?? [])].map((el) => ({
          type: el.getAttribute("type"),
          checked: "checked" in el ? el.checked : null,
          value: el.value?.slice(0, 30) ?? null,
          disabled: el.disabled,
        }));
        const expanded = [...(section?.querySelectorAll("[aria-expanded]") ?? [])].map((el) => el.getAttribute("aria-expanded"));
        const overlays = [...document.querySelectorAll("[role=listbox],[role=option],[role=tooltip],[role=dialog],[role=menu],[role=menuitem]")].filter((el) => {
          const rect = el.getBoundingClientRect();
          const owner = el.closest("[data-case]");
          return rect.width > 0 && rect.height > 0 && (!owner || owner === section);
        }).length;
        return { controls, expanded, overlays, active: document.activeElement?.tagName.toLowerCase() ?? null };
      },
      id,
    );

  const runActions = async (actions) => {
    const trace = [{ step: "start", state: await stepState() }];
    for (const [index, action] of actions.entries()) {
      const section = await page.$(`[data-case="${id}"]`);
      // NOTE: `section.$(sel)` prefixes the whole comma list correctly, unlike a document-level
      // `[data-case="x"] a, b` which would resolve the later alternatives globally.
      const target = action.target ? await section.$(action.target) : section;
      if (!target) {
        trace.push({ step: `${index}:${action.type}`, error: "target not found", target: action.target });
        continue;
      }
      if (action.type === "click") await target.click().catch(() => {});
      else if (action.type === "focus") await target.focus().catch(() => {});
      else if (action.type === "hover") await target.hover().catch(() => {});
      else if (action.type === "type" && action.value) await target.type(action.value).catch(() => {});
      else if (action.type === "press" && action.keys) for (const key of action.keys) await page.keyboard.press(key).catch(() => {});
      await new Promise((r) => setTimeout(r, 260));
      trace.push({ step: `${index}:${action.type}${action.keys ? " " + action.keys.join("+") : ""}`, state: await stepState() });
    }
    return trace;
  };

  const script = await page.evaluate((caseId) => {
    const el = document.querySelector(`[data-case="${caseId}"]`);
    return el ? JSON.parse(el.getAttribute("data-actions") ?? "[]") : [];
  }, id);

  const actionTrace = await runActions(script);
  const afterInteraction = script.length ? await probe(id, slots) : null;

  await section.screenshot({ path: `${OUT}/shots/${id}.png` }).catch(() => {});
  capture.cases[id] = { static: staticState, slots, actions: script, actionTrace, afterInteraction };
}

await browser.close();
writeFileSync(`${OUT}/capture.json`, JSON.stringify(capture, null, 2));
const casesWithInteraction = Object.values(capture.cases).filter((c) => c.afterInteraction).length;
console.log(JSON.stringify({ wrote: `${OUT}/capture.json`, label: LABEL, cases: cases.length, withInteraction: casesWithInteraction, shots: `${OUT}/shots/` }, null, 2));
