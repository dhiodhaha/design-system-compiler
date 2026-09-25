# Design System Compiler Architecture

## 1. Purpose

This project compiles a Figma design system into a reusable React design system.

It is not a screenshot-to-JSX generator. It is a compiler with persistent memory, deterministic slicing, semantic resolution, source reuse, and visual verification.

The desired long-term behavior is:

```text
first component/page
→ relatively expensive discovery

later components/pages
→ reuse known tokens
→ reuse known mappings
→ reuse verified components
→ inspect only unknown deltas
→ deterministic validation
→ progressively less AI
```

A mature project should require less model context and fewer model calls over time.

## 2. Non-goals

The compiler should not:

- create one React file per Figma variant;
- flatten known Figma component instances into arbitrary divs;
- infer missing designs that do not exist in Figma;
- convert every Figma property into a public React prop;
- ask an LLM to judge screenshots when exact code can measure the difference;
- depend on a single Figma transport;
- make framework-specific APIs part of the core component layer;
- require Jev or any LLM for deterministic work.

## 3. Source-of-truth order

When sources disagree, use this order:

1. verified explicit Figma component mapping;
2. authoritative local manifest;
3. Figma variables/styles/tokens;
4. existing verified component implementation;
5. existing verified composition;
6. deterministic inference;
7. typed ambiguity decision;
8. code-generation model;
9. human review.

Do not let old experience memory override authoritative current Figma or manifest data.

## 4. High-level architecture

```text
Figma
  ↓
transport adapter
  ↓
cheap discovery / ComponentSetIndex
  ↓
Slice Planner
  ↓
representative node reads
  ↓
Design System IR
  ↓
Semantic Resolver
  ├── reuse existing component
  ├── extend existing variants
  ├── compose existing components
  ├── map to Base UI/native primitive
  └── create new component as last resort
  ↓
React implementation
  ↓
Playwright render
  ↓
geometry/computed-style checks
  ↓
pixel/SSIM diff
  ↓
targeted repair only
  ↓
verified manifest + cache + experience memory
```

## 5. Recommended implementation stack

```text
React
TypeScript
Base UI
Tailwind CSS 4
CVA
Zod
Playwright
pixelmatch and/or SSIM
Figma REST / Figma MCP adapters
Codex / DeepSeek for implementation work
Jev only for ambiguous typed decisions
```

The stack is a recommendation, not a hard coupling. The compiler core should keep transport, framework adapters, model providers, and visual validators behind interfaces.

## 6. Figma transport abstraction

The compiler must normalize all Figma access into one internal representation.

Possible transports:

- direct Figma REST API;
- native Figma Dev Mode MCP;
- a broker such as Composio;
- a future plugin-side extractor.

The compiler must not care which transport produced the raw data.

```text
REST ──────────┐
Native MCP ────┼──> FigmaAdapter ──> canonical raw cache ──> normalizer
Broker ────────┤
Plugin bridge ─┘
```

### Transport requirements

The adapter should support, where available:

- file/node reads;
- component/component-set metadata;
- variables/styles;
- raster reference export;
- SVG/vector reference export;
- prototype/motion metadata;
- stable node/component identifiers.

Cache raw responses. Do not repeatedly fetch immutable or unchanged source data.

## 7. Design System IR

The IR is the boundary between Figma retrieval and implementation.

### 7.1 ComponentSetIndex

A compact index used before deep reads.

```ts
type ComponentSetIndex = {
  componentSetId: string
  componentKey?: string
  name: string
  axes: Record<string, string[]>
  variants: Array<{
    nodeId: string
    props: Record<string, string | boolean | number>
    width?: number
    height?: number
    shallowSignature?: string
  }>
}
```

The index must be small enough to pass between agents without dumping a full Figma subtree.

### 7.2 DesignAssetKind

A Figma component is not automatically a React component.

```ts
type DesignAssetKind =
  | "primitive"
  | "component"
  | "composition"
  | "recipe"
  | "example"
  | "page"
```

Examples:

- Button → component
- Tooltip behavior → primitive-backed component
- Dialog shell → primitive-backed component
- Payment details modal → recipe/composition
- marketing screen → page/example

