# Accuracy Strategy

The compiler should optimize for design-system accuracy, not only screenshot similarity.

Accuracy has multiple dimensions:

~~~text
source accuracy
structural accuracy
semantic accuracy
token accuracy
visual accuracy
behavioral accuracy
accessibility accuracy
API accuracy
reuse accuracy
regression accuracy
~~~

A visually identical but semantically poor component is not fully accurate.

## 1. Accuracy model

Treat accuracy as independent gates rather than one score.

### Source fidelity

Read the correct Figma component set, node IDs, properties, variables, nested instances, and reference images.

### Structural fidelity

Keep all variants attached to the correct component family.

### Semantic fidelity

Correctly identify component anatomy, slots, fixtures, states, behavior, compositions, and recipes.

### Token fidelity

Preserve Figma variables/styles as canonical token references instead of guessed values.

### Visual fidelity

Match dimensions, typography, spacing, effects, borders, colors, and raster appearance within threshold.

### Behavioral fidelity

Correctly implement hover, focus, disabled, loading, open/close, selection, keyboard interaction, and primitive behavior.

### Accessibility fidelity

Preserve native or primitive accessibility requirements.

### API fidelity

Produce a semantic, compact, composable React API without raw design-tool artifacts.

### Reuse fidelity

Reuse verified components and nested instances instead of flattening or duplicating them.

### Regression fidelity

Reproduce the same guarantees after later changes.

## 2. Evidence-first pipeline

Use stronger evidence before weaker inference:

~~~text
explicit Figma component properties
↓
component-set identity
↓
nested component references
↓
variables/styles
↓
layer names
↓
auto-layout/order/geometry
↓
verified manifest/mappings
↓
learned project conventions
↓
typed inference
↓
Jev/model
↓
human review
~~~

Do not let a model override stronger deterministic evidence without an explicit recorded exception.

## 3. Provenance and confidence

Important IR decisions should carry provenance.

Example:

~~~json
{
  "slot": "leadingIcon",
  "decision": "icon-slot",
  "evidence": [
    "INSTANCE_SWAP:Leading icon",
    "nested-component:placeholder-icon",
    "position:before-label"
  ],
  "confidence": "verified"
}
~~~

Recommended confidence states:

~~~text
verified
evidence-backed
inferred
ambiguous
rejected
~~~

Never silently treat inferred as verified.

## 4. Separate extraction from interpretation

Keep these stages separate:

~~~text
raw Figma retrieval
→ normalization
→ semantic interpretation
→ API planning
→ implementation
~~~

This makes errors diagnosable. A wrong result can be traced to source extraction, family grouping, semantic classification, API synthesis, or code generation.

## 5. Deterministic invariants

Examples:

~~~text
same componentSetId → same ComponentFamily by default
hover state         → not a separate public component
known nested Button → preserve Button reuse
missing combination → unsupported, not invented
placeholder fixture → test fixture, not production dependency
~~~

Hard invariants should be unit-tested.

## 6. Learn one dimension at a time

Use controlled comparisons.

Base:

~~~text
md / Primary / Default / iconOnly=false
~~~

Then isolate:

~~~text
lg / Primary / Default / false
→ size rule

md / Secondary / Default / false
→ hierarchy rule

md / Primary / Hover / false
→ hover rule
~~~

This reduces causal ambiguity.

## 7. Representative coverage plus exhaustive validation

Use two layers.

### Layer A: representative learning

Pick specimens that cover every unique rule.

### Layer B: full supported matrix

After rules pass representative tests, render every supported combination automatically.

Full matrix validation should not require one model call per variant.

This gives small reasoning context plus large deterministic coverage.

## 8. Outlier-driven deep reads

After learning rules:

1. predict shallow signatures for all variants;
2. compare with actual shallow Figma signatures;
3. identify outliers;
4. deep-read only outliers;
5. add compound or special rules only when evidence requires them.

## 9. Dual verification: semantic and visual

A component must pass both.

~~~text
VISUAL PASS + SEMANTIC FAIL
→ not verified

SEMANTIC PASS + VISUAL FAIL
→ not verified

VISUAL PASS + SEMANTIC PASS
→ eligible for verified
~~~

## 10. Behavioral tests

Static screenshots cannot validate behavior.

Add browser tests for relevant semantics:

- hover;
- keyboard focus;
- disabled interaction;
- loading behavior;
- click behavior;
- open/close;
- keyboard navigation;
- escape handling;
- focus return;
- selection.

Use Base UI/native behavior as a verified behavioral foundation when appropriate.

## 11. Accessibility checks

Examples:

