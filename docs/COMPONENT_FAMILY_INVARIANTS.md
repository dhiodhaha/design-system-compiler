# Component Family Invariants

This document defines **hard compiler invariants** for Figma component sets.

These are not suggestions for an LLM. They are rules the compiler/harness must enforce before code generation.

## Core invariant

> All child variants that belong to the same Figma component set are members of one `ComponentFamily` by default. They are not independent React components.

For example:

```text
Buttons/Button
├── Size=md, Hierarchy=Primary, State=Default, Icon only=False
├── Size=md, Hierarchy=Primary, State=Hover, Icon only=False
├── Size=md, Hierarchy=Primary, State=Focused, Icon only=False
├── Size=md, Hierarchy=Primary, State=Disabled, Icon only=False
├── Size=md, Hierarchy=Primary, State=Loading, Icon only=False
├── Size=lg, Hierarchy=Primary, State=Default, Icon only=False
└── ...
```

must initially normalize to:

```text
ComponentFamily: Button
  variants: N
  React component candidates: 1
```

and **not**:

```text
ButtonDefault
ButtonHover
ButtonFocused
ButtonDisabled
ButtonLoading
...
```

## Required data model

The compiler should materialize a family before any codegen:

```ts
type ComponentFamily = {
  familyId: string
  figmaComponentSetId: string
  componentKey?: string
  name: string
  variants: FamilyVariant[]
  axes: Record<string, string[]>
  axisSemantics: Record<string, AxisSemantic>
  implementation?: {
    componentName: string
    path: string
  }
}

type FamilyVariant = {
  nodeId: string
  props: Record<string, string | boolean | number>
}

type AxisSemantic =
  | { kind: "public-variant"; prop: string }
  | { kind: "css-state"; selector: string }
  | { kind: "native-state"; prop: string }
  | { kind: "runtime-state"; prop: string }
  | { kind: "composition" }
  | { kind: "internal" }
  | { kind: "unsupported-constraint" }
```

The exact TypeScript schema may evolve, but the semantic boundary must remain.

## Codegen gate

Code generation must be blocked until the family is normalized.

Conceptual assertions:

```ts
assert(componentFamily.figmaComponentSetId)
assert(componentFamily.variants.length > 0)
assert(componentFamily.axesClassified === true)
assert(componentFamily.familyDecision !== undefined)
```

If these assertions fail:

```text
STOP CODEGEN
```

Do not allow an implementer model to independently interpret raw variant nodes as separate components.

## State classification invariant

A Figma `State` axis is not automatically a React `state` prop.

For a typical Button:

```text
Default
→ base styling

Hover
→ CSS :hover

Focused
→ CSS :focus-visible when semantically correct

Disabled
→ native disabled state + CSS disabled styling

Loading
→ runtime loading state/prop
```

A production API such as:

```tsx
<Button state="hover" />
```

is normally invalid. It may exist only in an internal visual-test harness if necessary to force a state.

## Family mapping invariant

Once a Figma component set is mapped:

```json
{
  "figmaComponentSetId": "3287:427074",
  "codeComponent": "Button"
}
```

every child variant from that set resolves to the same code component unless an explicit, reviewed exception exists.

Example:

```text
3287:427299
md / Primary / Default / false
→ Button

3287:427383
md / Primary / Hover / false
→ Button
```

The variants may produce different rules, but they do not create different React files.

## One family, one canonical implementation

For one normalized component family, the default maximum number of canonical React component implementations is:

```text
1
```

The compiler may generate helper subcomponents for implementation quality, but variant nodes must not independently create public component files.

For example, 200 Figma Button variants should normally produce:

```text
src/components/ui/button.tsx
```

with CVA/CSS/runtime rules, not 200 files.

## Required regression test

The compiler should have a test equivalent to:

```ts
expect(result.componentFamilies).toHaveLength(1)
expect(result.componentFamilies[0].name).toBe("Button")
expect(result.componentFamilies[0].variants).toHaveLength(expectedVariantCount)
expect(result.generatedPublicComponents).toHaveLength(1)
```

A regression where one component set produces many public components must fail CI.

## Axis classification gate

Before implementation, every axis must be classified.

Example:

```json
{
  "Size": {
    "kind": "public-variant",
    "prop": "size"
  },
  "Hierarchy": {
    "kind": "public-variant",
    "prop": "variant"
  },
  "State.Default": {
    "kind": "internal"
  },
  "State.Hover": {
    "kind": "css-state",
    "selector": ":hover"
  },
  "State.Focused": {
    "kind": "css-state",
    "selector": ":focus-visible"
  },
  "State.Disabled": {
    "kind": "native-state",
    "prop": "disabled"
  },
  "State.Loading": {
    "kind": "runtime-state",
    "prop": "loading"
  }
}
```

The representation can be normalized differently internally; what matters is that codegen does not receive unclassified axes.

## Different component sets

The same-family rule applies automatically only inside one component set.

Two different Figma component sets are not automatically merged.

Example:

```text
Buttons/Button
Buttons/Button destructive
```

The compiler must compare:

- anatomy;
- axes;
- sizes;
- states;
- slots;
- behavior;
- token differences;
- nested component references.

Possible result:

```text
same structure + same behavior + semantic color/token difference
→ extend Button, e.g. intent="danger"
```

or:

```text
different structure/behavior
→ separate component/composition
```

If structural rules cannot decide, this is a valid Jev decision point.

## Slicing relationship

Slicing happens **inside a family**.

The compiler does not slice the set into independent components. It slices the family into representative variants used to learn rules.

```text
ComponentFamily: Button
       ↓
representative variants
       ↓
size deltas
hierarchy deltas
state deltas
composition deltas
       ↓
one implementation
```

## Manifest requirement

The authoritative manifest should store family-level mapping and state semantics.

Example direction:

```json
{
  "components": {
    "Button": {
      "figma": {
        "componentSetId": "3287:427074"
      },
      "implementation": {
        "path": "src/components/ui/button.tsx"
      },
      "axes": {
        "Size": {
          "kind": "public-variant",
          "prop": "size"
        },
        "Hierarchy": {
          "kind": "public-variant",
          "prop": "variant"
        }
      },
      "states": {
        "Default": "base",
        "Hover": "css:hover",
        "Focused": "css:focus-visible",
        "Disabled": "native:disabled",
        "Loading": "runtime:loading"
      }
    }
  }
}
```

Once this mapping exists, future agents should look it up rather than reason about the same family again.

## Implementer contract

The Implementer must receive:

- family ID / component-set ID;
- canonical component mapping;
- classified axes;
- supported combinations;
- delta rules;
- relevant existing source.

The Implementer must **not** receive a flat list of raw variant nodes with an open-ended instruction such as "implement these".

## Validator contract

The Validator may render many variant/state specimens, but all must resolve back to the same canonical family mapping.

A useful diagnostic field is:

```json
{
  "figmaNodeId": "3287:427383",
  "family": "Button",
  "component": "Button",
  "forcedTestState": "hover"
}
```

`forcedTestState` is test-harness metadata, not necessarily public React API.

## Summary

The invariant is:

```text
Figma component set
→ one ComponentFamily
→ classify axes/states
→ slice representative variants
→ learn reusable rules
→ one canonical implementation
→ render many supported states/variants
```

Variant nodes are evidence for a component's styling and behavior, not independent components by default.
