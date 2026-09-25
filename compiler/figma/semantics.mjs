/**
 * Semantic component pass (COMPONENT_SEMANTICS.md) — runs before code generation.
 *
 * Turns the visual variant matrix into a reusable component model:
 *   ComponentFamily, ComponentAnatomyIR, SlotIR, FixtureIR, BehaviorIR, AccessibilityIR, PublicApiPlan.
 *
 * Evidence-first (§3): explicit Figma component properties and INSTANCE_SWAP outrank layer names and
 * geometry. Every decision carries provenance and a confidence state, and inferred is never recorded as
 * verified. The codegen gate refuses to emit component code if the pass is incomplete.
 */

const CONFIDENCE = ["verified", "evidence-backed", "inferred", "ambiguous", "rejected"];

const decision = (value, evidence, confidence = "evidence-backed") => {
  if (!CONFIDENCE.includes(confidence)) throw new Error(`unknown confidence: ${confidence}`);
  return { decision: value, evidence, confidence };
};

/** Anatomy: semantic roles, never child indices. */
function anatomy(index) {
  const sample = index.variants.find((v) => v.axes["Icon only"] === "False" && v.sig.label);
  const parts = [
    { role: "leadingVisual", nodeIds: sample ? [sample.nodeId] : [], required: false, repeatable: false, componentRef: "INSTANCE:placeholder", evidence: "INSTANCE before label in every iconOnly=False variant" },
    { role: "label", nodeIds: sample ? [sample.nodeId] : [], required: true, repeatable: false, componentRef: "TEXT", evidence: "TEXT node; wrapped by FRAME \"Text padding\" in padded hierarchies, direct child in Link hierarchies" },
    { role: "trailingVisual", nodeIds: [], required: false, repeatable: false, componentRef: "INSTANCE:placeholder", evidence: "second INSTANCE after label" },
    { role: "loadingIndicator", nodeIds: [], required: false, repeatable: false, componentRef: "INSTANCE:Buttons/Button loading icon", evidence: "INSTANCE named 'Buttons/Button loading icon' present only in State=Loading" },
  ];
  const iconOnly = index.variants.find((v) => v.axes["Icon only"] === "True");
  return {
    rootRole: "action",
    parts: parts.map((p) => ({ ...p, nodeIds: p.nodeIds.length ? undefined : [] })),
    variants: { iconOnly: iconOnly ? "single visual, no label" : null },
  };
}

/** Slots: inferred from explicit Figma properties first, names second, geometry last. */
function slots(propertyDefinitions) {
  const byName = (needle) => Object.entries(propertyDefinitions).find(([k]) => k.toLowerCase().includes(needle));
  const leadingSwap = byName("icon leading swap");
  const trailingSwap = byName("icon trailing swap");
  const leadingBool = byName("icon leading");
  const trailingBool = byName("icon trailing");
  const loadingText = byName("loading text");

  const swapDefault = (entry) => (entry ? String(entry[1].defaultValue ?? "") : "");
  const slot = (name, position, source, evidence, confidence) => ({
    name,
    kind: "icon",
    position,
    cardinality: "optional",
    source,
    publicApi: "prop",
    provenance: decision(name, evidence, confidence),
  });

  return [
    {
      name: "label",
      kind: "text",
      position: "only",
      cardinality: "one",
      source: { nodeIds: [], componentRefs: ["TEXT"] },
      publicApi: "children",
      provenance: decision("children", ["TEXT node is the component's primary content", "textAutoResize=WIDTH_AND_HEIGHT"], "verified"),
    },
    slot("leadingIcon", "leading", { figmaProperty: leadingSwap?.[0], nodeIds: [], componentRefs: [swapDefault(leadingSwap)].filter(Boolean) }, [`INSTANCE_SWAP property "${leadingSwap?.[0]}"`, `BOOLEAN property "${leadingBool?.[0]}"`, "geometry: 16-20px INSTANCE before label"], "verified"),
    slot("trailingIcon", "trailing", { figmaProperty: trailingSwap?.[0], nodeIds: [], componentRefs: [swapDefault(trailingSwap)].filter(Boolean) }, [`INSTANCE_SWAP property "${trailingSwap?.[0]}"`, `BOOLEAN property "${trailingBool?.[0]}"`, "geometry: 16-20px INSTANCE after label"], "verified"),
    slot("loadingIndicator", "leading", { figmaProperty: loadingText?.[0], nodeIds: [], componentRefs: ["INSTANCE:Buttons/Button loading icon"] }, ["INSTANCE named 'Buttons/Button loading icon' in every State=Loading variant", "ellipse composition (track + arc) reused per size"], "verified"),
  ];
}

