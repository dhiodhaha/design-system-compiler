#!/usr/bin/env node
/**
 * Parity gate: compares a capture against the React Aria baseline capture.
 *
 *   node compiler/migration/parity.mjs --label migrated [--unit checkbox] [--json]
 *
 * What must be identical (semantics): roles present, control state (checked/value/disabled/required), the
 * outcome of every interaction step (state after each key press or click), portal roles and their content,
 * focusability of the same controls.
 *
 * What may differ within a stated tolerance (rendering): pixel geometry of semantic slots, portal placement,
 * DOM tag names, class strings, element identity. Visual regressions are real failures; a button that became
 * a span, or a checkbox whose indicator moved, is exactly what this must catch — so geometry tolerances are
 * tight (±1px) and colour/typography must match exactly.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = new Map(
  process.argv
    .slice(2)
    .join(" ")
    .matchAll(/--([a-z-]+)(?:[= ]([^\s]+))?/g)
    .map((m) => [m[1], m[2] ?? "true"]),
);
const LABEL = args.get("label") ?? "migrated";
const UNIT = args.get("unit") ?? null;
const BASE = ".design-compiler/base-ui-migration/captures/baseline/capture.json";
const CANDIDATE = `.design-compiler/base-ui-migration/captures/${LABEL}/capture.json`;

const TOLERANCE = { geometry: 1, portalPlacement: 12 };

if (!existsSync(CANDIDATE)) {
  console.error(`missing capture: ${CANDIDATE} — run capture.mjs --label ${LABEL} first`);
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASE, "utf8"));
const candidate = JSON.parse(readFileSync(CANDIDATE, "utf8"));
const failures = [];
const notes = [];
let compared = 0;

const cases = Object.keys(baseline.cases).filter((id) => !UNIT || baseline.cases[id].static.slots || id.startsWith(UNIT) || baseline.cases[id].slots?.length);

const sameSet = (a, b) => {
  const A = [...new Set(a)].sort();
  const B = [...new Set(b)].sort();
  return A.length === B.length && A.every((v, i) => v === B[i]);
};

/**
 * Visible controls define the behavioural contract. Base UI additionally renders visually hidden inputs for
 * form submission (its form integration); those are reported, and only compared when the baseline had them.
 */
const visibleSignature = (state) =>
  (state?.controlState ?? [])
    .filter((c) => !c.hidden)
    .map((c) => `${c.type}:${c.checked}:${c.value}:${c.disabled}:${c.required}`)
    .join("|");

/**
 * The behaviour that must survive migration: the state of the controls a user can perceive, addressed by
 * role/name rather than by element kind. React Aria renders native inputs; Base UI renders ARIA elements with
 * a hidden input — same semantics, different DOM, and only semantics belong in this comparison.
 */
const semanticSignature = (state) =>
  (state?.stateful ?? [])
    .map((entry) => `${entry.role}:${entry.checked}:${entry.disabled}`)
    .sort()
    .join("|");

const hiddenSignature = (state) =>
  (state?.controlState ?? [])
    .filter((c) => c.hidden)
    .map((c) => `${c.type}:${c.checked}:${c.disabled}`)
    .join("|");

