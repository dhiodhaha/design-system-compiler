# Component Semantics

## Core principle

The compiler should infer semantics only when it cannot retrieve stronger semantic evidence.

Priority:

```text
verified local contract
↓
pinned official implementation
↓
Figma explicit component metadata
↓
known target primitive semantics
↓
structural inference
↓
typed ambiguity resolver
↓
model/human
```

## Semantic pipeline

```text
ReferenceContract
        ↘
         Contract Reconciler
        ↗
FigmaFamilyIR
↓
Canonical Component Contract
├── anatomy
├── slots
├── variants
├── states
├── behavior
├── accessibility
├── fixtures
└── public API plan
```

For a component with no reference, `ReferenceContract` is absent and the Figma inference path supplies more evidence.

## Anatomy

Use semantic roles, not child indices.

Example:

```text
Button
├── leading visual
├── text/content
├── trailing visual
└── loading indicator
```

## Slots

A slot must have:

- semantic purpose;
- cardinality;
- source evidence;
- public API strategy;
- target implementation strategy.

Example:

```ts
type SlotIR = {
  name: string
  kind: "text" | "icon" | "media" | "content" | "control" | "indicator"
  cardinality: "one" | "optional" | "many"
  sourceEvidence: string[]
  api: "children" | "prop" | "compound" | "internal"
}
```

## Fixture separation

Figma sample content is not production semantics.

Examples:

```text
placeholder circle
"Button CTA"
"Submitting..."
sample avatar
sample image
```

Keep fixtures in specimen/test code.

Never import fixture assets into the production component unless the design system explicitly defines them as real defaults.

## Reference evidence

Official implementation may reveal semantics static Figma cannot:

- button vs link behavior;
- loading behavior;
- spinner motion;
- focus management;
- controlled/uncontrolled state;
- keyboard semantics;
- selection semantics;
- hidden accessibility behavior.

Treat those as capabilities, not as implementation syntax.

## Figma evidence

Figma remains authoritative for:

- component identity;
- variant matrix;
- nested component instances;
- layout;
- exact visual styling;
- token mapping;
- supported visual combinations.

## Behavioral IR

Conceptual:

```ts
type BehaviorIR = {
  capabilities: string[]
  interactionStates: Record<string, string>
  primitiveRequirements: string[]
  motionRequirements: string[]
}
```

BehaviorIR must record provenance.

## Accessibility IR

Record obligations such as:

- accessible name for icon-only controls;
- focus management;
- keyboard operation;
- disabled semantics;
- popup labelling;
- selection semantics.

The target implementation can differ internally from the reference while preserving these outcomes.

## Mismatch classification

When reference and Figma differ:

```text
REFERENCE_ONLY
FIGMA_ONLY
VISUAL_DELTA
BEHAVIOR_DELTA
API_ADAPTATION
AMBIGUOUS
```

Do not silently merge the two.

## Semantic gate

Codegen requires:

```text
family resolved
reference status known
anatomy resolved
slots resolved
states classified
behavior resolved
accessibility requirements known
fixtures classified
PublicApiPlan approved
target primitive selected
```

If a required item is ambiguous, stop before production codegen.

## Production vs specimen

```text
Production component
→ real public API
→ no forced hover/focus prop
→ no Figma fixtures

Specimen wrapper
→ may force state
→ may inject placeholder icon/text
→ exists only for parity testing
```

## Final rule

Visual similarity proves rendering fidelity.

Reference parity proves semantic/behavior fidelity.

Productionization proves the result is actually fit to ship.

All three matter.
