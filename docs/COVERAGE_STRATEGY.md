# Coverage Strategy: OSS First, PRO Figma for Missing Components

## Goal

The target is **not** to port only Button or a small hand-picked subset.

The compiler should build the widest practical Untitled UI-compatible component library by combining:

```text
1. Official Untitled UI OSS React
   → primary semantic/behavior reference

2. Licensed Untitled UI PRO Figma
   → fallback design source for components/compositions not present in the OSS GitHub repository

3. Canonical contracts
   → stable engine-independent meaning

4. Base UI / native / specialized runtime adapters
   → production implementation

5. Deterministic parity validation
   → quality gate
```

Button is only the first parity canary.

---

## 1. Coverage objective

The compiler should inventory the **entire pinned Untitled UI OSS repository** and classify every relevant production surface.

Do not assume:

```text
one .tsx file = one public component
```

Classify repository content into:

```text
BASE_COMPONENT
APPLICATION_COMPONENT
COMPOUND_COMPONENT
RECIPE_OR_BLOCK
FOUNDATION
ASSET
HELPER
INTERNAL
DEMO
STORY
TEST
NON_COMPONENT
```

Only eligible production surfaces become library candidates.

Demo/story files remain useful as behavior and usage evidence, but they do not become public registry entries.

---

## 2. OSS-first rule

If a component exists in the pinned official OSS repository:

```text
OSS implementation
→ semantic and behavior reference

Figma
→ visual reconciliation

canonical contract
→ Base UI/native/specialized target

parity tests
→ verified component
```

Do not rebuild its semantics from Figma alone.

Do not ignore upstream behavior just because the Figma component looks simple.

---

## 3. PRO-Figma fallback rule

If a component or composition exists in the licensed PRO Figma but **does not exist in the OSS GitHub reference**:

```text
PRO Figma
→ family/composition discovery
→ slice representative nodes
→ reuse known OSS-derived components
→ infer only unresolved semantics
→ generate missing component/recipe/block
→ verify against Figma
```

The PRO path is a **delta compiler**, not a second full rebuild pipeline.

The more complete the OSS-derived base library becomes, the less code the PRO path should generate.

---

## 4. Resolution order for every Figma node

```text
exact verified mapping?
→ reuse

official OSS reference match?
→ reuse/port canonical contract

verified local component?
→ reuse

known composition?
→ compose

known target primitive?
→ adapt

PRO-only Figma component?
→ semantic compile from sliced evidence

unknown primitive?
→ generate as last resort
```

Known nested components must never be flattened simply because a parent is PRO-only.

---

## 5. Whole-library inventory

The reference indexer should scan the entire pinned OSS repository and produce a machine-readable inventory.

Example:

```json
{
  "library": "untitledui-react",
  "revision": "<sha>",
  "components": {
    "button": {
      "kind": "BASE_COMPONENT",
      "source": "components/base/buttons/button.tsx",
      "eligible": true
    },
    "buttons-story": {
      "kind": "STORY",
      "eligible": false,
      "evidenceOnly": true
    }
  }
}
```

The index should capture:

- path;
- exports;
- component kind;
- runtime dependencies;
- internal dependencies;
- primitive engine;
- public capabilities;
- demo/story evidence;
- license provenance;
- candidate Figma family names;
- port status;
- parity status.

---

## 6. Dependency-order porting

Do not port components randomly.

Build a dependency graph and port topologically.

Example:

```text
Button
Checkbox
Input
Tooltip
Popover-like primitives
        ↓
Dropdown / Select / Combobox
        ↓
Date Picker / Navigation / Modal / Forms
        ↓
larger application components
```

Specialized components may keep specialized dependencies when appropriate.

Examples:

```text
charts
→ charting library may remain

carousel
→ carousel engine may remain

OTP input
→ specialized input dependency may remain
```

"Target Base UI" does not mean "force every component to depend on Base UI."

---

## 7. Coverage states

Recommended status per candidate:

```text
DISCOVERED
CLASSIFIED
REFERENCE_INDEXED
CONTRACT_RESOLVED
TARGET_IMPLEMENTED
REFERENCE_PARITY_PASS
FIGMA_VISUAL_PASS
PRODUCTION_PASS
VERIFIED
NOT_ELIGIBLE
LICENSE_BLOCKED
```

At library level track:

- total eligible OSS components;
- indexed;
- contract-resolved;
- target-implemented;
- verified;
- PRO-only discovered;
- PRO-only compiled;
- unresolved.

---

## 8. Figma mapping graph

The compiler should persist:

```text
Figma component key / component-set ID
→ canonical contract
→ target component
```

Once stored, later PRO screens should resolve known children deterministically.

Example:

```text
Figma Button instance
→ Button contract
→ local Button

Figma Input instance
→ Input contract
→ local Input
```

No LLM call is needed for already-mapped instances.

---

## 9. PRO-only component classification

A component absent from OSS should be classified before generation:

```text
BASE_EXTENSION
NEW_BASE_COMPONENT
RECIPE
BLOCK
APPLICATION_COMPONENT
PAGE
FOUNDATION_OR_ASSET
```

Prefer composition over new primitives.

Example:

```text
PRO Payment Details Modal
= Dialog + Input + Select + Button + layout

→ RECIPE/BLOCK
→ do not create a new monolithic primitive
```

---

## 10. Token-efficient PRO slicing

For a PRO-only component:

```text
whole component-set URL
→ shallow index
→ known nested instance resolution
→ representative selection
→ deep-read unresolved regions only
→ semantic plan
→ implementation
```

Never deep-read all variants by default.

Known nested OSS-derived components should be treated as opaque verified dependencies.

---

## 11. Distribution and licensing

OSS files from the official repository follow the upstream OSS license.

PRO Figma material is governed separately.

Therefore:

- preserve OSS license obligations;
- record PRO provenance;
- do not publish a public clone of proprietary PRO assets unless allowed;
- support private/non-distributable registry metadata for PRO-derived output;
- keep the compiler generic and reusable for other licensed design systems.

---

## 12. Success criteria

The architecture is succeeding when:

```text
eligible OSS coverage ↑
reference reuse ↑
known Figma mapping ↑
PRO composition reuse ↑

semantic guessing ↓
raw SVG fixture leakage ↓
duplicated components ↓
AI calls ↓
generated unknown primitives ↓
```

Long-term target:

> In a PRO Figma screen, most nodes should resolve to already verified components, and the compiler should generate only the genuinely missing delta.