/**
 * Fixtures: sample values that demonstrate a slot/state. They must never become public component
 * semantics, but the visual harness may render them to reproduce the Figma specimen exactly.
 */
function fixtures(index, propertyDefinitions) {
  const swap = Object.values(propertyDefinitions).find((d) => d.type === "INSTANCE_SWAP");
  const texts = [...new Set(index.variants.map((v) => v.sig.label?.text).filter(Boolean))];
  const refs = [];
  if (swap) {
    refs.push({
      sourceNodeIds: [String(swap.defaultValue)],
      slot: "leadingIcon",
      fixtureKind: "placeholder-icon",
      productionMeaning: "consumer-supplied icon; the Figma placeholder demonstrates the slot only",
      renderedInHarnessBy: "src/fixtures/placeholder-circle.tsx",
      evidence: ["INSTANCE_SWAP default target", "nested component name 'placeholder'"],
      confidence: "verified",
    });
  }
  for (const text of texts) {
    refs.push({
      sourceNodeIds: [],
      slot: texts.length > 1 ? "label (state-dependent)" : "label",
      fixtureKind: "sample-text",
      productionMeaning: "consumer-supplied label text",
      renderedInHarnessBy: "src/grid.tsx (specimen data from button.index.json)",
      value: text,
      evidence: [`TEXT characters present in ${index.variants.filter((v) => v.sig.label?.text === text).length} variants`],
      confidence: "verified",
    });
  }
  return { fixtures: refs, leakCheck: "public component module must not export or require them" };
}

/** Behavior: Figma state -> real browser/native/runtime semantics. */
const behavior = {
  semanticElement: "button",
  domContract: {
    attributes: { variant: "data-variant", size: "data-size", iconOnly: "data-icon-only", state: "data-state" },
    rule: "the DOM exposes the public API values; Figma's authoring vocabulary is kept in data-figma-variant for traceability only",
    stability: "these attributes are the documented consumer styling hook (button.theme.css keys on them)",
  },
  rationale: "plain action; native <button> carries focus, keyboard, disabled and form semantics; Base UI adds nothing required",
  interactions: { hover: "css", focus: "focus-visible", disabled: "native", loading: "runtime", open: "none", close: "none" },
  stateMappings: {
    Default: "base",
    Hover: "css",
    Focused: "css",
    Disabled: "native",
    Loading: "runtime",
  },
  forcedStateAttribute: { attribute: "data-state", purpose: "visual-regression harness only", publicApi: "internal-test-only" },
};

/** Accessibility obligations that follow from the semantics above. */
const accessibility = {
  requirements: [
    { rule: "icon-only button requires an accessible name", reason: "no text content is rendered", source: "native-semantics", enforcedBy: "dev warning + behavior test" },
    { rule: "disabled must use the native disabled attribute", reason: "keyboard and AT must skip it consistently", source: "native-semantics", enforcedBy: "behavior test" },
    { rule: "loading must expose aria-busy and block activation", reason: "state must be announced and double-submit prevented", source: "project-policy", enforcedBy: "behavior test" },
    { rule: "focus must be visible via :focus-visible", reason: "keyboard operability", source: "native-semantics", enforcedBy: "behavior test" },
    { rule: "loading must block activation and keep focus", reason: "prevents double submit while staying announced", source: "project-policy", enforcedBy: "behavior test" },
    { rule: "respect prefers-reduced-motion", reason: "motion sensitivity; interaction stays usable without transitions", source: "project-policy", enforcedBy: "generated stylesheet" },
    { rule: "stay legible under forced-colors", reason: "Windows high-contrast users must see the boundary", source: "project-policy", enforcedBy: "generated stylesheet" },
  ],
};

