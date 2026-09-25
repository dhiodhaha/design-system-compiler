#!/usr/bin/env node
/**
 * Variant slice compiler — the FIGMA_SLICING.md pipeline, deterministically.
 *
 *   node compiler/figma/compile.mjs
 *
 * Phase A  shallow index (cached batched read: every variant + children)
 * Phase B  axis classification
 * Phase C  base = verified golden specimen
 * Phase D/E representatives + VariantDelta
 * §8       rule mining (minimal determinant per property) + rule verification
 * §12      unsupported combination detection
 * §13      cache keys/hashes
 *
 * Outputs:
 *   .design-compiler/ir/button.index.json      compact per-variant signature index
 *   .design-compiler/ir/button.rules.json      mined rules + deltas + coverage
 *   .design-compiler/ir/unsupported.json       combinations Figma does not define
 *   .design-compiler/ir/deep-read-plan.json    observability: what was deep-read and why
 *   src/styles/button.theme.css                generated paint/structure matrix
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildIndex, pickRepresentatives, compileRules, mineRules, verifyRules, ruleSummary, axesKey, spinnerPaths } from "./variants.mjs";
import { emitThemeCss, unsupportedCombos } from "./emit.mjs";
import { semanticPass } from "./semantics.mjs";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const p = (rel) => `${ROOT}/${rel}`;
const read = (rel) => JSON.parse(readFileSync(p(rel), "utf8"));

const payload = read(".design-compiler/raw/figma-all-variants.json");
const variants = buildIndex(payload);

const axesValues = Object.fromEntries(["Size", "Hierarchy", "State", "Icon only"].map((axis) => [axis, [...new Set(variants.map((v) => v.axes[axis]))]]));
const base = variants.find((v) => axesKey(v.axes) === "xs/Primary/Default/False");
if (!base) throw new Error("verified base xs/Primary/Default/False missing from index");

const representatives = pickRepresentatives(variants, base);
const deltas = compileRules(representatives);
const rules = mineRules(variants);
const verification = verifyRules(variants, rules);
const unsupported = unsupportedCombos(variants, axesValues);

// The component-set *frame* is exported as the reference image, so its own paint must be reproduced by the
// visual harness (it is not part of the component): origin, size, background, inset border.
const setDoc = read(".design-compiler/raw/figma-button-set-shallow.json").data.nodes["3287:427074"].document;
const frame = {
  origin: { x: setDoc.absoluteBoundingBox.x, y: setDoc.absoluteBoundingBox.y },
  size: { w: setDoc.absoluteBoundingBox.width, h: setDoc.absoluteBoundingBox.height },
  background: setDoc.fills?.[0]?.color ? "#" + [setDoc.fills[0].color.r, setDoc.fills[0].color.g, setDoc.fills[0].color.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("") : null,
  border: setDoc.strokes?.[0]?.color ? "#" + [setDoc.strokes[0].color.r, setDoc.strokes[0].color.g, setDoc.strokes[0].color.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("") : null,
  borderWidth: setDoc.strokeWeight ?? 1,
  radius: setDoc.cornerRadius ?? 0,
};

// §13 cache: the index is keyed by file + node + payload hash
const payloadHash = readFileSync(p(".design-compiler/raw/figma-all-variants.json"), "utf8").length.toString(16);

// ---- §17 holdout validation: mine rules from the representatives only, then measure how well they
// generalise to the combinations that never participated in rule extraction.
const holdout = (() => {
  const repIds = new Set(representatives.map((r) => r.variant.nodeId));
  const train = variants.filter((v) => repIds.has(v.nodeId));
  const held = variants.filter((v) => !repIds.has(v.nodeId));
  const trainRules = mineRules(train);
  const check = verifyRules(held, trainRules);
  const byProperty = {};
  for (const f of check.failures) byProperty[f.property] = (byProperty[f.property] ?? 0) + 1;
  return {
    trainVariants: train.length,
    holdoutVariants: held.length,
    checks: check.checked,
    failures: check.failures.length,
    accuracy: +((1 - check.failures.length / Math.max(check.checked, 1)) * 100).toFixed(2),
    propertiesThatDoNotGeneralise: Object.entries(byProperty).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([property, count]) => ({ property, failedHoldouts: count })),
    shippedRules: "mined from all observed variants (maximum fidelity); holdout accuracy above is the generalisation measure, not the shipped accuracy",
  };
})();

// ---- adaptive sampling (§17): grow the training set until representative-mined rules generalise to the
// holdouts at the target accuracy, and record how many samples that took. Answers "is the rule family
// trustworthy, and how much of the matrix must actually be read to trust it".
const adaptiveTraining = (() => {
  const target = 99.5;
  let trainIds = new Set(representatives.map((r) => r.variant.nodeId));
  const history = [];
  for (let iteration = 1; iteration <= 10; iteration++) {
    const train = variants.filter((v) => trainIds.has(v.nodeId));
    const held = variants.filter((v) => !trainIds.has(v.nodeId));
    const rulesTrain = mineRules(train);
    const check = verifyRules(held, rulesTrain);
    const accuracy = +((1 - check.failures.length / Math.max(check.checked, 1)) * 100).toFixed(2);
    history.push({ iteration, samples: train.length, holdoutAccuracy: accuracy, failures: check.failures.length });
    if (accuracy >= target || held.length === 0) return { target, reached: accuracy >= target, samples: train.length, accuracy, history, extraSamplesNeeded: train.length - representatives.length };
    // add the holdouts that the current rules mispredict most (they carry the missing compound evidence)
    const failuresByVariant = new Map();
    for (const f of check.failures) failuresByVariant.set(f.axesKey, (failuresByVariant.get(f.axesKey) ?? 0) + 1);
    const add = [...failuresByVariant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
    const addIds = held.filter((v) => add.includes(axesKey(v.axes))).map((v) => v.nodeId);
    if (addIds.length === 0) return { target, reached: false, samples: train.length, accuracy, history, note: "no further discriminating samples" };
    addIds.forEach((id) => trainIds.add(id));
  }
  return { target, reached: false, samples: trainIds.size, accuracy: history[history.length - 1].holdoutAccuracy, history };
})();

const semantic = semanticPass({ index: { variants }, propertyDefinitions: read(".design-compiler/raw/figma-button-set-shallow.json").data.nodes["3287:427074"].document.componentPropertyDefinitions ?? {}, unsupported });

const deepReadPlan = {
  component: "Buttons/Button",
  base: { nodeId: base.nodeId, axesKey: axesKey(base.axes), reason: "verified golden specimen (visual + token conformance PASS)" },
  deepRead: representatives
    .filter((r) => r.kind !== "base")
    .map((r) => ({ nodeId: r.variant.nodeId, axesKey: axesKey(r.variant.axes), reason: `${r.kind} delta: ${r.axis}=${r.value}` })),
  policy:
    "One batched request covered all 200 variants at depth 3 (children included), so no per-representative fetch was needed. Outliers from rule mining (§9) were resolved from the same index instead of extra reads.",
  skipped: variants.length - representatives.length,
  requests: { batched: 1, perRepresentative: 0 },
};

mkdirSync(p(".design-compiler/ir"), { recursive: true });
writeFileSync(p(".design-compiler/ir/button.index.json"), JSON.stringify({ fileKey: "sLqnzw7tFXpuPA1TbQjsZx", payloadHash, axes: axesValues, frame, count: variants.length, variants }, null, 2));
writeFileSync(
  p(".design-compiler/ir/button.rules.json"),
  JSON.stringify(
    {
      base: axesKey(base.axes),
      classification: {
        Size: "public visual variant",
        Hierarchy: "public semantic variant (paint + structure)",
        State: "browser/CSS state: Default base, Hover=:hover, Focused=:focus-visible, Disabled=:disabled, Loading=aria-busy",
        "Icon only": "composition/API decision",
      },
      deltas: deltas.deltas,
      rules,
      summary: ruleSummary(rules),
      verification: { checkedProperties: verification.checked, failures: verification.failures.length, failuresDetail: verification.failures.slice(0, 20) },
    },
    null,
    2,
  ),
);
writeFileSync(p(".design-compiler/ir/unsupported.json"), JSON.stringify({ count: unsupported.length, combinations: unsupported }, null, 2));
writeFileSync(p(".design-compiler/ir/deep-read-plan.json"), JSON.stringify(deepReadPlan, null, 2));
writeFileSync(p(".design-compiler/ir/button.semantics.json"), JSON.stringify(semantic, null, 2));

// ---------------------------------------------------------------- registry item (API_DESIGN_POLICY.md "Registry policy")
const registry = {
  $schema: "design-compiler/registry@p0",
  name: "button",
  type: "design-system-component",
  title: "Button",
  figma: { componentSetId: "3287:427074", fileKey: "sLqnzw7tFXpuPA1TbqsjZx", variants: variants.length },
  files: [
    { path: "src/components/ui/button.tsx", role: "component" },
    { path: "src/components/ui/button.abi.ts", role: "generated-styling-contract" },
    { path: "src/styles/button.theme.css", role: "generated-rule-matrix" },
    { path: "src/styles/tokens.css", role: "generated-tokens" },
    { path: "src/components/icons/spinner.tsx", role: "generated-icon" },
  ],
  dependencies: {
    tokens: ["src/styles/tokens.css"],
    components: [],
    runtime: { react: ">=19" },
    optionalPrimitives: [],
    frameworkAdapters: [],
    frameworkAgnostic: true,
  },
  fixturesExcludedFromDistribution: ["src/fixtures/placeholder-circle.tsx"],
  unsupportedCombinations: unsupported.length,
  verification: {
    status: existsSync(p(".design-compiler/visual/accuracy-report.json")) ? read(".design-compiler/visual/accuracy-report.json").status : "unverified",
    report: ".design-compiler/visual/accuracy-report.json",
    visualGate: "perceptual < 1% (DPR1 and DPR2), geometry <= 1px",
    behavioralGate: "hover / focus-visible / disabled / loading / activation / accessible name",
    accessibilityGate: "axe-core WCAG A/AA, zero violations",
  },
  note: "Visual language comes from the compiled Figma design system; shadcn informs API ergonomics and source distribution only.",
};
// Benchmark registry entry (the canonical registry is produced by compiler/state/reconcile.mjs).
mkdirSync(p(".design-compiler/registry"), { recursive: true });
writeFileSync(p(".design-compiler/registry/benchmark-figma-button.generated.json"), JSON.stringify({ ...registry, type: "COMPILER_RECONSTRUCTION_BENCHMARK", canonical: false }, null, 2));
if (semantic.codegenGate.status === "blocked") {
  console.error("codegen gate BLOCKED:", semantic.codegenGate.blockers);
  process.exit(3);
}

// ---------------------------------------------------------------- component ABI (generated)
// The DOM contract the generated CSS keys on. Generated so the component and the stylesheet cannot drift,
// and so consumers get a documented, stable styling hook instead of Figma's authoring vocabulary.
const variantValues = axesValues.Hierarchy.map((h) => h.toLowerCase().replace(/ /g, "-"));
const abiTs = [
  "// GENERATED by compiler/figma/compile.mjs — the styling contract shared by button.tsx and button.theme.css.",
  "// Figma axis values are on the left for traceability; the DOM only ever sees the public API values.",
  "",
  "export type ButtonVariant = " + variantValues.map((v) => `"${v}"`).join(" | ") + ";",
  "export type ButtonSize = " + axesValues.Size.map((v) => `"${v}"`).join(" | ") + ";",
  "export type ButtonVisualState = " + axesValues.State.map((v) => `"${v.toLowerCase()}"`).join(" | ") + ";",
  "",
  "export const VARIANTS: ButtonVariant[] = " + JSON.stringify(variantValues) + ";",
  "export const SIZES: ButtonSize[] = " + JSON.stringify(axesValues.Size) + ";",
  "",
  "export const FIGMA_VARIANT: Record<ButtonVariant, string> = {",
  ...axesValues.Hierarchy.map((h) => `  "${h.toLowerCase().replace(/ /g, "-")}": "${h}",`),
  "};",
  "",
  "/** Combinations the Figma component set does not define: rejected in dev, never styled. */",
  "export const UNSUPPORTED: Array<{ variant: ButtonVariant; iconOnly: true }> = " +
    JSON.stringify(unsupported.filter((c) => c.iconOnly === "True").map((c) => ({ variant: c.hierarchy.toLowerCase().replace(/ /g, "-"), iconOnly: true })).filter((c, i, a) => a.findIndex((x) => x.variant === c.variant) === i)) +
    ";",
  "",
  "/** Variants that do define icon-only variants. */",
  "export const SUPPORTS_ICON_ONLY: ButtonVariant[] = " +
    JSON.stringify([...new Set(variants.filter((v) => v.axes["Icon only"] === "True").map((v) => v.axes.Hierarchy.toLowerCase().replace(/ /g, "-")))]) +
    ";",
  "",
].join("\n");
writeFileSync(p("src/components/ui/button.abi.ts"), abiTs);