### 7.3 TokenIR

```ts
type TokenIR = {
  id: string
  name: string
  category: "color" | "spacing" | "radius" | "font" | "shadow" | "blur" | "motion" | "other"
  value: unknown
  aliasOf?: string
  modes?: Record<string, unknown>
}
```

Prefer token references over raw values when the source provides them.

### 7.4 ComponentIR

```ts
type ComponentIR = {
  id: string
  componentKey?: string
  name: string
  kind: DesignAssetKind
  anatomy: Array<{
    role: string
    nodeId?: string
    componentRef?: string
  }>
  variantAxes: Record<string, string[]>
  supportedCombinations?: Array<Record<string, string | boolean>>
  dependencies: string[]
  tokens: string[]
}
```

### 7.5 VariantDelta

A verified base should be extended through deltas.

```ts
type VariantDelta = {
  from: string
  to: string
  changes: Array<{
    property: string
    before: unknown
    after: unknown
    source?: string
  }>
}
```

Example:

```json
{
  "from": "md.primary.default",
  "to": "md.primary.hover",
  "changes": [
    {
      "property": "background",
      "before": "Brand/600",
      "after": "Brand/700"
    }
  ]
}
```

### 7.6 MotionIR

Motion is first-class but must not be invented from a static frame.

```ts
type MotionIR = {
  trigger:
    | "hover"
    | "press"
    | "focus"
    | "open"
    | "close"
    | "enter"
    | "exit"
    | "scroll"
    | "route-change"
  properties: string[]
  durationMs?: number
  delayMs?: number
  easing?: string
  transitionType:
    | "instant"
    | "css-transition"
    | "keyframes"
    | "spring"
    | "layout"
  source:
    | "figma-prototype"
    | "annotation"
    | "reference-library"
    | "explicit-spec"
    | "existing-component"
  confidence?: number
}
```

## 8. Figma variant is not always a React prop

This is a core rule.

A Figma component set can use variants for visual states, implementation convenience, examples, or semantically different compositions.

Examples:

```text
Figma State=Hover
→ CSS :hover

Figma State=Focused
→ :focus-visible when semantically correct

Figma State=Disabled
→ native disabled + CSS state

Figma State=Loading
→ runtime prop/state

Figma Type=Payment details on a giant Modal set
→ probably a recipe, not <Modal type="payment-details">
```

Before code generation, classify each Figma axis as one of:

- public React variant;
- browser/CSS interaction state;
- runtime prop/state;
- composition decision;
- internal design-only dimension;
- unsupported combination constraint.

## 9. Semantic decomposition

Large Figma sets must be decomposed before implementation.

Bad:

```tsx
<Modal type="payment-details-with-image" />
```

Preferred:

```text
Dialog primitive
├── DialogOverlay
├── DialogContent
├── DialogHeader
├── DialogTitle
├── DialogDescription
├── DialogClose
└── DialogActions

recipes
├── PaymentDetailsDialog
├── InviteUserDialog
└── TwoFactorDialog
```

Use existing component instances as evidence for reuse. If a Figma Modal contains Button instances, the implementation should normally reuse Button instead of flattening it.

## 10. Resolver priority

For each unresolved design asset:

1. exact verified manifest mapping;
2. existing verified local registry component;
3. existing verified variant;
4. composition of existing design-system components;
5. existing Base UI primitive;
6. native HTML primitive;
7. custom primitive/new component as last resort.

A new component requires evidence that reuse/composition is insufficient.

## 11. Base UI boundary

Base UI owns behavior where useful:

- accessibility behavior;
- keyboard interactions;
- focus management;
- popup behavior;
- selection behavior;
- interaction state.

Our design system owns:

- public API;
- tokens;
- styling;
- variants;
- composition;
- brand;
- Figma mapping.

The compiler owns:

- discovery;
- slicing;
- semantic classification;
- generation;
- reuse;
- validation;
- memory.

Use native HTML when it is sufficient. For a normal Button, a native `<button>` can be the correct primitive.

## 12. Component API rules

Prefer a small orthogonal API.

Good direction:

```tsx
<Button variant="secondary" intent="danger" size="lg" loading>
  Delete project
</Button>
```