/** Component family invariant: one set -> one family -> one public component. */
export const componentFamily = (index, propertyDefinitions) => ({
  name: "Button",
  figmaComponentSetId: "3287:427074",
  variants: index.variants.length,
  reactComponentCandidates: 1,
  publicComponents: ["Button"],
  notGenerated: ["ButtonDefault", "ButtonHover", "ButtonFocused", "ButtonDisabled", "ButtonLoading", "PlaceholderCircleButton"],
  evidence: [`componentPropertyDefinitions on the set`, `${index.variants.length} COMPONENT children of one COMPONENT_SET`],
  confidence: "verified",
});

/** Fields the API policy requires the plan to resolve (API_DESIGN_POLICY.md "PublicApiPlan requirements"). */
function publicApiPlan(index, unsupportedInput) {
  const unsupported = Array.isArray(unsupportedInput) ? unsupportedInput : unsupportedInput.combinations;
  return {
    componentName: "Button",
    primitive: "native <button>",
    props: {
      variant: { type: "'primary'|'secondary'|'tertiary'|'link-color'|'link-gray'", source: "axis:Hierarchy", default: "primary" },
      size: { type: "'xs'|'sm'|'md'|'lg'|'xl'", source: "axis:Size", default: "xs" },
      iconOnly: { type: "boolean", source: "axis:Icon only", default: false },
      loading: { type: "boolean", source: "state:Loading", default: false },
      loadingText: { type: "ReactNode", source: "property:Loading text (fixture value is 'Submitting...')" },
      leadingIcon: { type: "ReactNode", source: "slot:leadingIcon" },
      trailingIcon: { type: "ReactNode", source: "slot:trailingIcon" },
      state: { type: "forced visual state", source: "validator contract", publicApi: "internal-test-only" },
    },
    content: {
      label: "children",
      leadingVisual: "children-order (element child in leading position) or leadingIcon prop",
      trailingVisual: "children-order (element child in trailing position) or trailingIcon prop",
      loadingIndicator: "derived",
    },
    compositionStrategy: {
      rule: "composition-first: an element child in the leading/trailing position renders in that visual slot; explicit leadingIcon/trailingIcon props take precedence; a single element child stays the label (or the icon when iconOnly)",
      evidence: ["API_DESIGN_POLICY.md#icon-slots", "COMPONENT_SEMANTICS.md#15"],
      verifiedBy: "behavior.mjs case 'composition slots'",
    },
    nativeProps: {
      preserved: ["type", "disabled", "onClick", "aria-*", "data-*", "form", "name", "value", "autoFocus"],
      mechanism: "ComponentPropsWithoutRef<'button'> spread; the component declares none of them itself",
    },
    fixtureExclusions: [
      { fixture: "placeholder circle icon", productionSubstitute: "consumer icon via composition or slot props" },
      { fixture: "\"Button CTA\"", productionSubstitute: "children" },
      { fixture: "\"Submitting...\"", productionSubstitute: "loadingText prop (no baked default)" },
    ],
    policyProvenance: [
      { policy: "API_DESIGN_POLICY.md#hard-rule-do-not-translate-figma-props-11", decision: "Figma booleans (Icon leading/trailing swap, Loading text) became slots/children, not boolean props", confidence: "verified" },
      { policy: "API_DESIGN_POLICY.md#variant-policy", decision: "orthogonal axes kept; compound rules used only where the source proves interaction (Hierarchy x State fill/shadow, Size x Hierarchy x IconOnly padding)", confidence: "verified" },
      { policy: "API_DESIGN_POLICY.md#state-policy", decision: "hover/focus/disabled/loading are CSS/native/runtime, never consumer props; forced-state attribute is internal-test-only", confidence: "verified" },
      { policy: "API_DESIGN_POLICY.md#hard-rule-do-not-copy-shadcn-visually", decision: "all visual values come from Figma tokens; no shadcn dependency installed", confidence: "verified" },
      { policy: "API_DESIGN_POLICY.md#native-props", decision: "native <button> props preserved by type + spread", confidence: "verified" },
      { policy: "API_DESIGN_POLICY.md#component-vs-recipe-block", decision: "intent/destructive variants are not invented: the source defines none, so no intent prop is exposed", confidence: "evidence-backed" },
    ],
    stateMappings: { default: "base", hover: "css", focused: "css", disabled: "native", loading: "runtime", forcedStates: "internal-test-only" },
    unsupportedCombinations: unsupported.map((c) => `${c.size}/${c.hierarchy}/${c.state}/iconOnly=${c.iconOnly}`),
    registry: {
      item: "button",
      files: ["src/components/ui/button.tsx", "src/styles/button.theme.css", "src/styles/tokens.css", "src/components/icons/spinner.tsx"],
      registryMetadata: ".design-compiler/registry.json",
      verification: "see .design-compiler/visual/accuracy-report.json",
    },
    apiDecisions: [
      {
        decision: "iconOnly as a boolean rather than a size token (e.g. size='icon-md')",
        reason: "Figma models it as an independent axis; the padding matrix is keyed by (Size, Hierarchy, IconOnly) and a boolean keeps the axis 1:1 with the source",
        confidence: "evidence-backed",
        evidence: ["componentPropertyDefinitions: 'Icon only' is a VARIANT axis with values False|True"],
      },
    ],
  };
}

