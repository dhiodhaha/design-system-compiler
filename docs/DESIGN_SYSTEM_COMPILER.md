# Design System Compiler Architecture

## Status

Canonical architecture as of 2026-09-25.

The project is now **reference-first**, not Figma-inference-first.

Its primary job is to compile a design system across representations:

```text
official implementation reference
+
Figma visual/composition source
+
canonical semantic contract
+
target primitive engine
↓
verified, source-owned React components
```

The first target is Untitled UI:

```text
Untitled UI open-source React
(React Aria reference)
        +
Untitled UI Figma
        ↓
Canonical Component Contract
        ↓
Base UI / native target
        ↓
parity verification
        ↓
source-owned component library
```

The compiler may still infer components directly from Figma when no trustworthy implementation reference exists, but that is now a fallback path.

---

## 1. Core product thesis

The compiler should **reuse authoritative knowledge before generating anything**.

For a component with an official open-source implementation, do not rediscover its semantics from geometry.

Instead:

1. pin the official source revision;
2. extract its public capabilities, slots, states, behavior, accessibility expectations, and dependencies;
3. map the matching Figma component family;
4. normalize both into a canonical contract;
5. implement that contract using the selected target primitive engine;
6. verify parity against both the official reference and Figma.

For higher-level licensed Figma compositions, reuse the verified base library and generate only composition/glue/deltas.

---

## 2. Sources of truth

Different sources own different kinds of truth.

```text
Figma
→ visual truth
→ component-set identity
→ composition tree
→ tokens, layout, spacing, typography, effects
→ supported visual variants

Official open-source implementation
→ semantic reference
→ behavior reference
→ API capability reference
→ slot/reference composition
→ intended runtime states
→ dependency/reference graph

Canonical Component Contract
→ compiler-owned normalized meaning
→ implementation-engine independent

Base UI / native HTML
→ target behavior/accessibility implementation

shadcn
→ source-owned ergonomics
→ wrapper shape and registry/distribution reference
→ NOT target visual truth

Compiler
→ mapping, adaptation, generation, provenance, verification
```

When evidence conflicts, do not silently choose. Record the conflict and stop or escalate according to policy.

---

## 3. Reference priority

Resolve a component in this order:

1. exact verified local mapping;
2. pinned official reference implementation;
3. verified local target implementation;
4. verified composition of existing components;
5. target primitive mapping;
6. deterministic semantic inference from Figma;
7. typed ambiguity resolver;
8. coding model;
9. human review.

Creation is the final branch.

---

## 4. Reference-first pipeline

```text
Reference Sync
↓
Reference Index
↓
Reference Component Contract
        ↘
         Contract Reconciler ← Figma Component Family
        ↗
Figma shallow index / visual evidence
↓
Canonical Component Contract
↓
Target Adapter
(Base UI / native)
↓
Productionization Pass
↓
Reference Parity Tests
+
Figma Visual Tests
+
Behavior / Accessibility Tests
↓
Verified Registry Item
```

For components without an official reference:

```text
Figma
↓
family normalization
↓
slicing
↓
semantic inference
↓
Canonical Component Contract
↓
target adapter
↓
same verification pipeline
```

The downstream implementation and verification pipeline should remain the same.

---

## 5. Canonical Component Contract

The canonical contract is the bridge between React Aria, Base UI, native HTML, Figma, and future primitive engines.

It must not expose implementation-library-specific vocabulary unless the concept is genuinely part of the design system.

Conceptual shape:

```ts
type ComponentContract = {
  id: string
  name: string

  sources: {
    reference?: {
      library: string
      revision: string
      path: string
      license: string
    }
    figma?: {
      fileKey: string
      componentSetId: string
      componentKey?: string
    }
  }

  anatomy: ComponentAnatomyIR
  slots: SlotIR[]
  variants: VariantContract[]
  states: StateContract[]
  behaviors: BehaviorCapability[]
  accessibility: AccessibilityRequirement[]
  unsupportedCombinations: Record<string, unknown>[]

  publicApi: PublicApiPlan

  target: {
    engine: "base-ui" | "native"
    primitives: string[]
  }

  provenance: DecisionProvenance[]
}
```

The exact schema may evolve. The separation of concerns must not.

---

## 6. React Aria → Base UI is contract translation, not syntax conversion

Do not perform line-by-line or prop-name-by-prop-name translation.

Target parity means:

```text
visual outcome           1:1 where practical
functional intent        1:1
component coverage       1:1
interaction capability   1:1
accessibility outcome    1:1
API capability           equivalent

internal implementation  NOT required to be 1:1
prop spelling             NOT required to be 1:1
DOM shape                 NOT required to be 1:1 unless semantically relevant
```

Example:

```text
React Aria reference:
isDisabled
isLoading

Canonical:
disabled capability
loading capability

Base UI target:
use the target primitive/API that expresses those capabilities
```

Never preserve React-Aria-shaped APIs merely for superficial parity.

---

## 7. Untitled UI OSS is the first reference library

Pinned upstream:

```text
repository: untitleduico/react
license: MIT for files in the OSS repository
reference revision: pin an exact commit in project state
```

