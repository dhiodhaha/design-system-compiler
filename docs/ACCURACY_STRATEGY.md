# Accuracy Strategy

## Accuracy is multi-dimensional

Track independent gates:

```text
reference accuracy
source/Figma accuracy
family accuracy
contract accuracy
API accuracy
target-adapter accuracy
visual accuracy
behavior accuracy
accessibility accuracy
productionization accuracy
reuse accuracy
regression accuracy
license provenance
```

Do not collapse them into one screenshot score.

## Evidence order

```text
verified local mapping
↓
pinned official reference
↓
Figma component identity/properties
↓
target primitive semantics
↓
tokens/styles
↓
layer names / structure
↓
geometry
↓
inference/model
```

## Provenance

Important decisions should store:

```json
{
  "decision": "loading-capability",
  "evidence": [
    "reference:components/base/buttons/button.tsx",
    "reference-revision:...",
    "figma:State=Loading"
  ],
  "confidence": "verified"
}
```

Recommended confidence:

```text
verified
evidence-backed
inferred
ambiguous
rejected
```

## Reference parity

For components with an official reference, verify capability parity separately from Figma visual parity.

```text
reference semantics PASS
+
target behavior PASS
+
Figma visual PASS
+
productionization PASS
→ VERIFIED
```

## Figma visual validation

Keep deterministic controls:

- pinned browser;
- fixed viewport and DPR;
- fonts loaded;
- stable locale/color scheme;
- motion frozen for static captures;
- geometry checks;
- computed-style checks;
- pixel/perceptual diff;
- mismatch regions.

Use real browser interaction for hover/focus where practical.

## Holdout validation

When mining visual rules:

1. learn from representatives;
2. keep holdout variants;
3. validate learned rules on holdouts;
4. then run full supported matrix.

## Behavior validation

Test relevant capabilities:

- click/press;
- keyboard;
- focus-visible;
- disabled;
- loading;
- link/navigation;
- open/close;
- dismissal;
- selection;
- controlled/uncontrolled semantics;
- motion/reduced-motion.

## Productionization validation

Reject:

- invalid CSS;
- `null`/undefined semantic values emitted as CSS;
- fixture imports;
- test-only props in production;
- Figma-only trace attributes in production by default;
- static spinner where runtime motion is required;
- ambiguous runtime slot inference;
- duplicate APIs;
- unused dependencies.

The current Button's old visual success does not automatically satisfy this gate.

## Cross-component reuse

Verify that higher-level Figma compositions resolve known instances to canonical components.

Examples:

```text
Button inside Modal → canonical Button
Input inside form → canonical Input
Tooltip inside block → canonical Tooltip
```

Flattening a known instance into raw HTML is a reuse failure even if pixels match.

## Error taxonomy

```text
REFERENCE
LICENSE
SOURCE
FAMILY
CONTRACT
AXIS
ANATOMY
SLOT
FIXTURE
BEHAVIOR
ACCESSIBILITY
API
ADAPTER
TOKEN
CODEGEN
PRODUCTION
VISUAL
REUSE
TRANSPORT
```

## Verification state

Use explicit stage status rather than one early `VERIFIED`.

```text
REFERENCE_INDEXED
CONTRACT_RESOLVED
TARGET_IMPLEMENTED
REFERENCE_PARITY_PASS
FIGMA_VISUAL_PASS
BEHAVIOR_PASS
ACCESSIBILITY_PASS
PRODUCTION_PASS
VERIFIED
```

## Metrics

Track:

- reference match rate;
- reference contract coverage;
- known-component reuse rate;
- Figma component-key resolution rate;
- generated unknown primitives;
- parity pass rate;
- visual matrix pass rate;
- behavior pass rate;
- accessibility pass rate;
- productionization failures;
- fixture leak count;
- invalid CSS count;
- AI calls per component;
- manual-review rate.

The mature system should reuse more and infer less.