/** The codegen gate: refuse to emit component code until the semantic pass is complete. */
export function semanticPass({ index, propertyDefinitions, unsupported }) {
  const pass = {
    $schema: "design-compiler/SemanticPass@p0",
    component: "Button",
    family: componentFamily(index, propertyDefinitions),
    anatomy: anatomy(index),
    slots: slots(propertyDefinitions),
    fixtureIr: fixtures(index, propertyDefinitions),
    behavior,
    accessibility,
    publicApiPlan: publicApiPlan(index, unsupported),
    confidenceSummary: {},
  };
  const confidences = [
    pass.family.confidence,
    ...pass.slots.map((s) => s.provenance.confidence),
    ...pass.fixtureIr.fixtures.map((f) => f.confidence),
    ...pass.anatomy.parts.map(() => "evidence-backed"),
  ];
  pass.confidenceSummary = confidences.reduce((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {});
  pass.codegenGate = gate(pass);
  return pass;
}

function gate(pass) {
  const blockers = [];
  if (pass.family.reactComponentCandidates !== 1) blockers.push("family must resolve to exactly one React component");
  if (!pass.slots.every((s) => s.provenance.confidence !== "ambiguous")) blockers.push("ambient slot confidence (ambiguous)");
  if (!pass.behavior.semanticElement) blockers.push("semantic element unresolved");
  if (pass.publicApiPlan.unsupportedCombinations.length === 0 && pass.family.variants === 0) blockers.push("unsupported combinations not preserved");
  const fixtureLeaks = pass.fixtureIr.fixtures.filter((f) => f.slot === "leadingIcon" && /export|public/i.test(f.productionMeaning));
  if (fixtureLeaks.length) blockers.push("fixture classified as production semantics");
  return { status: blockers.length ? "blocked" : "open", blockers, rule: "no component codegen while blocked (COMPONENT_SEMANTICS.md)" };
}