// ---------------------------------------------------------------- spinner icon (normalised 16-unit slot)
const loadingVariant = variants.find((v) => axesKey(v.axes) === "xs/Primary/Loading/False");
const spinner = spinnerPaths(loadingVariant?.sig.icons.find((i) => i.kind === "spinner"));
// Figma keeps the spinner stroke an absolute width, so the normalised radius differs per size: compute the
// exact arc for every size instead of scaling one anchor (which drifts by ~0.25px at md+).
const spinnerBySize = Object.fromEntries(
  axesValues.Size.map((size) => {
    const loading = variants.find((v) => v.axes.Size === size && v.axes.Hierarchy === "Primary" && v.axes.State === "Loading" && v.axes["Icon only"] === "False");
    const parts = spinnerPaths(loading?.sig.icons.find((i) => i.kind === "spinner"));
    return [size, Object.fromEntries(parts.map((part) => [part.name, part.d]))];
  }),
);
const spinnerTsx = [
  "// GENERATED by compiler/figma/compile.mjs from the Figma loading variants' ellipse geometry.",
  "// Figma keeps the spinner stroke an absolute width, so the centreline radius differs per size; each size",
  "// carries its own normalised arc (16-unit slot). Colour and stroke width come from button.theme.css.",
  "// Do not edit by hand.",
  "import type { SVGProps } from \"react\";",
  "",
  "type SpinnerSize = \"xs\" | \"sm\" | \"md\" | \"lg\" | \"xl\";",
  "",
  "const PATHS: Record<SpinnerSize, { track: string; arc: string }> = {",
  ...Object.entries(spinnerBySize).map(([size, arcs]) => `  ${size}: { track: "${arcs.Background ?? ""}", arc: "${arcs.Line ?? ""}" },`),
  "};",
  "",
  "export function ButtonSpinnerIcon({ size = \"xs\", ...props }: SVGProps<SVGSVGElement> & { size?: SpinnerSize }) {",
  "  const path = PATHS[size] ?? PATHS.xs;",
  "  return (",
  "    <svg viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\" {...props}>",
  "      <path className=\"track\" d={path.track} />",
  "      <path className=\"arc\" d={path.arc} />",
  "    </svg>",
  "  );",
  "}",
  "",
].join("\n");