Avoid encoding every Figma permutation as a variant name:

```text
primary
primaryDanger
secondary
secondaryDanger
secondaryDangerHover
...
```

Use CVA/compound variants or equivalent rule composition when axes interact.

For icon-only controls, choose among composition, an icon size variant, or a dedicated semantic component based on evidence. Do not add boolean props merely because Figma has a boolean axis.

## 13. Supported combinations

If Figma does not contain a combination, the compiler must not invent it by default.

Store supported combinations explicitly when needed:

```json
{
  "supported": [
    {"variant":"primary","iconOnly":true},
    {"variant":"link-color","iconOnly":false}
  ]
}
```

Types or runtime validation may prevent unsupported combinations.

## 14. Token strategy

Canonical flow:

```text
Figma variables/styles
      ↓
TokenIR
      ↓
canonical tokens
      ↓
CSS variables
      ↓
Tailwind CSS 4 / component styles
```

Do not repeatedly ask models to translate stable token names or values.

Cache token hashes. Refresh only when the source changes.

## 15. Token-efficient Figma slicing

Never deep-read a giant component set by default.

Preferred flow:

```text
component-set URL
      ↓
shallow discovery
      ↓
ComponentSetIndex
      ↓
axis classification
      ↓
representative selection
      ↓
DeepReadPlan
      ↓
deep-read selected nodes only
      ↓
delta extraction
```

Use one-axis-at-a-time representatives where possible.

Example base:

```text
md / Primary / Default / iconOnly=false
```

Then isolate dimensions:

```text
lg / Primary / Default / false
→ size delta

md / Secondary / Default / false
→ hierarchy delta

md / Primary / Hover / false
→ state delta
```

After rules are learned, render the entire supported matrix deterministically. Full-matrix rendering should not require LLM calls.

See [FIGMA_SLICING.md](./FIGMA_SLICING.md).

## 16. Visual verification

LLMs are not the primary visual validator.

Use:

- Playwright/browser screenshot;
- fixed browser/version;
- fixed viewport;
- fixed device pixel ratio;
- `document.fonts.ready`;
- animations/transitions disabled for static checks;
- frozen random/date/test data where relevant;
- DOM geometry and computed-style checks;
- pixel diff and/or SSIM;
- mismatch bounding regions.

Suggested practical thresholds:

- geometry: <= 1 px;
- spacing: <= 1 px;
- token-backed colors: exact;
- typography: exact family/size/weight/line-height/letter-spacing;
- component dimensions: <= 1 px;
- overall visual mismatch: project-defined, commonly below 0.5–1%;
- critical layout mismatch: zero.

Literal zero pixel difference is not always realistic because of browser/font rasterization.

### Repair loop

```text
target
vs
actual
↓
diagnostic diff
↓
identify responsible property/region
↓
patch only that rule
↓
rerun
```

Bound retries, for example 3–5 attempts, and stop on stagnation.

Annotate generated elements with stable identifiers such as `data-ds` or `data-figma-node` to map mismatch regions back to code.

## 17. Verification status

Verification is not binary for a component with many axes.

Example:

```json
{
  "component": "Button",
  "status": "partial",
  "verified": {
    "primary": true,
    "secondary": false,
    "tertiary": false,
    "link-color": false,
    "link-gray": false,
    "destructive": false
  }
}
```

Only mark a component fully verified when its declared supported matrix has passed the project coverage requirement.

## 18. Persistent memory

Use three memory layers.

### 18.1 Authoritative memory

- manifest;
- tokens;
- component mappings;
- verified components;
- supported combinations;
- verified motion rules;
- framework constraints.

### 18.2 Build memory

- source hashes;
- raw Figma cache;
- normalized IR;
- dependency graph;
- build outputs;
- visual baselines;
- validation reports.

### 18.3 Experience memory

- successful fixes;
- rejected mappings;
- known rendering quirks;
- endpoint/transport lessons;
- common mistakes;
- previous semantic decisions.

Authoritative memory always wins.

### Negative memory

Store rejected decisions so the compiler does not repeat them.

