# PRO Figma Composition Strategy

## Purpose

Use a licensed PRO Figma design as a composition source while reusing verified open-source/base components.

The compiler should not recreate every visible element from raw geometry.

## Preferred flow

```text
PRO Figma component / screen
↓
shallow component-instance graph
↓
component-key mapping
↓
verified base component lookup
↓
composition reconstruction
↓
layout/token deltas
↓
generate only unknown glue
↓
visual + behavioral validation
```

## Example

Figma:

```text
Invite User Modal
├── Avatar
├── Input
├── Checkbox
├── Tooltip
├── Button
└── Button
```

If all children are known:

```tsx
<Dialog>
  <Avatar />
  <Input />
  <Checkbox />
  <Tooltip>...</Tooltip>
  <Button>Cancel</Button>
  <Button>Invite user</Button>
</Dialog>
```

The compiler should generate the recipe/composition and layout, not new Button/Input/Checkbox implementations.

## Resolution priority

For each nested instance:

1. exact Figma component-key mapping;
2. verified reference/local contract mapping;
3. verified local component;
4. composition mapping;
5. semantic inference fallback.

Known components must not be flattened.

## Output categories

```text
BASE_COMPONENT
→ already verified library component

BASE_EXTENSION
→ thin wrapper or additional supported capability

RECIPE
→ composition of verified components

BLOCK
→ larger reusable composition

PAGE
→ application-level composition

UNKNOWN_PRIMITIVE
→ genuinely new component requiring semantic compilation
```

UNKNOWN_PRIMITIVE should become rarer as the base library grows.

## Layout

PRO layout may legitimately require generated code.

Generate:

- grid/flex composition;
- spacing;
- responsive behavior when evidenced;
- local wrappers;
- text/content placeholders needed for the recipe;
- controlled data boundaries.

Do not use absolute positioning merely because it reproduces a screenshot unless the design semantics require it.

## Tokens

Reuse canonical project tokens first.

```text
verified local token
↓
mapped Figma token/variable
↓
reference-library token mapping
↓
new semantic token
↓
recorded hardcoded exception
```

## Behavior

Higher-level behavior may not be visible from static Figma.

Evidence priority:

1. official reference component/block if legally available;
2. Figma prototype/reaction;
3. explicit project specification;
4. behavior of composed verified primitives;
5. conservative behavior;
6. typed ambiguity/human decision.

Do not invent business logic.

## Licensing boundary

The open-source Untitled UI React repository is MIT for its included files.

Untitled UI PRO materials are governed separately.

Therefore:

- using licensed PRO Figma as local input does not make it MIT;
- do not publish a public "PRO clone" generated from proprietary assets unless the license allows it;
- keep compiler architecture generic;
- record provenance for PRO-derived output;
- allow projects to mark generated recipes/blocks as private/non-distributable.

Suggested registry metadata:

```json
{
  "distribution": "private",
  "sourceProvenance": "licensed-pro-figma",
  "redistribution": "follow-source-license"
}
```

## Verification

A PRO composition should pass:

- known-component reuse check;
- fixture leak check;
- semantic composition review;
- visual parity;
- responsive checks when relevant;
- behavior tests for real interactions;
- accessibility checks;
- license/distribution classification.

## Success metric

The important metric is not "how much code was generated."

It is:

```text
known-component reuse ↑
unknown generated primitives ↓
raw Figma HTML ↓
manual semantic guessing ↓
```


## OSS-missing component fallback

Licensed PRO Figma is also the fallback design source for components that do not exist in the pinned OSS GitHub reference.

Decision flow:

```text
Figma component encountered
↓
exact local mapping?
├── yes → reuse
└── no
    ↓
official OSS reference exists?
├── yes → reference-backed port/reuse
└── no
    ↓
PRO-only Figma component
→ family normalization
→ representative slicing
→ resolve known nested components
→ semantic compile only unresolved parts
→ Base UI/native/specialized implementation
→ Figma verification
```

This means the final library can grow beyond the public GitHub coverage without re-implementing components that are already known.

A PRO-only component should preferably become a recipe/block/composition when it is mainly assembled from verified base components.

Only create a new primitive when composition is insufficient.

See [COVERAGE_STRATEGY.md](./COVERAGE_STRATEGY.md).