writeFileSync(p("src/components/icons/spinner.tsx"), spinnerTsx);

writeFileSync(
  p("src/styles/button.theme.css"),
  emitThemeCss({ rules, variants }),
);

// ---- merge into the manifest so verified knowledge is persisted, not conversational (§12, §14)
if (existsSync(p(".design-compiler/manifest.json"))) {
  const manifest = read(".design-compiler/manifest.json");
  const matrix = existsSync(p(".design-compiler/visual/matrix-report@2x.json")) ? read(".design-compiler/visual/matrix-report@2x.json") : null;
  manifest.Button.status = matrix && matrix.status === "PASS" ? "verified" : manifest.Button.status;
  manifest.Button.variantMatrix = {
    compiledAt: new Date().toISOString().slice(0, 10),
    axes: axesValues,
    supportedCount: variants.length,
    unsupportedCount: unsupported.length,
    unsupported: ".design-compiler/ir/unsupported.json",
    rules: { ...ruleSummary(rules), verified: verification.failures.length === 0 },
    holdout,
    adaptiveSampling: adaptiveTraining,
    representatives: representatives.map((r) => (r.kind === "base" ? `base:${axesKey(r.variant.axes)}` : `${r.axis}=${r.value}`)),
    visual: matrix ? { gate: "perceptual < 1%", dpr2: { perceptualPercent: matrix.whole.perceptual, geometryFailures: matrix.geometry.failures.length, outliers: matrix.visual.outlierCount } } : null,
    status: matrix && matrix.status === "PASS" ? "verified" : "candidate",
  };
  writeFileSync(p(".design-compiler/manifest.json"), JSON.stringify(manifest, null, 2));
}

console.log(
  JSON.stringify(
    {
      variants: variants.length,
      axes: axesValues,
      representatives: representatives.map((r) => (r.kind === "base" ? "base" : `${r.axis}=${r.value}`)),
      ruleSummary: ruleSummary(rules),
      ruleFailures: verification.failures.length,
      holdoutAccuracy: holdout.accuracy + "%",
      adaptiveSampling: `${adaptiveTraining.samples} samples -> ${adaptiveTraining.accuracy}% holdout (target ${adaptiveTraining.target}%, reached ${adaptiveTraining.reached})`,
      holdoutFailures: holdout.failures,
      semanticPass: { gate: semantic.codegenGate.status, slots: semantic.slots.map((x) => x.name), fixtures: semantic.fixtureIr.fixtures.length, confidences: semantic.confidenceSummary },
      unsupported: unsupported.length,
      generated: ["src/styles/button.theme.css", "src/components/ui/button.abi.ts", "src/components/icons/spinner.tsx", ".design-compiler/registry.json", ".design-compiler/ir/{button.index,button.rules,button.semantics,unsupported,deep-read-plan}.json"],
      spinnerPaths: spinner.map((x) => x.name),
    },
    null,
    2,
  ),
);
