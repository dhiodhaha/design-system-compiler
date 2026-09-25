# Reference Library

## Purpose

A Reference Library stores authoritative implementation evidence that can eliminate semantic guessing.

The first library is the official Untitled UI open-source React repository.

```text
https://github.com/untitleduico/react
```

Files in that repository are currently declared MIT-licensed by the upstream project. PRO assets are explicitly outside that OSS license.

## Why reference-first

Figma is excellent at describing appearance and composition, but a static component set cannot always reveal:

- button-vs-link behavior;
- async/loading semantics;
- keyboard behavior;
- controlled/uncontrolled state;
- focus management;
- interaction contracts;
- hidden accessibility behavior;
- intended API capability.

If the design-system author publishes code, that code is stronger semantic evidence than reconstructing those facts from geometry.

## Pinning

Never index a floating branch as authoritative memory.

Store:

```json
{
  "id": "untitledui-react",
  "repository": "untitleduico/react",
  "revision": "8b7409c078f81ab89dfc5943ec185ec369932804",
  "license": "MIT",
  "scope": "files included in the OSS repository"
}
```

The revision above is the inspected reference at the time this document was written. A future sync may update it deliberately.

## Suggested state

```text
.design-compiler/references/
├── libraries.json
└── untitledui/
    ├── revision.json
    ├── index.json
    └── contracts/
        ├── button.json
        ├── checkbox.json
        ├── input.json
        ├── select.json
        └── tooltip.json
```

Store compact normalized metadata, not giant source dumps.

## Reference index

Conceptual entry:

```ts
type ReferenceComponentIndex = {
  id: string
  library: string
  revision: string
  path: string
  exports: string[]
  dependencies: string[]
  primitiveEngine?: string
  capabilities: string[]
  candidateFigmaNames: string[]
  license: string
}
```

## Reference contract extraction

The extractor should identify:

- public component/export names;
- props/capabilities;
- slots/content anatomy;
- states;
- link/navigation behavior;
- async/loading behavior;
- accessibility-related behavior;
- compound components;
- dependencies;
- helper hooks/utilities that materially affect behavior;
- styling hooks only as supporting evidence.

Do not preserve implementation-specific prop names automatically.

## Untitled UI Button example

The inspected upstream Button currently provides evidence for:

```text
sizes
color variants
destructive variants
leading icon
trailing icon
icon-only detection
disabled state
loading state
show/hide text while loading
animated loading spinner
button behavior
link behavior through href
React Aria primitives
```

This is a semantic baseline.

The canonical target may rename/adapt the API while preserving capability.

## Mapping reference → Figma

Mapping signals:

1. explicit known mapping;
2. Figma component key;
3. component-set name;
4. variant vocabulary;
5. anatomy/slots;
6. nested component references;
7. size/state coverage;
8. visual similarity only as a weaker signal.

Once verified, store the mapping so later compiles do not reason again.

## Reference mismatch handling

Classify differences:

```text
MATCH
VISUAL_DELTA
API_ADAPTATION
BEHAVIOR_DELTA
REFERENCE_ONLY
FIGMA_ONLY
AMBIGUOUS
LICENSE_BLOCKED
```

Examples:

```text
upstream has destructive Button but selected Figma set does not
→ REFERENCE_ONLY
→ do not invent it for this family automatically

Figma has a visual state that upstream source lacks
→ FIGMA_ONLY
→ determine whether it is visual-only or missing behavior

upstream uses React Aria Link for href
→ API/behavior evidence
→ target adapter must preserve navigation capability
```

## License boundary

Reference metadata must record license provenance.

Do not assume:

```text
Untitled UI brand
→ everything is MIT
```

Correct rule:

```text
file exists in pinned OSS repository under its MIT license
→ may be used under MIT terms

PRO design/code not included in OSS repository
→ separate license
→ do not redistribute as open-source clone unless permitted
```

Preserve required copyright/license notices when copying substantial OSS code.

## Sync command direction

Future CLI:

```bash
npx ds-compiler reference add untitledui \
  --repo untitleduico/react \
  --ref 8b7409c078f81ab89dfc5943ec185ec369932804

npx ds-compiler reference sync untitledui
npx ds-compiler reference inspect untitledui/button
```

A sync should show what changed before replacing verified contracts.


## Exhaustive OSS inventory

Button is only the first parity canary.

The intended scope is to inventory and classify the **entire pinned Untitled UI OSS repository**, then port every eligible production component in dependency order.

The indexer should distinguish:

```text
production component
compound component
application component
recipe/block
foundation/asset
helper/internal
demo/story/test
```

Demo/story files are evidence sources, not registry components.

The target is not "a few representative components." The target is maximum practical coverage of eligible OSS components.

When a component exists in OSS, use the official implementation as semantic/behavior reference.

When a component exists only in licensed PRO Figma, switch to the PRO fallback path described in [COVERAGE_STRATEGY.md](./COVERAGE_STRATEGY.md) and [PRO_FIGMA_COMPOSITION.md](./PRO_FIGMA_COMPOSITION.md).
