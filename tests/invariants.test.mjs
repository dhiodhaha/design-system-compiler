/**
 * Deterministic invariant tests (ACCURACY_STRATEGY.md §5, COMPONENT_FAMILY_INVARIANTS.md).
 *
 *   node --test tests/
 *
 * These are cheap, browser-free guards over the compiled artifacts. A regression that breaks family
 * grouping, leaks a fixture into the public API, invents an unsupported combination, or hardcodes design
 * values into component code must fail here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const text = (p) => readFileSync(p, "utf8");

const index = read(".design-compiler/ir/button.index.json");
const semantics = read(".design-compiler/ir/button.semantics.json");
const unsupported = read(".design-compiler/ir/unsupported.json");
const manifest = read(".design-compiler/manifest.json");
// canonical registry (registry/index.json) + the official adopted item; the Figma reconstruction entry is
// retained separately as a benchmark and must never be canonical.
const registry = read(".design-compiler/registry/index.json");
const registryButton = read(".design-compiler/registry/button.json");
const benchmark = read(".design-compiler/registry/benchmark-figma-button.json");
const pkg = read("package.json");

test("family invariant: one component set resolves to one family and one public component", () => {
  assert.equal(semantics.family.figmaComponentSetId, "3287:427074");
  assert.equal(semantics.family.name, "Button");
  assert.equal(semantics.family.variants, index.count);
  assert.equal(semantics.family.variants, 200);
  assert.equal(semantics.family.reactComponentCandidates, 1);
  assert.deepEqual(semantics.family.publicComponents, ["Button"]);
});

test("state axes never become public components", () => {
  const forbidden = ["ButtonDefault", "ButtonHover", "ButtonFocused", "ButtonDisabled", "ButtonLoading"];
  for (const name of forbidden) assert.ok(semantics.family.notGenerated.includes(name));
  const buttonSrc = text("src/components/ui/button.tsx");
  for (const name of forbidden) assert.ok(!buttonSrc.includes(`export function ${name}`), `${name} must not be exported`);
});

test("fixtures are not production semantics", () => {
  const buttonSrc = text("src/components/ui/button.tsx");
  assert.ok(!/placeholder-circle/.test(buttonSrc), "the public component must not import the placeholder fixture");
  assert.ok(existsSync("src/fixtures/placeholder-circle.tsx"), "the fixture must exist for the visual harness");
  assert.match(text("src/fixtures/placeholder-circle.tsx"), /FIXTURE/);
  const placeholder = semantics.fixtureIr.fixtures.find((f) => f.fixtureKind === "placeholder-icon");
  assert.ok(placeholder, "placeholder icon must be classified as a fixture");
  assert.match(placeholder.productionMeaning, /consumer-supplied/);
});

test("sample texts are classified as fixtures, not semantics", () => {
  const sampleTexts = semantics.fixtureIr.fixtures.filter((f) => f.fixtureKind === "sample-text").map((f) => f.value);
  assert.deepEqual(sampleTexts.sort(), ["Button CTA", "Submitting..."]);
});

test("unsupported combinations are preserved, never invented", () => {
  assert.equal(unsupported.count, 50);
  for (const combo of unsupported.combinations) {
    assert.ok(["Link color", "Link gray"].includes(combo.hierarchy), "only Link hierarchies lack icon-only variants");
    assert.equal(combo.iconOnly, "True");
  }
  const buttonSrc = text("src/components/ui/button.tsx");
  assert.match(buttonSrc, /SUPPORTS_ICON_ONLY/);
  assert.ok(!/link-color":\s*true/.test(buttonSrc), "link-color must not claim icon-only support");
});

test("component code carries no raw design values", () => {
  // strip comments first: Figma property names legitimately contain things like "Loading text#8468:0"
  const buttonSrc = text("src/components/ui/button.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(buttonSrc), "no hex colours in component code (they belong to tokens/theme css)");
  assert.ok(!/rgba?\(|hsla?\(|oklch\(/.test(buttonSrc), "no colour functions in component code");
  assert.ok(!/\b\d+px\b/.test(buttonSrc), "no raw px in component code");
  assert.ok(buttonSrc.includes("data-variant") && buttonSrc.includes("data-size"));
});

test("semantic pass is complete enough for codegen", () => {
  assert.equal(semantics.codegenGate.status, "open", JSON.stringify(semantics.codegenGate.blockers));
  assert.equal(semantics.confidenceSummary.ambiguous ?? 0, 0);
  assert.equal(semantics.slots.length, 4);
  assert.equal(semantics.behavior.semanticElement, "button");
  assert.equal(semantics.behavior.interactions.disabled, "native");
  assert.ok(semantics.accessibility.requirements.some((r) => /accessible name/.test(r.rule)));
});

test("manifest records the verified evidence chain", () => {
  assert.equal(manifest.Button.status, "verified");
  assert.equal(manifest.Button.variantMatrix.status, "verified");
  assert.equal(manifest.Button.variantMatrix.supportedCount, 200);
  assert.equal(manifest.Button.variantMatrix.unsupportedCount, 50);
  assert.equal(manifest.Button.variantMatrix.rules.verified, true);
});

// ---------------------------------------------------------------------------------------------
// API_DESIGN_POLICY.md "API verification": a component API fails semantic verification if it ...
// ---------------------------------------------------------------------------------------------

const plan = semantics.publicApiPlan;
const buttonSrc = text("src/components/ui/button.tsx");
const srcWithoutComments = (p) => text(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("API: hover/focus are not consumer props", () => {
  assert.equal(plan.stateMappings.forcedStates, "internal-test-only");
  assert.equal(plan.stateMappings.hover, "css");
  assert.equal(plan.stateMappings.focused, "css");
  const props = Object.keys(plan.props);
  assert.ok(!props.includes("hover") && !props.includes("focused"), "hover/focus must not be props");
  assert.equal(plan.props.state.publicApi, "internal-test-only");
});

test("API: no Figma placeholder asset is hard-coded in the component", () => {
  assert.ok(!/placeholder/i.test(srcWithoutComments("src/components/ui/button.tsx")), "component code must not reference the placeholder fixture");
  assert.ok(plan.fixtureExclusions.length >= 3);
});

test("API: Figma booleans did not become React boolean props", () => {
  const booleanProps = Object.entries(plan.props).filter(([, v]) => v.type === "boolean").map(([k]) => k);
  assert.deepEqual(booleanProps.sort(), ["iconOnly", "loading"], "only real runtime/variant booleans may exist");
  assert.equal(plan.props.iconOnly.source, "axis:Icon only");
  assert.ok(!/leadingIcon\?\s*:\s*boolean/.test(buttonSrc), "icon slots must be ReactNode, not booleans");
});

test("API: native button props are preserved, not duplicated", () => {
  assert.ok(plan.nativeProps.preserved.includes("type") && plan.nativeProps.preserved.includes("disabled"));
  // mechanism may be WithRef or WithoutRef; the contract is that native button props come from React
  assert.match(buttonSrc, /ComponentPropsWith(?:out)?Ref<"button">/);
  const cleanSrc = srcWithoutComments("src/components/ui/button.tsx");
  const interfaceBody = cleanSrc.slice(cleanSrc.indexOf("interface ButtonProps"), cleanSrc.indexOf("}", cleanSrc.indexOf("interface ButtonProps")));
  for (const native of ["type?", "disabled?", "onClick?", "aria-"]) {
    assert.ok(!interfaceBody.includes(native), `ButtonProps must not redeclare ${native}`);
  }
});

test("API: no framework-specific code hides behaviour", () => {
  for (const p of ["src/components/ui/button.tsx", "src/components/icons/spinner.tsx"]) {
    const src = srcWithoutComments(p);
    assert.ok(!/from "next\//.test(src) && !/from "@tanstack\//.test(src), `${p} must stay framework-agnostic`);
  }
  assert.equal(registry.canonical, true, "registry/index.json must be the canonical index");
  assert.ok(registry.items.length > 100, `canonical index should carry the adopted library, got ${registry.items.length}`);
});

test("API: shadcn is a reference, not a dependency or a visual source", () => {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  assert.ok(!Object.keys(deps).some((d) => /shadcn|radix/.test(d)), "no shadcn/radix dependency");
  assert.equal(plan.policyProvenance.some((x) => /do-not-copy-shadcn-visually/.test(x.policy)), true);
  assert.match(registryButton.distribution.note, /MIT|provenance/i);
});

test("API: composition-first slots are documented, planned and typed", () => {
  assert.match(plan.compositionStrategy.rule, /composition-first/);
  assert.match(plan.content.leadingVisual, /children-order/);
  assert.ok(buttonSrc.includes("Children.toArray"), "component must implement the documented child-order rule");
  // precedence must be documented (props win over markers, markers win over child order)
  assert.match(buttonSrc, /Precedence: explicit props|props take precedence/i);
});

test("registry metadata declares the policy-required fields", () => {
  for (const field of ["files", "reference", "figma", "gates", "install"]) assert.ok(field in registryButton, `registry item missing ${field}`);
  assert.ok(registryButton.files.length > 0, "the canonical button item points at adopted files");
  assert.match(registryButton.files[0].path, /registry\/untitledui\/components\/base\/buttons\/button\.tsx/);
  assert.equal(benchmark.type, "COMPILER_RECONSTRUCTION_BENCHMARK");
  assert.equal(benchmark.canonicalItem, "registry/button.json");
  assert.ok(!registry.items.some((i) => /benchmark/.test(i.id)), "the benchmark must not be a registry item");
});

// ---------------------------------------------------------------------------------------------
// Production contract (the component must be shippable, not a matrix specimen)
// ---------------------------------------------------------------------------------------------

test("DOM contract exposes the public API, not Figma vocabulary", () => {
  const src = srcWithoutComments("src/components/ui/button.tsx");
  for (const attr of ["data-variant", "data-size", "data-icon-only"]) assert.ok(src.includes(attr), `${attr} missing`);
  assert.ok(!src.includes('data-hierarchy'), "Figma axis names must not leak into the DOM");
  assert.match(src, /data-figma-variant=\{FIGMA_VARIANT\[variant\]\}/, "traceability attribute expected");
  assert.ok(text("src/components/ui/button.abi.ts").includes("GENERATED"), "ABI must be generated");
});

test("styling contract and component agree", () => {
  const abi = text("src/components/ui/button.abi.ts");
  const css = text("src/styles/button.theme.css");
  for (const variant of ["primary", "secondary", "tertiary", "link-color", "link-gray"]) {
    assert.ok(abi.includes(`"${variant}"`), `${variant} missing from ABI`);
    assert.ok(css.includes(`[data-variant="${variant}"]`), `${variant} missing from generated CSS`);
  }
});

test("loading is a real runtime state (blocks activation, keeps focus, announced)", () => {
  const src = srcWithoutComments("src/components/ui/button.tsx");
  assert.match(src, /aria-busy/);
  assert.match(src, /aria-disabled/);
  assert.match(src, /interactive = !loading && !disabled/);
  assert.match(src, /event\.preventDefault\(\)/);
});

test("production hardening: dynamic dev checks, ref, motion and contrast support", () => {
  const src = srcWithoutComments("src/components/ui/button.tsx");
  assert.ok(!/import\.meta\.env/.test(src), "dev detection must be framework-agnostic");
  assert.match(src, /forwardRef<HTMLButtonElement/);
  const css = text("src/styles/button.theme.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(src, /VARIANTS\.includes\(variant\)/, "unknown variants must warn in dev");
});

test("shadcn-grade surface: icon sizes, explicit slots, buttonVariants, Spinner", () => {
  const src = text("src/components/ui/button.tsx");
  assert.match(src, /export function buttonVariants/, "buttonVariants helper required for anchors/Links");
  assert.match(src, /data-slot": "button"/, "data-slot=\"button\" convention expected");
  assert.match(src, /ButtonIconSize/, "icon sizes as size values expected");
  assert.match(src, /ButtonSpinnerIcon as Spinner/, "Spinner must be exported for composition");
  assert.match(src, /data-icon/, "shadcn data-icon slot markers expected");
  // the component must use the same contract it exports, so they cannot drift
  assert.match(src, /data-variant=\{variant\}/);
  assert.match(text("src/components/ui/button.abi.ts"), /ButtonVariant|VARIANTS/);
});

test("variant vocabulary comes from Figma, not shadcn", () => {
  const abi = text("src/components/ui/button.abi.ts");
  for (const shadcn of ["outline", "ghost", "destructive"]) {
    assert.ok(!new RegExp(`"${shadcn}"`).test(abi), `"${shadcn}" is shadcn vocabulary, not in the Figma set`);
  }
  for (const figma of ["primary", "secondary", "tertiary", "link-color", "link-gray"]) {
    assert.ok(abi.includes(`"${figma}"`), `${figma} missing`);
  }
});

test("generated styles are layered so consumer utilities can override", () => {
  const css = text("src/styles/button.theme.css");
  assert.match(css, /@layer components \{/, "theme rules must live in @layer components");
  assert.match(css, /padding-block: var\(--dsb-size-padding-block\)/, "logical padding expected for RTL");
  assert.match(css, /padding-inline: var\(--dsb-size-padding-inline\)/);
  assert.ok(!/\bpadding: var\(--dsb-size-padding\)/.test(css), "physical shorthand should be gone");
  const src = srcWithoutComments("src/components/ui/button.tsx");
  assert.ok(!/tailwind-merge|twMerge/.test(src), "no class-merge dependency needed while visuals are attribute-driven");
});