```json
{
  "candidate": "IconButton",
  "decision": "rejected",
  "reason": "duplicates verified Button icon-only behavior",
  "replacement": "Button"
}
```

## 19. Jev

Jev is a typed ambiguity layer, not a code generator.

Decision rule:

```text
Can exact code decide?
→ exact code

Can manifest decide?
→ manifest

Can structural comparison decide?
→ comparison

Still ambiguous?
→ Jev

Needs implementation?
→ coding model
```

Good Jev use cases:

- whether a Figma axis should become a public prop, composition, or separate component;
- reuse vs extend vs create when structural evidence is genuinely ambiguous;
- primitive/component/recipe/example classification;
- borderline real-mismatch vs rendering-noise classification;
- routing a task to deterministic fixer, cheap model, strong model, or human review.

Do not call Jev simply because an API key exists.

## 20. OMP and subagents

Subagents are useful for context isolation, not because more agents are automatically better.

Recommended workers:

```text
Lead
├── Figma Scout
├── Variant/API Planner
├── Implementer
└── Validator
```

Persist compact artifacts between workers.

Good:

```text
Figma Scout
→ button-ir.json
→ Planner
```

Bad:

```text
Figma Scout 40k-token transcript
→ forwarded to every other agent
```

Each subagent receives only:

- its task;
- required skill instructions;
- relevant files;
- relevant IR;
- relevant Figma nodes.

## 21. Framework portability

Core design-system code must not directly depend on:

- `next/*`;
- `@tanstack/react-router`;
- `@tanstack/start`;
- framework server APIs;
- framework-specific image/navigation APIs.

Framework behavior belongs in consumer composition or adapters.

Target consumers:

- TanStack Start;
- Next.js;
- Vite React;
- React Router.

## 22. Source distribution

The preferred distribution model is shadcn-like source ownership.

Future conceptual UX:

```bash
npx ds-compiler add button
npx ds-compiler add card
npx ds-compiler add dialog
```

The consumer receives editable source rather than an opaque component implementation.

Reusable DS primitives/components belong in the registry. App-specific screens and recipes should normally remain blocks/examples unless deliberately promoted.

## 23. Motion

Do not infer decorative motion from static screenshots.

Resolution order:

1. existing verified component motion;
2. project motion token;
3. explicit Figma prototype/reaction/annotation;
4. existing DS motion pattern;
5. conservative default/no motion.

Prefer:

1. CSS transitions;
2. CSS keyframes;
3. existing motion utilities;
4. a motion library only when required.

Static visual verification and motion verification are separate concerns.

## 24. Metrics

Track:

- reuse rate;
- new component rate;
- design-token coverage;
- motion reuse rate;
- cache hit rate;
- visual convergence;
- deterministic fix rate;
- AI fix rate;
- tokens per compile;
- tokens per new component;
- Figma requests per component;
- unsupported-combination count;
- representative coverage;
- full matrix pass rate.

The architecture is succeeding when later compiles reuse more and require less AI.

## 25. Suggested monorepo direction

```text
packages/
  design-ir/
  compiler/
  figma/
  registry/
  ui/
  adapters/
    next/
    tanstack/
  visual-validator/
  cli/
  mcp/
apps/
  playground-vite/
  playground-next/
  playground-tanstack/
```

This is a direction, not a required initial layout.

## 26. Milestones

### P0 — one golden component

- one exact Figma specimen;
- one reusable React component;
- token-backed styling;
- deterministic screenshot pipeline;
- pixel/geometry diagnostics;
- no unnecessary Base UI or Jev.

### P1 — complete core Button family

- shallow component-set indexing;
- automatic representative slicing;
- CVA rule expansion;
- browser states;
- loading;
- icon-only;
- supported-combination model;
- representative and full-matrix verification.

### P2 — semantic extension

Use a related set such as destructive Button to prove:

- reuse vs new component decision;
- intent/compound variants;
- Jev only if truly ambiguous.

### P3 — Input

Prove that Figma `Type` values can be split into component, behavior, composition, and recipe rather than creating a monster API.

### P4 — Tooltip/Dialog

Prove Base UI primitive integration while preserving visual source-of-truth in the DS.

### P5 — registry/source distribution

Build source-owned installation.

