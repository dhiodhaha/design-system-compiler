# Component Semantics, Slots, Fixtures, and Public API

Pixel-perfect output is necessary, but it is not sufficient for a design-system compiler.

A compiler can reproduce a Figma matrix perfectly and still produce a poor design system if it treats placeholder icons, demo text, states, helper layers, or internal composition as literal public API.

## Core principle

Figma nodes describe a design artifact. The compiler must infer the reusable component model before generating the production API.

~~~text
Figma
↓
ComponentFamily
↓
Variant Matrix
↓
Slice Planner
↓
Representative Reads
↓
Visual Delta IR
↓
Semantic Component Pass
  ├── ComponentAnatomy
  ├── SlotIR
  ├── FixtureIR
  ├── BehaviorIR
  ├── AccessibilityIR
  └── PublicApiPlan
↓
Resolver
↓
React / CVA / Base UI / native HTML
↓
Semantic tests + visual tests
↓
VERIFIED
~~~

Code generation is blocked until the semantic pass is complete enough for the component.

## 1. Component anatomy

A component should be described by semantic roles, not child indices.

Bad:

~~~text
child 0
child 1
child 2
~~~

Better:

~~~text
Button
├── leadingVisual
├── label
└── trailingVisual
~~~

Suggested IR:

~~~ts
type ComponentAnatomyIR = {
  rootRole: string
  parts: Array<{
    role: string
    nodeIds: string[]
    required: boolean
    repeatable?: boolean
    componentRef?: string
  }>
}
~~~

## 2. Slot inference

Reusable components need slots.

~~~ts
type SlotIR = {
  name: string
  kind: "text" | "icon" | "avatar" | "media" | "content" | "control" | "indicator"
  position?: "leading" | "trailing" | "before" | "after" | "only"
  cardinality: "one" | "optional" | "many"
  source: {
    figmaProperty?: string
    nodeIds?: string[]
    componentRefs?: string[]
  }
  publicApi: "children" | "prop" | "compound-component" | "internal"
}
~~~

For a typical Button:

~~~text
leadingIcon  → optional icon slot
label        → primary content
trailingIcon → optional icon slot
spinner      → runtime indicator slot
~~~

The compiler may choose a composition-first public API even when Figma exposes boolean properties for those slots.

## 3. Evidence priority for slot inference

Do not ask an LLM to guess from pixels when Figma contains stronger evidence.

Use this priority:

1. explicit Figma component property definitions;
2. INSTANCE_SWAP properties;
3. BOOLEAN/TEXT component properties;
4. nested component identity/reference;
5. meaningful layer/component names;
6. stable child ordering around the primary text/content node;
7. geometry and size patterns;
8. learned project conventions;
9. typed semantic classifier;
10. Jev or human review when ambiguity remains.

Examples:

~~~text
INSTANCE_SWAP named "Leading icon"
→ very strong leading-icon evidence

16×16 nested instance named "placeholder" before label
→ likely icon fixture/slot, lower confidence

two circles around text with no semantic metadata
→ do not silently promote to production icon semantics
~~~

## 4. Fixture vs production semantics

A Figma fixture is a sample value used to demonstrate a slot or state. It is not automatically a production dependency.

Examples include placeholder icons, "Button CTA", sample avatars, sample images, lorem ipsum, and demo loading labels.

~~~ts
type FixtureIR = {
  sourceNodeIds: string[]
  slot: string
  fixtureKind:
    | "placeholder-icon"
    | "sample-text"
    | "sample-image"
    | "sample-avatar"
    | "test-content"
    | "other"
  productionMeaning: string
}
~~~

Hard rule:

> Never ship Figma placeholders, test fixtures, or implementation-only nodes as public component semantics unless the design system explicitly intends them to be part of the component.

A placeholder may still be rendered in the visual test harness to reproduce the Figma specimen exactly.

## 5. Behavior IR

A design-system component is more than styling.

~~~ts
type BehaviorIR = {
  semanticElement?: string
  interactions: {
    hover?: "css" | "runtime" | "none"
    focus?: "focus-visible" | "focus" | "runtime" | "none"
    disabled?: "native" | "aria" | "runtime" | "none"
    loading?: "runtime" | "none"
    open?: "runtime" | "primitive" | "none"
    close?: "runtime" | "primitive" | "none"
  }
}
~~~

For a normal Button:

~~~text
semanticElement → button
hover           → CSS
focus           → focus-visible
disabled        → native
loading         → runtime
~~~

For Tooltip, Dialog, Menu, Select, and similar components, behavior may map to Base UI or another verified primitive.

## 6. Accessibility IR

The compiler should record accessibility obligations that follow from component semantics.

~~~ts
type AccessibilityIR = {
  requirements: Array<{
    rule: string
    reason: string
    source: "native-semantics" | "primitive" | "figma-annotation" | "project-policy"
  }>
}
~~~

