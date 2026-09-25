/**
 * ComponentSetIndex + VariantDelta compiler (FIGMA_SLICING.md phases A–E, §7–§9).
 *
 * Consumes the cached batched read of every variant at depth 3 and produces, deterministically:
 *   - a compact per-variant signature index (no model context)
 *   - one-axis-at-a-time representative deltas against the verified base
 *   - compiled per-axis rules
 *   - a prediction of every supported combination, with outliers flagged
 *
 * Nothing here invents values: every number is read from the payload.
 */

const AXIS_ORDER = ["Size", "Hierarchy", "State", "Icon only"];

export const parseVariantName = (name) =>
  Object.fromEntries(
    name
      .split(",")
      .map((part) => part.split("=").map((s) => s.trim()))
      .filter(([k]) => k),
  );

export const axesKey = (axes) => AXIS_ORDER.map((a) => axes[a]).join("/");

const round = (n, p = 3) => (n === undefined || n === null ? null : +n.toFixed(p));
const box = (n) => (n?.absoluteBoundingBox ? { w: round(n.absoluteBoundingBox.width), h: round(n.absoluteBoundingBox.height) } : null);
const hexOf = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0").toUpperCase()).join("");
const colorCss = (c) => (c.a === 1 ? hexOf(c) : `rgba(${[c.r, c.g, c.b].map((v) => Math.round(v * 255)).join(", ")}, ${round(c.a)})`);
const solid = (n) => {
  const f = (n?.fills || []).find((x) => x.type === "SOLID" && x.visible !== false);
  return f ? colorCss(f.color) : null;
};
const stroke = (n) => {
  const s = (n?.strokes || []).find((x) => x.visible !== false);
  if (!s) return null;
  const base = { type: s.type, weight: round(n.strokeWeight) };
  if (s.type === "SOLID") return { ...base, color: colorCss(s.color) };
  if (s.type === "GRADIENT_LINEAR") return { ...base, stops: s.gradientStops.map((st) => ({ at: round(st.position), color: colorCss(st.color) })) };
  return base;
};
const shadows = (n) =>
  (n?.effects || [])
    .filter((e) => e.visible !== false && (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW"))
    .map((e) => `${e.type === "INNER_SHADOW" ? "inset " : ""}${e.offset?.x ?? 0}px ${e.offset?.y ?? 0}px ${e.radius ?? 0}px ${e.spread ?? 0}px ${colorCss(e.color)}`);

export const arcPath = (ellipse, radius, cx, cy) => {
  const { startingAngle = 0, endingAngle = 2 * Math.PI } = ellipse.arcData ?? {};
  const sweep = endingAngle - startingAngle;
  const r = round(radius);
  // A full circle cannot be expressed by one arc when start == end: SVG omits it and the shape disappears.
  // Figma stores full circles as 0 -> 2pi, so emit two half arcs instead.
  if (Math.abs(sweep) >= 2 * Math.PI - 1e-3) {
    return `M${round(cx + radius)} ${round(cy)}A${r} ${r} 0 1 1 ${round(cx - radius)} ${round(cy)}A${r} ${r} 0 1 1 ${round(cx + radius)} ${round(cy)}`;
  }
  const x1 = cx + radius * Math.cos(startingAngle);
  const y1 = cy + radius * Math.sin(startingAngle);
  const x2 = cx + radius * Math.cos(endingAngle);
  const y2 = cy + radius * Math.sin(endingAngle);
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M${round(x1)} ${round(y1)}A${r} ${r} 0 ${largeArc} 1 ${round(x2)} ${round(y2)}`;
};

/** Normalised (16-unit slot) spinner geometry from a loading variant's parts, so one SVG scales for every size. */
export const spinnerPaths = (slot) => {
  const slotW = slot?.box?.w ?? 16;
  const k = 16 / slotW;
  return (slot?.parts ?? []).map((part) => {
    const boxW = part.box?.w ?? 0;
    const stroke = (part.strokeWeight ?? 0) * k;
    const radius = (boxW / 2 - (part.strokeWeight ?? 0) / 2) * k;
    return { name: part.name, opacity: part.opacity ?? 1, strokeWidth: +stroke.toFixed(3), d: arcPath({ arcData: part.arcData ?? {} }, +radius.toFixed(3), 8, 8) };
  });
};

/** Compact, diffable signature of one variant subtree. */
export function signature(node) {
  const kids = node.children ?? [];
  const iconSlots = kids.filter((c) => c.type === "INSTANCE");
  const textPad = kids.find((c) => c.name === "Text padding");
  const textNode = (textPad ? (textPad.children ?? []) : kids).find((c) => c.type === "TEXT");
  const spinner = iconSlots.find((c) => /loading icon/i.test(c.name));

  const sig = {
    box: box(node),
    padding: node.paddingTop === undefined ? null : [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
    gap: node.itemSpacing ?? null,
    radius: node.cornerRadius ?? null,
    fill: solid(node),
    stroke: stroke(node),
    shadow: shadows(node).join(", ") || null,
    nodeOpacity: round(node.opacity ?? 1),
    labelWrapper: textPad ? "frame" : textNode ? "none" : null,
    labelWrapperPadding: textPad ? [textPad.paddingLeft ?? 0, textPad.paddingRight ?? 0] : null,
    // Figma stores range-level styling (e.g. link underline on hover) outside the node style, in a
    // character override table; capture only the properties that actually differ from the base style.
    labelOverrides: (() => {
      if (!textNode) return null;
      const base = textNode.style ?? {};
      const diff = [];
      for (const entry of Object.values(textNode.styleOverrideTable ?? {})) {
        for (const [k, v] of Object.entries(entry)) {
          if (k === "inheritTextStyleId" || k === "isOverrideOverTextStyle") continue;
          if (JSON.stringify(base[k]) !== JSON.stringify(v)) diff.push(`${k}=${v}`);
        }
      }
      return [...new Set(diff)].sort().join(";") || "NONE";
    })(),
    label: textNode
      ? {
          text: textNode.characters,
          box: box(textNode),
          fontFamily: textNode.style?.fontFamily ?? null,
          fontWeight: textNode.style?.fontWeight ?? null,
          fontSize: textNode.style?.fontSize ?? null,
          lineHeight: textNode.style?.lineHeightPx ?? null,
          letterSpacing: textNode.style?.letterSpacing ?? null,
          color: solid(textNode),
        }
      : null,
    icons: iconSlots.map((slot) => {
      const vector = (slot.children ?? [])[0] ?? null;
      const parts = (slot.children ?? []).map((p) => ({
        kind: p.type.toLowerCase(),
        name: p.name,
        box: box(p),
        opacity: round(p.opacity ?? 1),
        strokeWeight: round(p.strokeWeight ?? null),
        arcData: p.arcData ?? null,
      }));
      return {
        kind: /loading icon/i.test(slot.name) ? "spinner" : "placeholder",
        box: box(slot),
        opacity: round(slot.opacity ?? 1),
        strokeWeight: round(vector?.strokeWeight ?? null),
        color: solid(vector) ? null : (vector?.strokes ?? []).map((s) => colorCss(s.color))[0] ?? null,
        parts,
      };
    }),
  };
  if (spinner) {
    const bg = (spinner.children ?? []).find((c) => /background/i.test(c.name));
    const line = (spinner.children ?? []).find((c) => /line/i.test(c.name));
    const r = bg ? round(bg.absoluteBoundingBox.width / 2 - (bg.strokeWeight ?? 0) / 2) : null;
    sig.spinner = {
      box: box(spinner),
      opacity: round(spinner.opacity ?? 1),
      track: bg ? { opacity: round(bg.opacity ?? 1), strokeWeight: round(bg.strokeWeight), color: (bg.strokes ?? []).map((s) => colorCss(s.color))[0], d: arcPath(bg, r, round(bg.absoluteBoundingBox.width / 2), round(bg.absoluteBoundingBox.height / 2)) } : null,
      arc: line ? { opacity: round(line.opacity ?? 1), strokeWeight: round(line.strokeWeight), color: (line.strokes ?? []).map((s) => colorCss(s.color))[0], d: arcPath(line, r, round(line.absoluteBoundingBox.width / 2), round(line.absoluteBoundingBox.height / 2)) } : null,
    };
  }
  return sig;
}

/** Flatten a signature to property paths so deltas read like the spec's VariantDelta shape. */
const flatten = (obj, prefix = "") =>
  Object.entries(obj ?? {}).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) return [[path, null]];
    if (Array.isArray(v)) return v.length && typeof v[0] === "object" && !("x" in v[0]) ? v.flatMap((item, i) => flatten(item, `${path}[${i}]`)) : [[path, JSON.stringify(v)]];
    if (typeof v === "object") return flatten(v, path);
    return [[path, v]];
  });

export function delta(fromSig, toSig, fromKey, toKey) {
  const a = Object.fromEntries(flatten(fromSig));
  const b = Object.fromEntries(flatten(toSig));
  const changes = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const before = a[key] ?? null;
    const after = b[key] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ property: key, before, after });
  }
  return { from: fromKey, to: toKey, changes };
}

/** Build the index from the cached batched read. */
export function buildIndex(payload) {
  const variants = Object.entries(payload.data.nodes).map(([nodeId, { document }]) => ({
    nodeId,
    axes: parseVariantName(document.name),
    name: document.name,
    at: { x: round(document.absoluteBoundingBox.x, 2), y: round(document.absoluteBoundingBox.y, 2) },
    sig: signature(document),
  }));
  return variants.sort((a, b) => axesKey(a.axes).localeCompare(axesKey(b.axes)));
}

/** One-axis-at-a-time representatives (§5–§6). */
export function pickRepresentatives(variants, base) {
  const at = (axes) => variants.find((v) => axesKey(v.axes) === axesKey({ ...base.axes, ...axes }));
  const reps = [{ kind: "base", axes: base.axes, variant: base }];
  for (const size of ["sm", "md", "lg", "xl"]) {
    const v = at({ Size: size });
    if (v) reps.push({ kind: "size", axis: "Size", value: size, axes: v.axes, variant: v });
  }
  for (const h of ["Secondary", "Tertiary", "Link color", "Link gray"]) {
    const v = at({ Hierarchy: h });
    if (v) reps.push({ kind: "hierarchy", axis: "Hierarchy", value: h, axes: v.axes, variant: v });
  }
  for (const s of ["Hover", "Focused", "Disabled", "Loading"]) {
    const v = at({ State: s });
    if (v) reps.push({ kind: "state", axis: "State", value: s, axes: v.axes, variant: v });
  }
  const io = at({ "Icon only": "True" });
  if (io) reps.push({ kind: "iconOnly", axis: "Icon only", value: "True", axes: io.axes, variant: io });
  return reps;
}

/** Compile per-axis rules from representative deltas (§8). */
export function compileRules(reps) {
  const base = reps[0].variant.sig;
  const rules = { base: axesKey(reps[0].axes), byAxis: { Size: {}, Hierarchy: {}, State: {}, "Icon only": {} }, deltas: {} };
  for (const rep of reps.slice(1)) {
    const d = delta(base, rep.variant.sig, rules.base, axesKey(rep.axes));
    rules.deltas[axesKey(rep.axes)] = d;
    rules.byAxis[rep.axis][rep.value] = Object.fromEntries(d.changes.map((c) => [c.property, c.after]));
  }
  return rules;
}

/** Apply rules to predict a combination's signature (§9). */
export function predict(rules, axes) {
  const out = JSON.parse(JSON.stringify(rules.base !== undefined ? {} : {}));
  const patches = [rules.byAxis.Size[axes.Size], rules.byAxis.Hierarchy[axes.Hierarchy], rules.byAxis.State[axes.State], rules.byAxis["Icon only"][axes["Icon only"]]].filter(Boolean);
  // later, more specific axes win (Size < Hierarchy < State < Icon only), matching Figma's own override order
  const merged = Object.assign({}, ...patches);
  return { base: rules.base, mergeOrder: ["Size", "Hierarchy", "State", "Icon only"], patch: merged, combined: out };
}

/** Compare prediction-derived property values against the observed variant (§9 outlier detection). */
export function detectOutliers(variants, rules) {
  const checks = [];
  for (const v of variants) {
    const p = predict(rules, v.axes);
    const mismatches = [];
    for (const [property, expected] of Object.entries(p.patch)) {
      const observed = Object.fromEntries(flatten(v.sig))[property] ?? null;
      if (JSON.stringify(observed) !== JSON.stringify(expected)) mismatches.push({ property, ruleSays: expected, figmaSays: observed });
    }
    checks.push({ nodeId: v.nodeId, axesKey: axesKey(v.axes), predicted: Object.keys(p.patch).length, outliers: mismatches });
  }
  return checks;
}

// ---------------------------------------------------------------------------------------------
// Rule mining (§8 applied to interacting axes).
//
// Delta composition only works for axes that do not interact (54/200 variants here). For the rest,
// the observed index is already authoritative, so instead of deep-reading outliers we mine the
// *minimal determinant* of every property: the smallest axis subset whose values are a function of
// the property. 1 axis -> simple variant map, 2 axes -> compound rule, 3+ -> compound rule,
// undefined -> per-combination exception (recorded, never invented).
// ---------------------------------------------------------------------------------------------

const AXES = AXIS_ORDER;

/** Properties that are layout *consequences*, not authored rules (the browser derives them). */
const DERIVED = new Set(["box.w", "label.box.w"]);

const combinations = (arr, k) => (k === 0 ? [[]] : arr.flatMap((v, i) => combinations(arr.slice(i + 1), k - 1).map((c) => [v, ...c])));

/**
 * Smallest axis subset that explains a property, tolerating a small exception budget so that rules stay
 * compact: a 3-axis rule plus 6 recorded exceptions beats a 4-axis rule with 200 selector blocks.
 * Exceptions are always recorded and always verified — nothing is silently approximated.
 */
export function mineRules(variants, { exceptionBudget = Math.ceil(variants.length * 0.05) } = {}) {
  const flatAll = variants.map((v) => ({ axes: v.axes, flat: Object.fromEntries(flatten(v.sig)) }));
  const properties = [...new Set(flatAll.flatMap((v) => Object.keys(v.flat)))];

  const evaluate = (names, property) => {
    const seen = new Map();
    const exceptions = [];
    for (const { axes, flat } of flatAll) {
      const key = names.map((n) => axes[n]).join("|");
      const value = flat[property] ?? null;
      if (seen.has(key) && JSON.stringify(seen.get(key)) !== JSON.stringify(value)) {
        exceptions.push({ axes: AXIS_ORDER.map((a) => axes[a]).join("/"), value });
      } else if (!seen.has(key)) {
        seen.set(key, value);
      }
    }
    return { values: Object.fromEntries(seen), exceptions };
  };

  const mined = {};
  for (const property of properties) {
    if (DERIVED.has(property)) {
      mined[property] = { determinant: null, kind: "derived", note: "computed by layout, verified visually" };
      continue;
    }
    const candidates = [];
    for (let size = 1; size <= AXES.length; size++) {
      const subsets = combinations(AXES, size);
      if (!subsets.length) continue;
      const results = subsets.map((names) => ({ names, ...evaluate(names, property) }));
      results.sort((a, b) => a.exceptions.length - b.exceptions.length || a.names.join().localeCompare(b.names.join()));
      candidates.push(...results);
      if (results[0].exceptions.length === 0) break;
    }
    const best = candidates.find((c) => c.exceptions.length === 0) ?? candidates[0];
    const chosen = best.exceptions.length === 0 ? best : candidates.filter((c) => c.names.length <= best.names.length + 1 && c.exceptions.length <= exceptionBudget).sort((a, b) => a.names.length - b.names.length || a.exceptions.length - b.exceptions.length)[0] ?? best;
    mined[property] = {
      determinant: chosen.names,
      kind: chosen.exceptions.length === 0 ? (chosen.names.length === 1 ? "axis" : "compound") : "compound-with-exceptions",
      values: chosen.values,
      exceptions: chosen.exceptions,
    };
  }
  return mined;
}

/** How exactly the mined rules + recorded exceptions reproduce every observed variant (§9). */
export function verifyRules(variants, mined) {
  const flatAll = variants.map((v) => ({ variant: v, flat: Object.fromEntries(flatten(v.sig)) }));
  const failures = [];
  for (const { variant, flat } of flatAll) {
    for (const [property, rule] of Object.entries(mined)) {
      if (!rule.determinant || DERIVED.has(property)) continue;
      const key = rule.determinant.map((n) => variant.axes[n]).join("|");
      const axesPath = AXIS_ORDER.map((a) => variant.axes[a]).join("/");
      const exception = (rule.exceptions ?? []).find((e) => e.axes === axesPath);
      const predicted = exception ? exception.value : rule.values[key] ?? null;
      const observed = flat[property] ?? null;
      if (JSON.stringify(predicted) !== JSON.stringify(observed)) failures.push({ axesKey: axesKey(variant.axes), property, predicted, observed });
    }
  }
  return { checked: flatAll.length * Object.keys(mined).filter((p) => !DERIVED.has(p)).length, failures };
}

/** Axis/parameter summary useful for token + CSS emission. */
export function ruleSummary(mined) {
  const byKind = {};
  for (const [, rule] of Object.entries(mined)) byKind[rule.kind] = (byKind[rule.kind] ?? 0) + 1;
  return byKind;
}

