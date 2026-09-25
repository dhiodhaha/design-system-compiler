# Reference Parity Strategy

## Goal

Port an authoritative reference implementation to a different primitive engine while preserving the component's meaning and user-visible behavior.

Initial case:

```text
Untitled UI React
React Aria
↓
Canonical Component Contract
↓
Base UI target
```

## What 1:1 means

Required parity:

```text
component capability      equivalent
visual output             equivalent to target Figma
behavioral intent         equivalent
keyboard interaction      equivalent where applicable
accessibility outcome     equivalent
state coverage            equivalent
slot/composition ability  equivalent
```

Not required:

```text
same prop names
same DOM tree
same internal hooks
same primitive library
same source structure
same CSS implementation
```

## Three-way comparison

For reference-backed components, verification is three-way:

```text
official reference
↕ semantic/behavior parity

Base UI target
↕ visual parity

Figma
```

No single source replaces the other two.

## Contract matrix

Each component should have a parity matrix.

Example:

| Capability | Reference | Canonical Contract | Target | Test |
| --- | --- | --- | --- | --- |
| disabled | yes | disabled | yes | interaction |
| loading | yes | loading | yes | behavior + visual |
| leading icon | yes | leading visual | yes | composition |
| trailing icon | yes | trailing visual | yes | composition |
| icon-only | yes | icon-only capability | yes | API + a11y |
| href/link | yes | navigation capability | yes | navigation |
| focus | yes | focus-visible behavior | yes | keyboard |
| destructive | yes | variant capability if mapped | conditional | contract |

Do not mark a row PASS merely because a prop with a similar name exists.

## Target adapters

A target adapter maps canonical capabilities into an implementation engine.

Conceptual:

```ts
type TargetAdapter = {
  engine: "base-ui" | "native"
  supports(contract: ComponentContract): SupportReport
  implement(plan: PublicApiPlan): ImplementationPlan
}
```

Target adapters should be reusable across design systems.

## Base UI mapping

Use actual Base UI primitives when they exist and provide relevant semantics.

Do not build fake wrappers that imitate Base UI while bypassing its primitive.

Shadcn's Base UI implementation can be inspected for wrapper shape and source-owned ergonomics.

It does not define the Untitled UI visual language.

## Button parity case

Reference evidence currently includes:

- Button and Link behavior;
- loading/pending behavior;
- disabled behavior;
- icon positions;
- icon-only state;
- animated spinner;
- destructive variants;
- size and color variants.

A target Button should explicitly account for each applicable capability.

If the selected Figma family omits a reference capability, record the mismatch instead of silently inventing the variant.

## Behavioral deltas

Primitive engines may intentionally differ.

Every material behavior difference must be:

1. detected;
2. classified;
3. tested;
4. accepted/rejected explicitly;
5. recorded in provenance.

Do not silently patch the target until it behaves approximately like the reference.

## Production vs specimen

Use separate surfaces:

```text
ProductionComponent
→ clean public API
→ real behavior

ReferenceSpecimen
→ renders pinned upstream

FigmaSpecimen
→ may force visual states
→ may use fixture icons/text
```

Test-only controls belong in specimen wrappers.

## Motion

If the reference includes meaningful runtime motion, treat it as behavior evidence.

Example:

```text
reference loading spinner uses real rotation
→ target loading indicator should not be a static Figma pose
```

Static screenshot validation must freeze motion.

Behavior validation must prove the motion/transition is present and respects reduced-motion policy.

## Accessibility parity

Check outcomes, not implementation-library internals.

Examples:

- roles;
- accessible names;
- keyboard focus;
- disabled semantics;
- popup focus handling;
- escape/dismiss behavior;
- selection semantics.

Automated accessibility scans supplement, but do not replace, contract tests.

## Status

Recommended parity states:

```text
NOT_INDEXED
REFERENCE_CONTRACT_READY
TARGET_MAPPED
PARITY_PARTIAL
PARITY_PASS
PARITY_EXCEPTION
```

A documented exception should identify the exact capability and reason.

## Regression

Pin reference revision in every parity report.

When upstream changes:

```text
old reference SHA
vs
new reference SHA
↓
contract diff
↓
affected components only
↓
parity rerun
```

Do not re-port the entire library blindly.
