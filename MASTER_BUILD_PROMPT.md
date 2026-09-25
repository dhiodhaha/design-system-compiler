# Master Build Prompt

This document is the operating contract for an agent or harness working on this repository.

## Mission

Build a reusable, token-efficient Figma-to-React design system compiler.

Do not behave like a generic Figma-to-code generator.

The system must preserve component reuse, generate a sane React API, minimize Figma/model context, and verify output deterministically.

## Read first

Before substantial implementation, read:

1. `DESIGN_SYSTEM_COMPILER.md`
2. `FIGMA_SLICING.md`
3. `PREREQUISITES.md`
4. `SKILLS.md`

## Global rules

1. Figma is the visual source of truth.
2. The authoritative local manifest is the compiler memory.
3. Existing verified components are preferred over new components.
4. A Figma variant is not automatically a React prop.
5. Do not deep-read a complete large Figma component set by default.
6. Do not create one React component per Figma variant.
7. Do not invent missing variant combinations.
8. Deterministic checks happen before AI judgement.
9. Jev is used only for unresolved typed ambiguity.
10. Core React components remain framework-agnostic.
11. Base UI is used for behavior only when needed.
12. Native HTML is preferred when sufficient.
13. Visual failures trigger targeted repairs, never blind rewrites.
14. Persist reusable knowledge so later compiles get cheaper.

## Input contract

A normal compile request should be allowed to provide a whole Figma component-set URL.

Example:

```text
Primary Figma component scope:
https://www.figma.com/design/<file>/<name>?node-id=<component-set-node>

Existing verified specimen:
https://www.figma.com/design/<file>/<name>?node-id=<specimen-node>
```

The user should not have to copy every variant URL.

The harness must discover and slice variants automatically.

## Preflight before any verbose Figma call

Given a component-set scope:

1. parse file key and node ID;
2. check local raw/IR cache;
3. perform shallow structural discovery;
4. build/update `ComponentSetIndex`;
5. enumerate axes and supported combinations;
6. choose representative nodes;
7. produce `DeepReadPlan`;
8. only then deep-read selected nodes.

A full-subtree verbose read is a fallback, not the default.

## Figma Scout role

The Figma Scout may:

- discover axes;
- enumerate variant values;
- build compact indices;
- identify related component sets;
- extract shallow dimensions/styles;
- choose representative nodes;
- deep-read only approved slices;
- extract token references;
- find component instance references;
- detect explicit prototype/reaction data.

The Figma Scout must not:

- edit React source;
- design the public API;
- inspect unrelated Figma pages;
- dump huge raw trees into the parent context.

Expected outputs:

```text
.design-compiler/
  ir/
    <component>.component-set.json
    <component>.representatives.json
    <component>.deltas.json
```

## Variant/API Planner role

Inputs:

- existing verified component source;
- compact ComponentSetIndex;
- representative VariantDelta data;
- current manifest;
- relevant design tokens.

Responsibilities:

- classify each Figma axis;
- determine public variants;
- map browser states;
- map runtime state/props;
- identify composition;
- identify unsupported combinations;
- flag genuine ambiguity.

The planner does not need raw Figma trees if the IR is sufficient.

Example classification:

```text
State=Default
→ base style

State=Hover
→ CSS :hover

State=Focused
→ :focus-visible when appropriate

State=Disabled
→ native disabled + disabled styles

State=Loading
→ runtime prop/state

Hierarchy
→ variant

Size
→ size

Destructive
→ candidate semantic intent; classify using structural evidence
```

## Semantic classification

Classify Figma assets as:

```text
primitive
component
composition
recipe
example
page
```

Do not permit giant Figma "Type" sets to automatically become giant string-union React props.

If a type is a composition of known DS components, preserve the composition.

## Resolver

Use this priority:

1. exact verified mapping;
2. verified local component;
3. verified variant;
4. composition of verified components;
5. Base UI primitive;
6. native HTML;
7. new component.

A new component is the last resort.

## Implementer role

The Implementer receives only:

- approved API plan;
- relevant source files;
- relevant tokens;
- relevant deltas;
- relevant primitive documentation if needed.

Rules:

- extend the existing verified implementation;
- do not regenerate stable verified styles;
- use CVA/compound variants or equivalent rule composition;
- preserve native semantics;
- keep core code framework-agnostic;
- preserve supported-combination constraints;
- do not add speculative features.

When the task is a simple deterministic rule addition, prefer code generation from IR over an LLM.

## Base UI rule

Use Base UI when the component needs behavior such as:

- dialogs;
- popovers;
- menus;
- tooltips;
- select/listbox behavior;
- focus management;
- accessible keyboard state.

Do not wrap a native Button in Base UI just to satisfy a stack checklist if native `<button>` already provides the required behavior.

