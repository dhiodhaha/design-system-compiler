# API Design Policy

## Purpose

Define how the compiler turns a reference implementation + Figma into a clean production React API.

## Truth split

```text
official implementation
→ semantic/API capability evidence

Figma
→ visual and composition truth

Base UI / native
→ target behavior primitive

shadcn
→ source-owned ergonomics + wrapper/registry patterns

compiler
→ normalization and adaptation
```

## Primary rule

If an official reference exists, **extract capability before inventing API**.

Do not translate either source literally:

```text
React Aria prop names
≠ canonical API automatically

Figma component properties
≠ canonical API automatically
```

The canonical contract decides.

## API goals

Prefer:

- source-owned components;
- small orthogonal variant axes;
- composition over boolean-prop explosion;
- explicit slots where ambiguity matters;
- preserved native semantics where applicable;
- Base UI primitives where they provide the selected behavior;
- framework-agnostic component core;
- typed unsupported combinations;
- predictable runtime behavior;
- no test-only controls in production.

## Reference adaptation

Reference capability should be preserved when relevant even if spelling changes.

Example:

```text
reference: isDisabled
canonical: disabled capability
target: Base UI/native disabled mechanism
```

```text
reference: isLoading
canonical: loading capability
target: loading prop/state + actual spinner behavior
```

```text
reference: href switches to link behavior
canonical: navigation capability
target: target-engine strategy that preserves semantics
```

Do not preserve React-Aria-shaped names merely for cosmetic parity.

## Icon policy

Icons must be real consumer-supplied components/elements, not Figma fixture SVGs.

A verified API may choose one of these patterns:

```tsx
<Button iconLeading={Plus}>Add user</Button>
```

or

```tsx
<Button>
  <Plus data-icon="leading" />
  Add user
</Button>
```

The choice comes from the canonical contract and target ergonomics.

Do not use runtime heuristics such as "first arbitrary React element must be an icon" unless the contract explicitly approves that behavior.

## Icon-only policy

Icon-only behavior should be derived from an explicit contract.

Possible strategies:

- no children + icon prop;
- dedicated icon size;
- explicit semantic IconButton component.

Do not keep `iconOnly` merely because Figma has a boolean axis if the production API can express it more naturally.

Accessible naming is mandatory.

## Loading policy

Loading must be functional, not a static Figma pose.

Requirements may include:

- actual pending runtime state;
- actual animated loading indicator when reference behavior includes motion;
- blocked duplicate activation;
- accessible busy/disabled semantics as defined by contract;
- optional text-preservation behavior;
- reduced-motion handling.

Figma's sample `Submitting...` text is specimen content unless an explicit source says otherwise.

## State policy

Typical Figma interaction mapping:

```text
Default  → base
Hover    → CSS/browser interaction
Focused  → focus-visible behavior
Disabled → primitive/native state
Loading  → runtime state
```

A production prop such as `state="hover"` is forbidden unless the actual component semantics require it.

Forced states belong in a specimen/test wrapper.

## Variants

Visual variant vocabulary should come from the design system, not shadcn.

Shadcn may teach the shape:

```ts
cva(base, {
  variants: {
    variant: {...},
    size: {...}
  }
})
```

but must not inject unrelated names such as `ghost`, `outline`, or `destructive` when the target design system does not define them.

## Component vs recipe

```text
Button / Input / Tooltip primitive
→ component

Invite User Modal / Payment Details Dialog
→ recipe or block when composed from known components

screen
→ page
```

Do not turn every Figma `Type` value into one giant public union.

## Productionization requirements

A public API fails productionization if it contains:

- Figma fixture imports;
- test-only visual state props;
- authoring-only Figma vocabulary;
- duplicate slot mechanisms with no rationale;
- runtime child guessing that misclassifies arbitrary content;
- dead dependencies;
- invalid/semantic-null CSS;
- reference-engine implementation details that should have been normalized away.

## PublicApiPlan

Before implementation:

```ts
type PublicApiPlan = {
  componentName: string
  capabilities: string[]
  props: Record<string, unknown>
  slots: Record<string, unknown>
  stateMappings: Record<string, unknown>
  primitiveTarget: string
  unsupportedCombinations: Record<string, unknown>[]
  adaptations: Array<{
    from: string
    to: string
    reason: string
  }>
}
```

## Final formula

```text
official semantic capability
+
Figma visual vocabulary
+
canonical contract
+
Base UI/native behavior
+
shadcn-like source ergonomics
=
production API
```