Examples:

~~~text
icon-only button → accessible name required
dialog           → focus management + labelled title requirements
tooltip          → trigger/content accessibility relationship
~~~

## 7. Public API synthesis

Figma properties are evidence, not the final React API.

Bad direct translation:

~~~tsx
<Button
  leadingIcon
  trailingIcon={false}
  iconOnly={false}
  state="hover"
/>
~~~

A more natural API might be:

~~~tsx
<Button variant="secondary" size="md">
  <PlusIcon />
  Add item
</Button>
~~~

or:

~~~tsx
<Button size="icon-md" aria-label="Settings">
  <SettingsIcon />
</Button>
~~~

Suggested plan:

~~~ts
type PublicApiPlan = {
  componentName: string
  primitive: string
  props: Record<string, unknown>
  content: Record<
    string,
    "children" | "children-order" | "prop" | "compound-component" | "derived" | "internal"
  >
  stateMappings: Record<
    string,
    "css" | "native" | "runtime" | "internal-test-only"
  >
  unsupportedCombinations: Array<Record<string, unknown>>
}
~~~

## 8. Button semantic example

~~~text
ComponentFamily: Button

visual axes
├── size
└── hierarchy

interaction/runtime states
├── default  → base
├── hover    → CSS :hover
├── focused  → CSS :focus-visible
├── disabled → native disabled
└── loading  → runtime loading

slots
├── leadingIcon
├── label
├── trailingIcon
└── loadingIndicator

fixtures
├── placeholder circle → generic icon fixture
└── "Button CTA"       → sample label

public component
└── Button
~~~

This must not become ButtonDefault, ButtonHover, ButtonFocused, ButtonDisabled, ButtonLoading, or PlaceholderCircleButton.

## 9. Icon position inference

When explicit property metadata exists, use it.

Otherwise deterministic fallback heuristics may use:

~~~text
icon-like child before primary text → leading slot candidate
icon-like child after primary text  → trailing slot candidate
single icon-like child, no label    → icon-only candidate
~~~

Icon-like evidence can include nested component references, INSTANCE_SWAP properties, common icon dimensions, vector content, and icon-like names.

Geometry alone is weak evidence and must not silently create a public API.

## 10. Loading semantics

Loading is usually a runtime state, not a CSS pseudo-state.

The compiler should determine from evidence or policy:

- whether the label changes;
- whether a spinner replaces or accompanies an icon;
- whether the control remains clickable;
- whether disabled semantics also apply;
- whether accessible busy state is required.

If the source does not answer a behavioral question, mark it unresolved rather than guessing.

## 11. Semantic verification

A component is not fully verified merely because its screenshot matches.

Semantic checks should include, where applicable:

- one Figma family maps to one canonical component;
- state mapping is sane;
- slot positions are recognized;
- fixtures do not leak into production API;
- nested known components remain reused;
- unsupported combinations remain unsupported;
- behavior maps to native/Base UI/runtime correctly;
- accessibility obligations are represented;
- public API is smaller and more semantic than the raw Figma matrix.

## 12. Semantic codegen gate

Before production codegen, require:

~~~text
ComponentFamily        ✅
Axis semantics         ✅
ComponentAnatomy       ✅
SlotIR                 ✅
BehaviorIR             ✅
AccessibilityIR        ✅ where applicable
Fixture classification ✅
PublicApiPlan          ✅
~~~

If a required semantic artifact is missing, stop code generation.

## 13. Model and Jev usage

Use deterministic evidence first.

A model may help when layer names are inconsistent, several slot models are plausible, or a design-only property may or may not belong in public API.

Jev is suitable when the remaining problem is a typed decision, for example:

~~~text
Icon only=True
→ composition?
→ size variant?
→ separate IconButton?
~~~

Implementation code remains the responsibility of deterministic generation or a coding model.

## 14. Final rule

> Visual fidelity proves that the browser can reproduce the specimen. Semantic fidelity proves that the result is actually a reusable design-system component.

A component reaches VERIFIED only when both forms of fidelity satisfy project requirements.


## 15. Shadcn-inspired API ergonomics

Use shadcn as a reference pattern for ergonomic, source-owned React components.

This means the compiler should prefer patterns such as:

~~~tsx
<Button variant="secondary" size="md">
  <PlusIcon />
  Add user
</Button>
~~~

over literal Figma-authoring APIs such as:

~~~tsx
<Button
  leadingIcon={true}
  trailingIcon={false}
  iconOnly={false}
  state="hover"
/>
~~~

The compiler must not copy shadcn appearance. All visual values still come from Figma/token IR.

For behavior, prefer native HTML when sufficient and Base UI when a richer accessible primitive is useful.

For distribution, prefer editable source and registry metadata rather than opaque generated binaries.

See [API_DESIGN_POLICY.md](./API_DESIGN_POLICY.md).