## Visual Validator role

The Validator does not redesign.

It:

1. starts the deterministic test app;
2. fixes viewport/DPR/browser;
3. waits for fonts;
4. disables motion for static tests;
5. renders a named specimen;
6. captures geometry/computed styles;
7. captures screenshot;
8. compares against the Figma target;
9. reports mismatch regions/properties;
10. maps failures to responsible component/rule.

If deterministic diagnostics identify the property, patch that property only.

Do not ask an LLM "does this look right?" when exact diagnostics exist.

## Representative coverage before full matrix

First test representatives that cover unique rules.

For a Button-like component, a typical matrix might include:

```text
base size / primary / default
small size / primary / default
large size / primary / default
base size / secondary / default
base size / tertiary / default
base size / primary / hover
base size / primary / focus
base size / primary / disabled
base size / primary / loading
base size / primary / icon-only
```

After representative tests pass, render the entire supported matrix deterministically.

The full matrix must not require LLM calls.

## Unsupported combinations

If a Figma combination does not exist:

- record it as unsupported;
- do not synthesize it silently;
- expose the constraint in types or runtime validation when useful.

Absence in Figma is not permission to invent.

## Repair loop

Use a bounded loop:

```text
render
→ diff
→ diagnose
→ patch targeted rule
→ rerun
```

Recommended maximum: 3–5 repair iterations.

Stop if:

- mismatch is within accepted rendering-noise policy;
- the same metric is not improving;
- the source itself is ambiguous;
- a semantic decision is required.

## Jev policy

Jev is optional.

Do not call Jev when:

- code can decide;
- manifest can decide;
- exact structural comparison can decide;
- visual diagnostics can identify the mismatch.

Potential Jev calls:

- prop vs composition vs separate component;
- extend vs create when evidence conflicts;
- primitive/component/recipe/example classification;
- borderline visual noise classification;
- model/human escalation routing.

Jev outputs typed decisions only. It does not generate implementation code.

## OMP/subagent policy

Use subagents for scoped context isolation.

Recommended topology:

```text
Lead
├── Figma Scout
├── Variant/API Planner
├── Implementer
└── Validator
```

Do not make every agent read the entire repo, entire Figma file, and full parent transcript.

Persist artifacts between agents.

Good:

```text
Scout → compact JSON → Planner
Planner → typed plan → Implementer
Implementer → patch → Validator
```

Avoid:

```text
Scout's huge transcript → Planner → Implementer → Validator
```

## Model routing

Use the cheapest sufficient capability.

Good tasks for inexpensive fast models:

- metadata classification;
- variant enumeration;
- repo search;
- simple delta interpretation;
- small CVA edits;
- test-log classification.

Escalate to a stronger coding model for:

- cross-module refactors;
- difficult type-system work;
- architecture changes;
- complex primitive integration;
- compiler/resolver changes.

No model should be called for a deterministic transformation that existing code can perform.

## Skill routing

Skills are capabilities, not global context.

Load the minimum skill set needed for the current worker.

### Figma Scout

Possible skills:

- `figma-analyze-component-set`
- `figma-deep-component`
- `figma-export-tokens`

Use them only when the runtime has the integration they require.

### React architecture

Possible skills:

- `vercel-composition-patterns`
- `shadcn`

Use shadcn for source-distribution/registry patterns, not as the visual source of truth.

### Validator

Possible skills:

- `figma-check-design-parity`
- `webapp-testing`

Deterministic in-repo scripts remain authoritative.

### Motion

Do not load motion-related skills for static component work.

## Memory policy

Persist:

- successful transport strategy;
- endpoint failures worth avoiding;
- token extraction results;
- component mappings;
- supported combinations;
- visual baselines;
- known rendering noise;
- accepted/rejected semantic decisions.

Do not persist private credentials or full model transcripts as project memory.

## Security

Never:

- print Figma PATs;
- print Jev API keys;
- commit `.env`;
- put secrets inside IR/cache;
- copy access tokens into issue/PR logs.

Only inspect whether required environment variables exist.

## Definition of done for a component

A component is done only when:

- its public API is documented;
- supported combinations are known;
- its source is reusable;
- framework-specific imports are absent from core code;
- tokens are canonical;
- representative visual tests pass;
- declared full-matrix tests pass or remaining partial status is explicit;
- manifest mapping is persisted;
- no known unsupported Figma variant was silently invented.

## Required completion report

At the end of a compile slice, report:

- files changed;
- Figma scopes/nodes accessed;
- Figma request count;
- cache hits/misses;
- variant axes discovered;
- supported/unsupported combinations;
- components/tokens reused;
- public API changes;
- representative visual results;
- full-matrix results if run;
- AI/model calls;
- Jev calls;
- remaining ambiguities;
- next smallest vertical slice.