### P6 — CLI/npx

Make deterministic compiler operations usable without an agent.

### P7 — MCP

Expose the same compiler core as agent tools.

### P8 — motion

Add MotionIR and prototype/annotation-driven behavior.

## 27. Final thesis

The compiler should gradually transform a design file from unknown visual data into a known, verified, reusable graph.

At the beginning, AI helps discover and implement.

Later, the compiler should mostly:

- look up;
- slice;
- compare;
- reuse;
- compose;
- verify.

The best mature run is often the one where no model call was necessary.


## 28. Hard Component Family Invariant

This section is normative.

All child variants inside one Figma component set belong to one `ComponentFamily` by default. They must not independently create public React components.

The compiler must perform this sequence before code generation:

```text
Figma component set
→ ComponentFamily
→ enumerate variants
→ classify every axis/state
→ persist family mapping
→ choose representative slices
→ compile deltas/rules
→ codegen
```

Code generation is forbidden when the family has not been normalized or when axes are still unclassified.

For a typical Button:

```text
Default  → base
Hover    → CSS :hover
Focused  → CSS :focus-visible
Disabled → native disabled state
Loading  → runtime loading state
Size     → public size variant
Hierarchy→ public variant/hierarchy
```

Therefore Default/Hover/Focused/Disabled/Loading are evidence for one Button family's behavior; they are not five different Buttons.

Once a mapping exists:

```text
Figma componentSetId → canonical React component
```

all child nodes of that component set resolve to that canonical component unless an explicit reviewed exception exists.

Different component sets are not automatically merged. Related sets such as `Buttons/Button` and `Buttons/Button destructive` require structural/semantic comparison first.

The compiler must include a regression test proving that a component set with N variants does not produce N public components.

See [COMPONENT_FAMILY_INVARIANTS.md](./COMPONENT_FAMILY_INVARIANTS.md) for the normative contract and example schemas.


## 29. Mandatory Semantic Component Pass

Family normalization and visual slicing are not enough to produce a reusable design system.

Before production codegen, the compiler must resolve:

~~~text
ComponentFamily
↓
Axis semantics
↓
ComponentAnatomy
↓
SlotIR
↓
FixtureIR
↓
BehaviorIR
↓
AccessibilityIR where applicable
↓
PublicApiPlan
↓
CODEGEN
~~~

The semantic pass must distinguish production semantics from demonstration fixtures.

Examples:

~~~text
placeholder circle before Button label
→ possible leading-icon fixture/slot evidence
→ not automatically a hard-coded production icon

"Button CTA"
→ specimen text
→ not a required Button label

State=Hover
→ CSS interaction
→ not a public Button state prop

known nested Button inside Modal
→ reuse canonical Button
→ do not flatten it
~~~

Evidence priority should favor explicit Figma component properties and instance-swap metadata over geometry or model guesses.

A component is not fully VERIFIED until both semantic/API fidelity and visual fidelity pass.

See [COMPONENT_SEMANTICS.md](./COMPONENT_SEMANTICS.md) and [ACCURACY_STRATEGY.md](./ACCURACY_STRATEGY.md).


## 30. Reference and API Design Policy

The compiler uses shadcn as an API ergonomics and source-distribution reference, not as the visual source of truth.

~~~text
Figma
→ appearance

shadcn
→ ergonomic React patterns, composition, registry/source ownership

native HTML / Base UI
→ behavior and accessibility foundations

compiler
→ semantic translation, code generation, verification
~~~

Do not copy shadcn visual styling into generated components.

Do not translate Figma properties directly into public props.

Before codegen, synthesize a PublicApiPlan using the policy in [API_DESIGN_POLICY.md](./API_DESIGN_POLICY.md).

Default preferences include:

- composition-first APIs;
- preserved native props;
- small orthogonal variant axes;
- CVA or equivalent rule composition;
- slots instead of fixture-specific props;
- compound components for complex structures;
- framework-agnostic core;
- source-owned distribution;
- explicit unsupported combinations.

For example, Figma leading/trailing placeholder icons should normally become icon/content slots rather than hard-coded production SVGs.

Shadcn-inspired distribution must not imply shadcn visual identity.