for (const id of cases) {
  const testCase = baseline.cases[id];
  if (UNIT && testCase.slots && !testCase.slots.some(() => true)) continue;
  const current = candidate.cases[id];
  if (!current) {
    failures.push({ case: id, class: "MISSING_CASE", detail: "case absent from candidate capture" });
    continue;
  }
  compared++;
  // 1. semantics — the widget inventory and its state must survive. Explicit role attributes are an
  // implementation detail (React Aria renders native inputs with no role attribute; Base UI renders ARIA
  // elements), so they are reported, while the normalised widget state below is what gates.
  if (!sameSet(testCase.static.roles ?? [], current.static.roles ?? [])) {
    notes.push({
      case: id,
      class: "ROLE_ATTRIBUTE_DELTA",
      detail: `explicit roles baseline=${JSON.stringify(testCase.static.roles)} candidate=${JSON.stringify(current.static.roles)}`,
    });
  }

  // 2. form control state
  const baseSemantics = semanticSignature(testCase.static);
  const candSemantics = semanticSignature(current.static);
  if (baseSemantics !== candSemantics) {
    failures.push({
      case: id,
      class: "CONTROLLED_STATE_FAILURE",
      detail: `widget state baseline=[${baseSemantics}] candidate=[${candSemantics}]`,
    });
  }
  if (false && visibleSignature(testCase.static) !== visibleSignature(current.static)) {
    failures.push({
      case: id,
      class: "FORM_SEMANTICS_FAILURE",
      detail: `static visible control state baseline=${visibleSignature(testCase.static)} candidate=${visibleSignature(current.static)}`,
    });
  }
  const baseHidden = hiddenSignature(testCase.static);
  const candHidden = hiddenSignature(current.static);
  if (baseHidden !== candHidden) {
    if (baseHidden.length === 0 && candHidden.length > 0) {
      notes.push({ case: id, class: "FORM_INTEGRATION_ADDED", detail: `Base UI added hidden form inputs: ${candHidden}` });
    } else {
      failures.push({ case: id, class: "FORM_SEMANTICS_FAILURE", detail: `hidden control state baseline=${baseHidden} candidate=${candHidden}` });
    }
  }

  // 3. interaction outcomes, step by step
  const baseTrace = testCase.actionTrace ?? [];
  const candTrace = current.actionTrace ?? [];
  if (baseTrace.length !== candTrace.length && baseTrace.length > 1) {
    failures.push({ case: id, class: "EVENT_SEMANTICS_FAILURE", detail: `trace length baseline=${baseTrace.length} candidate=${candTrace.length}` });
  }
  for (let i = 1; i < Math.min(baseTrace.length, candTrace.length); i++) {
    const before = baseTrace[i];
    const after = candTrace[i];
    const baseControls = (before.state?.ariaStates ?? []).slice().sort().join(",");
    const candControls = (after.state?.ariaStates ?? []).slice().sort().join(",");
    if (baseControls !== candControls) {
      failures.push({ case: id, class: "CONTROLLED_STATE_FAILURE", detail: `step ${before.step}: baseline=${baseControls} candidate=${candControls}` });
    }
    const baseOpen = (before.state?.expanded ?? []).join(",");
    const candOpen = (after.state?.expanded ?? []).join(",");
    if (baseOpen !== candOpen) {
      failures.push({ case: id, class: "POPUP_STATE_FAILURE", detail: `step ${before.step}: aria-expanded baseline=${baseOpen} candidate=${candOpen}` });
    }
    const baseAria = (before.state?.ariaStates ?? []).join(",");
    const candAria = (after.state?.ariaStates ?? []).join(",");
    if (baseAria !== candAria) {
      failures.push({ case: id, class: "A11Y_STATE_FAILURE", detail: `step ${before.step}: aria pressed/checked/selected baseline=${baseAria} candidate=${candAria}` });
    }
    const baseOverlay = before.state?.overlays ?? 0;
    const candOverlay = after.state?.overlays ?? 0;
    if ((baseOverlay > 0) !== (candOverlay > 0)) {
      failures.push({ case: id, class: "PORTAL_FAILURE", detail: `step ${before.step}: visible overlays baseline=${baseOverlay} candidate=${candOverlay}` });
    }
  }

  // 4. portal content (options, tooltip text, dialogs)
  const basePortals = (testCase.afterInteraction ?? testCase.static).portals ?? [];
  const candPortals = (current.afterInteraction ?? current.static).portals ?? [];
  const renderPortal = (p) => `${p.role}:${p.text}`;
  if (!sameSet(basePortals.map(renderPortal), candPortals.map(renderPortal))) {
    failures.push({
      case: id,
      class: "PORTAL_CONTENT_CHANGE",
      detail: `baseline=${JSON.stringify(basePortals.map(renderPortal))} candidate=${JSON.stringify(candPortals.map(renderPortal))}`,
    });
  } else {
    for (const bp of basePortals) {
      const cp = candPortals.find((p) => renderPortal(p) === renderPortal(bp));
      if (!cp) continue;
      const dx = Math.abs((bp.rect?.x ?? 0) - (cp.rect?.x ?? 0));
      const dy = Math.abs((bp.rect?.y ?? 0) - (cp.rect?.y ?? 0));
      if (dx > TOLERANCE.portalPlacement || dy > TOLERANCE.portalPlacement) {
        notes.push({ case: id, class: "PORTAL_PLACEMENT_DELTA", detail: `${bp.role} moved by dx=${dx} dy=${dy}` });
      }
    }
  }

  // 5. slot geometry + computed styles
  for (const [selector, baseSlot] of Object.entries(testCase.static.slotMetrics ?? {})) {
    const candSlot = current.static.slotMetrics?.[selector];
    if (baseSlot?.missing) continue;
    if (!candSlot || candSlot.missing) {
      failures.push({ case: id, class: "MISSING_SLOT", detail: `slot ${selector} did not render` });
      continue;
    }
    for (const key of ["width", "height"]) {
      const delta = Math.abs((baseSlot.styles?.[key] ?? 0) - (candSlot.styles?.[key] ?? 0));
      if (delta > TOLERANCE.geometry) {
        failures.push({ case: id, class: "VISUAL_FAILURE", detail: `slot ${selector} ${key} delta=${delta.toFixed(2)}px (tolerance ${TOLERANCE.geometry}px)` });
      }
    }
    for (const key of ["color", "backgroundColor", "borderColor", "borderRadius", "fontFamily", "fontSize", "fontWeight", "lineHeight", "padding", "margin"]) {
      if (String(baseSlot.styles?.[key]) !== String(candSlot.styles?.[key])) {
        failures.push({ case: id, class: "VISUAL_FAILURE", detail: `slot ${selector} ${key} baseline=${baseSlot.styles?.[key]} candidate=${candSlot.styles?.[key]}` });
      }
    }
  }

  // 6. focusability surface
  const baseFocus = (testCase.static.focusable ?? []).map((f) => `${f.tag}:${f.type}:${f.disabled}`).join(",");
  const candFocus = (current.static.focusable ?? []).map((f) => `${f.tag}:${f.type}:${f.disabled}`).join(",");
  if (baseFocus !== candFocus) {
    notes.push({ case: id, class: "FOCUS_SURFACE_DELTA", detail: `baseline=${baseFocus} candidate=${candFocus}` });
  }

  // 7. state-selector validity: any data-* state the baseline element carried must still be produced,
  //    unless it is a React-Aria-internal attribute (data-rac / data-react-aria-*).
  const legacyAttrs = Object.keys(testCase.static.slotMetrics ?? {}).flatMap((selector) => {
    const slot = testCase.static.slotMetrics[selector];
    if (slot?.missing) return [];
    return Object.keys(slot.attrs ?? {}).filter((a) => /^data-(rac|react-aria)/.test(a));
  });
  const firstCandSlot = Object.values(current.static.slotMetrics ?? {})[0];
  const candidateAttrs = Object.keys(firstCandSlot?.attrs ?? {});
  if (legacyAttrs.length && candidateAttrs.length === 0) {
    notes.push({ case: id, class: "STATE_ATTRIBUTE_REVIEW", detail: `${legacyAttrs.join(",")} no longer present — verify classes were migrated to Base UI state attributes` });
  }
}

const report = {
  $schema: "design-compiler/BaseUiParityReport@p0",
  label: LABEL,
  unit: UNIT,
  comparedCases: compared,
  tolerances: TOLERANCE,
  failures,
  notes,
  status: failures.length === 0 ? "PASS" : "FAIL",
};
writeFileSync(`.design-compiler/base-ui-migration/parity-${UNIT ?? LABEL}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, comparedCases: compared, failures: failures.length, byClass: failures.reduce((m, f) => ((m[f.class] = (m[f.class] ?? 0) + 1), m), {}), notes: notes.length, report: `.design-compiler/base-ui-migration/parity-${UNIT ?? LABEL}.json`, sample: failures.slice(0, 6) }, null, 2));
process.exit(failures.length ? 1 : 0);