~~~text
icon-only button has accessible name
disabled button behavior is valid
dialog has title/label relationship
tooltip is connected to its trigger
menu/select keyboard behavior works
~~~

Automated accessibility tooling can supplement semantic tests.

## 12. Token accuracy

Never sample screenshot color when a source variable/style exists.

Prefer:

~~~text
Brand/600
→ canonical token
→ CSS variable
→ Tailwind/component usage
~~~

Store aliases and modes when available.

## 13. Font accuracy

Pin font family, weight, size, line height, letter spacing, browser, and test environment where possible.

Wait for document.fonts.ready.

Classify glyph-edge-only differences separately from geometry differences.

## 14. Deterministic visual environment

Pin:

- browser version;
- viewport;
- DPR;
- color scheme;
- locale when relevant;
- fonts;
- reduced-motion policy;
- animations/transitions;
- deterministic test data.

## 15. Targeted visual diagnostics

Do not rely only on a global mismatch percentage.

Collect:

- bounding boxes;
- computed styles;
- text metrics;
- mismatch regions;
- expected vs actual properties;
- component/node provenance.

This makes repairs targeted.

## 16. Golden specimens and canaries

Keep a small set of high-value goldens per component family.

Example Button canaries:

~~~text
primary default
secondary default
focused
disabled
loading
icon-only
largest size
smallest size
~~~

Run these frequently. Run the full matrix in CI or when source hashes change.

## 17. Holdout validation

Avoid overfitting to the specimens used to learn rules.

1. choose representatives for rule extraction;
2. keep several supported combinations as holdouts;
3. compile rules;
4. verify holdouts without using them to create the rules;
5. then trust the rule family more broadly.

## 18. Cross-component consistency

Verify relationships across the system:

- Button inside Modal uses canonical Button;
- Input inside form recipes uses canonical Input;
- spacing tokens remain consistent;
- icon mappings stay stable;
- shared focus-ring behavior remains consistent;
- shared motion tokens remain consistent.

This catches locally pixel-perfect implementations that violate system reuse.

## 19. Confidence-aware automation

Suggested policy:

~~~text
verified or evidence-backed
→ compile automatically

inferred, low impact
→ compile with extra validation

ambiguous
→ Jev/model/human decision

contradictory evidence
→ stop
~~~

Prefer stopping over silently inventing semantics.

## 20. Accuracy metrics

Track more than visual mismatch:

~~~text
family grouping accuracy
axis-classification coverage
slot-classification coverage
fixture-leak count
token coverage
nested-component reuse rate
unsupported-combination preservation
representative visual pass rate
full-matrix visual pass rate
behavior test pass rate
accessibility rule pass rate
API semantic warnings
cache hit rate
AI calls per compile
manual-review rate
~~~

## 21. Error taxonomy

Every failure should belong to a category:

~~~text
SOURCE
FAMILY
AXIS
ANATOMY
SLOT
FIXTURE
BEHAVIOR
ACCESSIBILITY
TOKEN
API
CODEGEN
VISUAL
REUSE
TRANSPORT
~~~

Store the category in reports.

## 22. Accuracy loop

~~~text
extract
↓
normalize
↓
classify
↓
plan API
↓
compile
↓
semantic tests
↓
visual tests
↓
behavior tests
↓
full matrix
↓
record provenance + decisions
↓
reuse knowledge next time
~~~

## 23. Definition of VERIFIED

Recommended minimum:

- family mapping verified;
- axes classified;
- anatomy and slots resolved;
- fixtures classified;
- public API approved by deterministic policy or recorded semantic decision;
- tokens canonical;
- representative semantic tests pass;
- representative visual tests pass;
- full supported matrix passes configured validation or explicit partial status is stored;
- behavioral tests pass where behavior exists;
- accessibility requirements pass where applicable;
- reuse mappings are persisted.

## 24. Practical strategy for current Button work

1. keep the existing pixel-perfect base;
2. normalize the whole set into one Button family;
3. inspect component properties and instance swaps;
4. infer leading icon, label, trailing icon, and loading indicator;
5. classify placeholder circles as fixtures, not public semantics;
6. synthesize the public Button API;
7. map Default, Hover, Focused, Disabled, Loading to base/CSS/native/runtime semantics;
8. compile size/hierarchy deltas into CVA;
9. run semantic tests;
10. run representative visual tests;
11. run holdout tests;
12. run the full supported matrix deterministically;
13. only then mark Button fully verified.

## 25. Final thesis

The compiler is accurate when it preserves both:

~~~text
what the design looks like
AND
what the component means
~~~

Pixel-perfect without semantics produces a screenshot renderer.

Semantics without visual fidelity produces a generic component library.

The goal is both.