At the time of this architecture update, the inspected upstream main revision was:

```text
8b7409c078f81ab89dfc5943ec185ec369932804
```

Do not treat `main` as immutable. Reference manifests must pin a commit SHA.

The upstream Button currently provides useful reference evidence including:

- React Aria Button/Link behavior;
- loading state;
- disabled state;
- leading/trailing icon inputs;
- icon-only detection;
- loading spinner motion;
- button/link behavior;
- destructive variants;
- size/color vocabulary.

These facts should be indexed, not rediscovered from pixels.

---

## 8. Target implementation policy

Default target direction:

```text
behavioral primitive available in Base UI
→ Base UI

plain native semantic is sufficient and policy explicitly allows native
→ native HTML

custom behavior
→ only after Base UI/native/reference analysis
```

Shadcn Base UI wrappers are a useful implementation-shape reference.

Example principle:

```text
official Untitled UI
→ tells us what the component means

shadcn Base UI
→ shows clean Base UI wrapper ergonomics

Figma
→ tells us exactly how the target should look

our compiler
→ reconciles them
```

Do not copy shadcn visual vocabulary.

---

## 9. Figma role after the pivot

Figma remains essential.

It owns:

- exact appearance;
- variant coverage;
- component keys;
- nested component instances;
- composition;
- layout;
- tokens and effects;
- visual states;
- PRO composition structure.

However, Figma is no longer asked to explain semantics already available from a pinned official implementation.

For a reference-backed component:

```text
official source
→ semantic baseline

Figma
→ visual + structural reconciliation
```

For an unknown component:

```text
Figma
→ semantic inference fallback
```

See `REFERENCE_LIBRARY.md` and `FIGMA_SLICING.md`.

---

## 10. Licensed PRO Figma composition

A licensed PRO Figma file can be used as local compiler input to assemble higher-level components from verified base components.

Preferred flow:

```text
PRO Figma component/page
↓
nested instance graph
↓
reference/local mapping lookup
↓
replace known instances with verified base components
↓
reconstruct composition/layout
↓
generate only unknown glue/delta
↓
verify against Figma
```

Do not publish or redistribute a clone of proprietary PRO assets unless the applicable license explicitly allows it.

The compiler itself should remain generic.

See `PRO_FIGMA_COMPOSITION.md`.

---

## 11. Productionization pass

A visually correct target can still be semi-raw.

Before a component can be fully verified, run a productionization pass that rejects:

- test-only state props in the production surface;
- Figma fixture imports;
- Figma authoring vocabulary leaking into consumer API;
- Figma tracing attributes in production unless explicitly enabled;
- invalid generated CSS such as semantic `null` values;
- runtime slot guessing that can misclassify arbitrary children;
- static loading indicators when loading implies motion;
- duplicate slot APIs without a documented reason;
- unused dependencies;
- reference-library implementation details leaking into the public contract.

Production and specimen/test components must be separable.

---

## 12. Verification states

Avoid a single overly broad `VERIFIED` flag.

Recommended states:

```text
UNMAPPED
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

A component is `VERIFIED` only when all required gates pass.

A component may be `FIGMA_VISUAL_PASS` while still failing production/API quality.

---

## 13. Persistent state

Recommended project state:

```text
.design-compiler/
├── references/
│   ├── libraries.json
│   ├── untitledui/
│   │   ├── revision.json
│   │   ├── index.json
│   │   └── contracts/
├── manifest.json
├── mappings.json
├── tokens.json
├── exceptions.json
├── hashes.json
├── ir/
├── parity/
├── visual/
└── reports/
```

Do not store secrets or unnecessary full upstream repositories in authoritative compiler state.

---

## 14. Determinism and AI

AI is not the default resolver.

```text
reference exact match?
→ deterministic

known Figma component key?
→ deterministic

known canonical contract?
→ deterministic

known target adapter?
→ deterministic

visual diff?
→ deterministic

behavior parity?
→ deterministic tests

real ambiguity?
→ typed resolver/model/human
```

A mature run should often require zero model calls.

---

## 15. Current Button implementation

The current Figma-first Button implementation remains useful as:

- a visual benchmark;
- a compiler regression fixture;
- evidence that the 200-variant matrix can be normalized;
- a comparison target during the reference-first migration.

It is **not automatically the canonical production Button** after this pivot.

The next Button milestone is to compare:

```text
official Untitled UI React Button
vs
current compiled Button
vs
new Base UI target Button
```

and use the canonical contract/parity tests to decide the final production surface.

---

## 16. Canonical documentation

Read in this order:

1. `DESIGN_SYSTEM_COMPILER.md`
2. `REFERENCE_LIBRARY.md`
3. `REFERENCE_PARITY.md`
4. `API_DESIGN_POLICY.md`
5. `COMPONENT_SEMANTICS.md`
6. `PRO_FIGMA_COMPOSITION.md`
7. `ACCURACY_STRATEGY.md`
8. `MASTER_BUILD_PROMPT.md`

Older Figma-first documents are preserved under `docs/legacy/` and are historical only.
