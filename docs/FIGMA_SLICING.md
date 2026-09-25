# Figma Slicing and Variant Compilation

## Role after the reference-first pivot

Figma slicing is still essential, but it is no longer the first semantic strategy when an official reference implementation exists.

Use it for:

- component family discovery;
- visual rule extraction;
- supported variant matrix;
- nested component references;
- token/layout evidence;
- Figma-only deltas;
- components with no usable reference.

Do **not** deep-read a giant component set merely to rediscover behavior already present in a pinned reference contract.

## Reference-backed flow

```text
reference contract
        +
shallow Figma component-set index
        ↓
reconcile axes/capabilities
        ↓
representative visual reads
        ↓
VariantDelta / token rules
        ↓
Figma parity
```

## Fallback flow

When no reference exists:

```text
whole component-set URL
↓
shallow discovery
↓
ComponentSetIndex
↓
family normalization
↓
axis classification
↓
representative selection
↓
deep reads only for selected nodes
↓
semantic inference + VariantDelta
```

## Shallow index

Capture only what is needed:

- component-set ID/key;
- variant node IDs;
- variant properties;
- supported combinations;
- shallow dimensions/signatures;
- nested component references;
- component property definitions;
- token/style references when cheap.

## Family invariant

All variants from one component set remain one `ComponentFamily` by default.

Slicing selects evidence **inside** a family; it does not create new component identities.

## Representative strategy

Use one-axis-at-a-time comparisons where possible.

Example:

```text
md / Primary / Default
→ anchor

lg / Primary / Default
→ size delta

md / Secondary / Default
→ hierarchy delta

md / Primary / Hover
→ state visual delta
```

If the reference already proves Hover is an interaction state, Figma only needs to supply the visual delta.

## Outliers

After rules are learned:

1. predict signatures for supported variants;
2. compare against shallow actual signatures;
3. mark outliers;
4. deep-read only outliers.

## Unsupported combinations

Never fill a missing Cartesian product automatically.

Store unsupported combinations explicitly.

## PRO composition slicing

For a licensed PRO component/page, prioritize the nested instance graph:

```text
shallow tree
→ component keys
→ known mapping lookup
→ only deep-read unresolved or layout-critical regions
```

Do not deep-read known Button/Input internals again when the nested instance already maps to a verified component.

## Token/context budget

A large Figma payload is a planning failure if a smaller structural query could answer the question.

Subagents must receive compact IR, not giant raw trees.

## DeepReadPlan

Every expensive read should include:

- family/composition identity;
- node ID;
- reason;
- expected new information;
- whether reference evidence already exists.

Example:

```json
{
  "family": "Button",
  "referenceContract": "untitledui/button@<sha>",
  "deepRead": [
    {
      "nodeId": "A",
      "reason": "verify Figma-only focus ring delta"
    }
  ]
}
```

## Test fixtures

A deep-read placeholder icon may remain a visual fixture.

It must not become production API automatically.

See `COMPONENT_SEMANTICS.md`.
