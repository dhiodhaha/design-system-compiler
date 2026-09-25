# Figma Slicing and Variant Compilation

## Why this exists

Large Figma component sets can produce enormous metadata responses.

The wrong pipeline is:

```text
whole component set
↓
deep read every descendant
↓
65k+ tokens
↓
LLM decides what mattered
```

The correct pipeline is:

```text
whole component-set URL
↓
cheap structural scan
↓
compact ComponentSetIndex
↓
deterministic Slice Planner
↓
representative nodes
↓
deep reads only for those nodes
↓
VariantDelta rules
```

The user should be able to copy the whole component set. The project is responsible for slicing it.

## 1. Input

A component-set URL is the normal unit of user input.

Example shape:

```text
https://www.figma.com/design/<file>/<name>?node-id=<component-set-node>
```

Do not require the user to manually copy:

- default;
- hover;
- focus;
- disabled;
- loading;
- every size;
- every hierarchy;
- every icon configuration.

## 2. Phase A — shallow discovery

The first fetch should retrieve only enough information to build:

- component-set ID/key;
- variant node IDs;
- variant property values;
- shallow dimensions;
- shallow style signatures when cheap;
- child count/component references when cheap.

Output:

```json
{
  "component": "Button",
  "axes": {
    "size": ["xs", "sm", "md", "lg", "xl"],
    "hierarchy": [
      "Primary",
      "Secondary",
      "Tertiary",
      "Link color",
      "Link gray"
    ],
    "state": [
      "Default",
      "Hover",
      "Focused",
      "Disabled",
      "Loading"
    ],
    "iconOnly": [false, true]
  }
}
```

The exact matrix may contain missing combinations. Preserve that fact.

## 3. Phase B — classify axes

Before selecting nodes, classify axes.

Typical classes:

```text
size
→ public visual variant

hierarchy
→ public visual/semantic variant

state=hover
→ browser/CSS state

state=focused
→ browser focus-visible state

state=disabled
→ native runtime state

state=loading
→ runtime prop/state

icon-only
→ composition/API decision

destructive
→ semantic decision such as intent; inspect evidence
```

If an axis is ambiguous, first use structural evidence and memory. Only use Jev after deterministic evidence is insufficient.

## 4. Phase C — choose a base

Prefer a verified golden specimen when one exists.

Example:

```text
md / Primary / Default / iconOnly=false
```

If no specimen exists, choose a common/default combination with minimal special behavior.

The base becomes the comparison anchor.

## 5. Phase D — one-axis-at-a-time representatives

Change one dimension while holding the rest constant.

### Size

```text
md / Primary / Default / false
lg / Primary / Default / false
```

This isolates size delta.

### Hierarchy

```text
md / Primary / Default / false
md / Secondary / Default / false
```

This isolates hierarchy delta.

### State

```text
md / Primary / Default / false
md / Primary / Hover / false
```

This isolates state delta.

### Icon-only

```text
md / Primary / Default / false
md / Primary / Default / true
```

This isolates icon/composition delta.

## 6. Phase E — deep-read representatives

Only representative nodes need full anatomy unless an outlier is found.

A deep read can collect:

- nested children;
- text styles;
- icon size;
- fill/stroke;
- effects;
- variable references;
- component instances;
- vector geometry when needed;
- prototype reactions.

Store the result in the raw cache and normalized IR.

## 7. VariantDelta extraction

Compare each representative against the anchor.

Example:

```json
{
  "from": "md.primary.default",
  "to": "lg.primary.default",
  "changes": [
    {"property":"height","before":40,"after":44},
    {"property":"paddingInline","before":14,"after":16},
    {"property":"fontSize","before":14,"after":16},
    {"property":"lineHeight","before":20,"after":24}
  ]
}
```

A simple hover might be:

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

The compiler can translate many deltas into rules without an LLM.

## 8. Rule compilation

Conceptual output:

```ts
const buttonVariants = cva(base, {
  variants: {
    variant: {
      primary: "...",
      secondary: "...",
      tertiary: "..."
    },
    size: {
      xs: "...",
      sm: "...",
      md: "...",
      lg: "...",
      xl: "..."
    }
  },
  compoundVariants: [
    // only when axes interact
  ]
})
```

Figma state becomes CSS/runtime semantics where appropriate rather than a `state` string prop.

## 9. Outlier detection

One-axis deltas may not explain every combination.

After rules are learned:

1. predict the expected signature of every supported combination;
2. compare prediction with shallow actual Figma signature;
3. mark mismatches as outliers;
4. deep-read only the outliers.

Example:

```text
200 variants
↓
188 explained by learned rules
12 outliers
↓
deep-read only 12
```

This is preferable to deep-reading all 200.

## 10. Representative visual tests

Use representatives that cover every unique rule.

Example Button coverage:

```text
primary default base
small primary
large primary
secondary default
tertiary default
link color default
link gray default
primary hover
primary focus
primary disabled
primary loading
primary icon-only
```

If a destructive family is separate, validate it as a separate semantic-extension slice.

## 11. Full matrix verification

Once representative cases pass, render every supported combination.

This step should use:

- code generation from the rule matrix;
- Playwright;
- screenshots;
- geometry checks;
- pixel diff.

It should not invoke an LLM for each combination.

## 12. Unsupported combinations

A Figma file may omit some permutations.

Do not "complete" the Cartesian product automatically.

Example:

```text
Link color × Icon only=True
does not exist
```

Store:

```text
unsupported
```

Possible enforcement:

- TypeScript API narrowing;
- runtime validation;
- dev warning;
- manifest validation.

## 13. Cache strategy

Recommended keys:

```text
fileKey
nodeId
source version/hash
depth/profile
geometry mode
image scale/format
```

Cache:

- raw shallow set reads;
- deep representative reads;
- exported references;
- normalized IR;
- token maps.

Do not refetch unchanged data.

## 14. DeepReadPlan

Before expensive retrieval, emit a plan.

Example:

```json
{
  "component": "Button",
  "deepRead": [
    {"nodeId":"A","reason":"verified base"},
    {"nodeId":"B","reason":"size-xl delta"},
    {"nodeId":"C","reason":"secondary hierarchy delta"},
    {"nodeId":"D","reason":"hover-state delta"}
  ],
  "skipped": 196
}
```

The plan is an observability tool and a guard against accidental context explosion.

## 15. Token budget guard

The harness should support a policy such as:

```text
if estimated Figma response > configured threshold:
  stop
  create/refine SlicePlan
  do not send raw response to model
```

A giant response should be treated as a planning failure, not as normal operation.

## 16. Relationship to subagents

Subagents do not automatically save total tokens.

Bad:

```text
Lead avoids 65k
but Figma Scout consumes 65k
→ aggregate cost still high
```

Good:

```text
Figma extractor/slicer consumes raw machine data
→ Scout sees 1–3k compact tokens
→ Planner sees a few hundred lines of IR
→ Implementer sees only relevant source/deltas
```

The slice must happen before verbose model context.

## 17. User UX principle

The user should think in design-system units:

```text
"Process Buttons/Button"
```

not low-level retrieval units:

```text
"Here are 97 individual variant URLs"
```

Manual variant-link copying is a compiler failure.


## 18. Family-first slicing invariant

Slicing never means splitting a component set into separate component identities.

Before representative selection:

```text
all child nodes
→ attach to one ComponentFamily
→ then slice variants for evidence
```

For example:

```text
Button Default
Button Hover
Button Focused
Button Disabled
Button Loading
```

inside the same Figma component set are five specimens/states of one Button family, not five public component candidates.

The Slice Planner operates on:

```text
ComponentFamily
  ├── variant specimen A
  ├── variant specimen B
  ├── variant specimen C
  └── ...
```

and selects the minimum specimens needed to learn reusable rules.

It must preserve the family ID/component-set ID on every slice so downstream workers cannot accidentally reinterpret slices as independent components.

Recommended `DeepReadPlan` field:

```json
{
  "family": {
    "name": "Button",
    "componentSetId": "3287:427074"
  },
  "deepRead": [
    {
      "nodeId": "A",
      "reason": "hover-state delta"
    }
  ]
}
```

A slice without family provenance must be rejected.


## 19. Semantic pass after slicing

Slicing finds the minimum visual evidence. It does not define the production component API.

After representative reads and delta extraction, run the semantic component pass:

~~~text
representative Figma nodes
↓
visual deltas
↓
anatomy + slots
↓
fixture classification
↓
behavior/accessibility
↓
PublicApiPlan
~~~

A raw placeholder node can remain in a golden specimen while being represented as a generic production slot.

Therefore:

~~~text
visual specimen content
≠ automatically production API
~~~

See [COMPONENT_SEMANTICS.md](./COMPONENT_SEMANTICS.md).