## Standard user prompt template

```text
Follow docs/MASTER_BUILD_PROMPT.md and docs/DESIGN_SYSTEM_COMPILER.md.

Process this Figma component set:
[COMPONENT_SET_URL]

Existing verified specimen, if any:
[SPECIMEN_URL]

Automatically discover and slice variants.
Do not require individual variant links from me.
Do not full-read the component set unless the slicing path fails.

Reuse the existing verified implementation whenever possible.
Do not generate separate React components per Figma variant.

Stop after this component family is verified or a real semantic ambiguity requires escalation.
```


## MANDATORY COMPONENT FAMILY GATE

This gate runs before semantic planning and before implementation.

A Figma component set must first normalize to exactly one `ComponentFamily` candidate.

Child variants from that set are not independent component candidates.

Required pre-codegen checks:

```text
componentSetId present
family normalized
all child variants attached to family
axes enumerated
axes/states classified
supported combinations known
canonical component mapping selected or explicitly unresolved
```

If any required check is missing:

```text
STOP CODEGEN
```

The Implementer must never receive a flat list of raw Button variants and an open-ended request to implement them.

For Button-like state axes, use this default semantic policy unless evidence contradicts it:

```text
Default  → base styles
Hover    → CSS :hover
Focused  → CSS :focus-visible
Disabled → native disabled state + CSS
Loading  → runtime loading prop/state
```

The production API must not expose `state="hover"` or `state="focused"` merely because those values exist in Figma. A visual-test harness may force pseudo states internally.

The Lead must require a family-level artifact before spawning the Implementer, for example:

```text
.design-compiler/ir/button.family.json
```

That artifact must include the component-set ID, canonical family name, variants, classified axes, supported combinations, and intended implementation path.

Required regression invariant:

```text
one Figma component set
→ one canonical public React component by default
```

A run that turns Default, Hover, Focused, Disabled, Loading, or size variants into separate public Button components is a compiler failure.

Read and enforce [COMPONENT_FAMILY_INVARIANTS.md](./COMPONENT_FAMILY_INVARIANTS.md).


## MANDATORY SEMANTIC API GATE

This gate runs after family normalization and before the Implementer.

The Lead must require semantic artifacts for the component:

~~~text
ComponentAnatomy
SlotIR
FixtureIR
BehaviorIR
AccessibilityIR where applicable
PublicApiPlan
~~~

The Implementer must not directly translate raw Figma children or component properties into public React props.

Evidence priority:

~~~text
explicit component properties
→ INSTANCE_SWAP / BOOLEAN / TEXT properties
→ nested component references
→ meaningful layer names
→ stable order around primary content
→ geometry
→ learned convention
→ typed model/Jev decision
~~~

Figma fixtures such as placeholder icons, sample labels, avatars, images, and demo content are test/specimen content unless explicit evidence says they are production semantics.

For a Button, the planner should resolve examples such as:

~~~text
placeholder before label → leading icon slot candidate
label                   → children/content
placeholder after label → trailing icon slot candidate
hover                   → CSS state
focused                 → focus-visible state
disabled                → native state
loading                 → runtime state
~~~

Codegen is blocked if the public API plan is unresolved.

The Validator must run both:

~~~text
semantic/API tests
+
visual tests
~~~

A visual PASS with a semantic/API FAIL is not VERIFIED.

Read [COMPONENT_SEMANTICS.md](./COMPONENT_SEMANTICS.md) and [ACCURACY_STRATEGY.md](./ACCURACY_STRATEGY.md).


## MANDATORY API REFERENCE POLICY

Use shadcn only as a reference for:

- React API ergonomics;
- composition patterns;
- source ownership;
- registry/distribution ideas;
- editable component source.

Do NOT copy shadcn visual styles.

The target visual appearance comes from Figma.

Use native HTML or Base UI as the behavioral/accessibility foundation when appropriate.

Do NOT translate raw Figma properties 1:1 into public React props.

Before spawning the Implementer, the Planner must produce a PublicApiPlan that follows [API_DESIGN_POLICY.md](./API_DESIGN_POLICY.md).

Default API policy:

~~~text
composition-first
preserve native props
small orthogonal variants
CVA/compound variants when evidence requires
children for primary content
slots over placeholder-specific props
framework-agnostic core
source-owned output
explicit unsupported combinations
avoid boolean-prop explosion
~~~

For Button specifically:

~~~text
Figma placeholder SVG/circle
→ visual test fixture and icon-slot evidence

production
→ arbitrary real React icon/content supplied through composition

Figma "Submitting..."
→ specimen loading label unless explicitly documented otherwise

production loading
→ runtime controlled state
~~~

A component that is pixel-perfect but exposes raw Figma fixtures or poor API semantics is not VERIFIED.
