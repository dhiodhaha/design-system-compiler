/**
 * Scoped verification for the `remaining-primitives` unit: renders only this unit's components (tmp-verify.tsx)
 * and compares the observable behaviour of the nine harness cases against the React Aria baseline capture,
 * using the same probe functions the central capture/parity gates use.
 */
import { readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_BIN || "/home/dhio/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome";
const PORT = process.env.PORT || "5199";
const CASE_IDS = ["tags-render", "tabs-default", "slider-default", "slider-keyboard", "input-number", "input-payment", "input-tags", "form-submit", "file-upload"];

const WIDGET_STATE_JS = `
  const normalizeRole = (el) => {
    const type = el.getAttribute("type");
    return (
      el.getAttribute("role") ??
      (el.tagName === "INPUT" && type === "checkbox" ? "checkbox" : null) ??
      (el.tagName === "INPUT" && type === "radio" ? "radio" : null) ??
      (el.tagName === "INPUT" && type === "range" ? "slider" : null) ??
      (el.tagName === "INPUT" ? "textbox" : null) ??
      (el.tagName === "TEXTAREA" ? "textbox" : null) ??
      (el.tagName === "SELECT" ? "combobox" : null) ??
      el.tagName.toLowerCase()
    );
  };
  const widgetState = (root) => {
    const candidates = [...(root?.querySelectorAll("input,select,textarea,[role=checkbox],[role=radio],[role=switch],[role=slider],[role=option],[role=tab],[aria-pressed],[aria-checked]") ?? [])]
      .filter((el) => el.getAttribute("type") !== "hidden");
    return candidates
      .filter((el) => {
        const role = normalizeRole(el);
        for (let parent = el.parentElement; parent && parent !== root.parentElement; parent = parent.parentElement) {
          if (normalizeRole(parent) === role) return false;
        }
        const box = el.getBoundingClientRect();
        const hidden = box.width <= 1 || box.height <= 1 || (el.offsetParent === null && getComputedStyle(el).position !== "fixed");
        return !hidden;
      })
      .map((el) => {
        const checked = el.getAttribute("aria-checked") ?? el.getAttribute("aria-pressed") ?? ("checked" in el && typeof el.checked === "boolean" ? String(el.checked) : null);
        return {
          role: normalizeRole(el),
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30),
          checked: checked === null ? null : String(checked),
          disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
          focusable: el.tabIndex >= 0,
        };
      });
  };
`;

const probe = (page, caseId, slots) =>
    page.evaluate(
        (id, slotSelectors, WIDGET_STATE_SRC) => {
            const widgetState = new Function(`${WIDGET_STATE_SRC}; return widgetState;`)();
            const section = document.querySelector(`[data-case="${id}"]`);
            if (!section) return { missing: true };
            const renderError = section.querySelector("[data-case-error]")?.getAttribute("data-case-error") ?? null;
            if (renderError) return { renderError };
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
                slotMetrics[selector] = el ? describe(el) : { missing: true };
            }
            const controlState = [...(body?.querySelectorAll("input,select,textarea") ?? [])].map((el) => ({
                type: el.getAttribute("type"),
                checked: "checked" in el ? el.checked : null,
                value: el.value?.slice(0, 40) ?? null,
                disabled: el.disabled,
                required: el.required,
                name: el.getAttribute("name"),
                hidden: el.getAttribute("type") === "hidden" || el.offsetParent === null,
            }));
            const portals = [...document.querySelectorAll("[role=listbox],[role=option],[role=dialog],[role=alertdialog],[role=menu],[role=menuitem],[role=tooltip],[role=grid],[role=tree]")]
                .filter((el) => {
                    const rect = el.getBoundingClientRect();
                    const owner = el.closest("[data-case]");
                    return rect.width > 0 && rect.height > 0 && (!owner || owner === section);
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
            const stateful = widgetState(body);
            return {
                text: body?.innerText?.replace(/\s+/g, " ").trim().slice(0, 300) ?? "",
                controlState,
                stateful,
                portals,
                roles: [...(body?.querySelectorAll("[role]") ?? [])].map((el) => `${el.getAttribute("role")}`),
                focusable: [...(body?.querySelectorAll("a[href],button,input,select,textarea,summary,[tabindex]") ?? [])].map((el) => ({
                    tag: el.tagName.toLowerCase(),
                    type: el.getAttribute("type"),
                    tabIndex: el.getAttribute("tabindex"),
                    disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
                    name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40),
                    role: el.getAttribute("role") ?? el.tagName.toLowerCase(),
                })),
                interactiveCount: body?.querySelectorAll("a[href],button,input,select,textarea,[role=button],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=option],[role=slider],[role=combobox]").length ?? 0,
                slotMetrics,
            };
        },
        caseId,
        slots,
        WIDGET_STATE_JS,
    );

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
const consoleErrors = [];
page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${String(error).slice(0, 300)}`));

await page.goto(`http://127.0.0.1:${PORT}/tmp-verify.html`, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

// axe over the same cases the a11y gate measures
await page.evaluate(readFileSync("node_modules/axe-core/axe.min.js", "utf8"));
const a11y = await page.evaluate(async (ids) => {
    const out = {};
    for (const id of ids) {
        const section = document.querySelector(`[data-case="${id}"]`);
        if (!section || !section.querySelector("*")) {
            out[id] = [{ rule: "harness", nodes: [] }];
            continue;
        }
        const result = await window.axe.run(section, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
        out[id] = result.violations.map((violation) => ({ rule: violation.id, impact: violation.impact, nodes: violation.nodes.slice(0, 2).map((n) => n.html.slice(0, 120)) }));
    }
    return out;
}, CASE_IDS);

const capture = {};
for (const id of CASE_IDS) {
    const slots = await page.evaluate((caseId) => {
        const el = document.querySelector(`[data-case="${caseId}"]`);
        return el ? JSON.parse(el.getAttribute("data-slots") ?? "null") : null;
    }, id);
    const staticState = await probe(page, id, slots);

    await page.keyboard.press("Escape");
    await page.evaluate(() => {
        document.body.click();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await new Promise((r) => setTimeout(r, 120));

    const stepState = () =>
        page.evaluate(
            (caseId, WIDGET_STATE_SRC) => {
                const widgetState = new Function(`${WIDGET_STATE_SRC}; return widgetState;`)();
                const section = document.querySelector(`[data-case="${caseId}"]`);
                const expanded = [...(section?.querySelectorAll("[aria-expanded]") ?? [])].map((el) => el.getAttribute("aria-expanded"));
                const ariaStates = widgetState(section).map((entry) => `${entry.role}:${entry.checked}:${entry.disabled}`);
                const overlays = [...document.querySelectorAll("[role=listbox],[role=option],[role=tooltip],[role=dialog],[role=menu],[role=menuitem]")].filter((el) => {
                    const rect = el.getBoundingClientRect();
                    const owner = el.closest("[data-case]");
                    return rect.width > 0 && rect.height > 0 && (!owner || owner === section);
                }).length;
                const controls = [...(section?.querySelectorAll("input,select,textarea") ?? [])].map((el) => ({
                    type: el.getAttribute("type"),
                    value: el.value?.slice(0, 30) ?? null,
                    disabled: el.disabled,
                }));
                return { expanded, ariaStates, overlays, controls, active: document.activeElement?.tagName.toLowerCase() ?? null };
            },
            id,
            WIDGET_STATE_JS,
        );

    const actions = await page.evaluate((caseId) => {
        const el = document.querySelector(`[data-case="${caseId}"]`);
        return el ? JSON.parse(el.getAttribute("data-actions") ?? "[]") : [];
    }, id);

    const trace = [{ step: "start", state: await stepState() }];
    for (const [index, action] of actions.entries()) {
        const freshSection = await page.$(`[data-case="${id}"]`);
        const target = action.target ? await freshSection.$(action.target) : freshSection;
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

    await page.screenshot({ path: `.design-compiler/base-ui-migration/captures/scoped-verify/shots/${id}.png` }).catch(() => {});
    await (await page.$(`[data-case="${id}"]`)).screenshot({ path: `.design-compiler/base-ui-migration/captures/scoped-verify/shots/${id}.png` }).catch(() => {});
    capture[id] = { static: staticState, slots, actions, actionTrace: trace, a11y: a11y[id] };
}

await browser.close();
writeFileSync(".design-compiler/base-ui-migration/captures/scoped-verify/capture.json", JSON.stringify(capture, null, 2));

// ---- compare against the React Aria baseline ------------------------------------------------
const baseline = JSON.parse(readFileSync(".design-compiler/base-ui-migration/captures/baseline/capture.json", "utf8"));
const a11yBaseline = JSON.parse(readFileSync(".design-compiler/base-ui-migration/a11y-baseline.json", "utf8"));
const failures = [];
const notes = [];
const sameSet = (a, b) => {
    const A = [...new Set(a)].sort();
    const B = [...new Set(b)].sort();
    return A.length === B.length && A.every((v, i) => v === B[i]);
};
const TOLERANCE = { geometry: 1, portalPlacement: 12 };

for (const id of CASE_IDS) {
    const base = baseline.cases[id];
    const cand = capture[id];
    if (cand.static.renderError) {
        failures.push({ case: id, class: "RENDER_ERROR", detail: cand.static.renderError });
        continue;
    }
    if (!sameSet(base.static.roles ?? [], cand.static.roles ?? [])) {
        notes.push({ case: id, class: "ROLE_ATTRIBUTE_DELTA", detail: `baseline=${JSON.stringify(base.static.roles)} candidate=${JSON.stringify(cand.static.roles)}` });
    }
    const sig = (state) => (state?.stateful ?? []).map((e) => `${e.role}:${e.checked}:${e.disabled}`).sort().join("|");
    if (sig(base.static) !== sig(cand.static)) {
        failures.push({ case: id, class: "CONTROLLED_STATE_FAILURE", detail: `baseline=[${sig(base.static)}] candidate=[${sig(cand.static)}]` });
    }
    const hiddenSig = (state) => (state?.controlState ?? []).filter((c) => c.hidden).map((c) => `${c.type}:${c.checked}:${c.disabled}`).join("|");
    if (hiddenSig(base.static) !== hiddenSig(cand.static)) {
        if (hiddenSig(base.static).length === 0 && hiddenSig(cand.static).length > 0) {
            notes.push({ case: id, class: "FORM_INTEGRATION_ADDED", detail: hiddenSig(cand.static) });
        } else {
            failures.push({ case: id, class: "FORM_SEMANTICS_FAILURE", detail: `hidden baseline=${hiddenSig(base.static)} candidate=${hiddenSig(cand.static)}` });
        }
    }
    const baseTrace = base.actionTrace ?? [];
    const candTrace = cand.actionTrace ?? [];
    if (baseTrace.length !== candTrace.length) {
        failures.push({ case: id, class: "EVENT_SEMANTICS_FAILURE", detail: `trace length baseline=${baseTrace.length} candidate=${candTrace.length}` });
    }
    for (let i = 1; i < Math.min(baseTrace.length, candTrace.length); i++) {
        const before = baseTrace[i];
        const after = candTrace[i];
        const b = (before.state?.ariaStates ?? []).join(",");
        const a = (after.state?.ariaStates ?? []).join(",");
        if (b !== a) failures.push({ case: id, class: "A11Y_STATE_FAILURE", detail: `${before.step}: baseline=${b} candidate=${a}` });
        const be = (before.state?.expanded ?? []).join(",");
        const ae = (after.state?.expanded ?? []).join(",");
        if (be !== ae) failures.push({ case: id, class: "POPUP_STATE_FAILURE", detail: `${before.step}: expanded baseline=${be} candidate=${ae}` });
        if (((before.state?.overlays ?? 0) > 0) !== ((after.state?.overlays ?? 0) > 0)) {
            failures.push({ case: id, class: "PORTAL_FAILURE", detail: `${before.step}: overlays baseline=${before.state?.overlays} candidate=${after.state?.overlays}` });
        }
    }
    const renderPortal = (p) => `${p.role}:${p.text}`;
    const bp = base.static.portals ?? [];
    const cp = cand.static.portals ?? [];
    if (!sameSet(bp.map(renderPortal), cp.map(renderPortal))) {
        failures.push({ case: id, class: "PORTAL_CONTENT_CHANGE", detail: `baseline=${JSON.stringify(bp.map(renderPortal))} candidate=${JSON.stringify(cp.map(renderPortal))}` });
    } else {
        for (const one of bp) {
            const other = cp.find((p) => renderPortal(p) === renderPortal(one));
            if (!other) continue;
            const dx = Math.abs((one.rect?.x ?? 0) - (other.rect?.x ?? 0));
            const dy = Math.abs((one.rect?.y ?? 0) - (other.rect?.y ?? 0));
            if (dx > TOLERANCE.portalPlacement || dy > TOLERANCE.portalPlacement) {
                notes.push({ case: id, class: "PORTAL_PLACEMENT_DELTA", detail: `${one.role} moved dx=${dx} dy=${dy}` });
            }
        }
    }
    for (const [selector, baseSlot] of Object.entries(base.static.slotMetrics ?? {})) {
        const candSlot = cand.static.slotMetrics?.[selector];
        if (baseSlot?.missing) continue;
        if (!candSlot || candSlot.missing) {
            failures.push({ case: id, class: "MISSING_SLOT", detail: selector });
            continue;
        }
        if (baseSlot.tag !== candSlot.tag) {
            notes.push({ case: id, class: "SLOT_TAG_DELTA", detail: `${selector}: ${baseSlot.tag} -> ${candSlot.tag}` });
        }
        for (const key of ["width", "height"]) {
            const delta = Math.abs((baseSlot.styles?.[key] ?? 0) - (candSlot.styles?.[key] ?? 0));
            if (delta > TOLERANCE.geometry) {
                failures.push({
                    case: id,
                    class: "VISUAL_FAILURE",
                    detail: `slot ${selector} ${key} baseline=${baseSlot.styles?.[key]} candidate=${candSlot.styles?.[key]} delta=${delta.toFixed(2)}`,
                });
            }
        }
        for (const key of ["color", "backgroundColor", "borderColor", "borderRadius", "fontFamily", "fontSize", "fontWeight", "lineHeight", "padding", "margin"]) {
            if (String(baseSlot.styles?.[key]) !== String(candSlot.styles?.[key])) {
                failures.push({
                    case: id,
                    class: "VISUAL_FAILURE",
                    detail: `slot ${selector} ${key} baseline=${baseSlot.styles?.[key]} candidate=${candSlot.styles?.[key]}`,
                });
            }
        }
    }
    const focusSig = (focusable) => (focusable ?? []).map((f) => `${f.tag}:${f.type}:${f.disabled}`).join(",");
    if (focusSig(base.static.focusable) !== focusSig(cand.static.focusable)) {
        notes.push({ case: id, class: "FOCUS_SURFACE_DELTA", detail: `baseline=${focusSig(base.static.focusable)} candidate=${focusSig(cand.static.focusable)}` });
    }
    // new axe violations only
    const baseRules = new Set((a11yBaseline.violations?.[id] ?? []).map((v) => v.rule));
    const added = (capture[id].a11y ?? []).filter((v) => !baseRules.has(v.rule));
    if (added.length) {
        failures.push({ case: id, class: "A11Y_REGRESSION", detail: added.map((v) => `${v.rule}(${v.impact}): ${v.nodes.join(" | ")}`).join(" ;; ") });
    }
}

writeFileSync(
    ".design-compiler/base-ui-migration/captures/scoped-verify/report.json",
    JSON.stringify({ failures, notes, consoleErrors }, null, 2),
);
console.log(JSON.stringify({ failures, notes, consoleErrors: consoleErrors.slice(0, 8), status: failures.length ? "FAIL" : "PASS" }, null, 2));
process.exit(failures.length ? 1 : 0);
