# Design System Compiler

A reference-first compiler for turning design-system sources into verified, source-owned React components.

## Direction

```text
official implementation reference
+
Figma visual/composition source
+
canonical component contract
+
Base UI/native target
↓
verified component library
```

The first reference target is Untitled UI React.

The project is migrating from an earlier Figma-first proof of concept to:

```text
Untitled UI OSS React (React Aria)
→ extract semantic contract
→ implement with Base UI
→ compare 1:1 by capability/behavior
→ verify visual parity against Figma
→ reuse the verified base library for licensed PRO Figma compositions
```

"1:1" means equivalent capability, behavior, accessibility outcome, and visual result where applicable. It does **not** mean line-by-line source conversion or identical prop names.

## Current benchmark

The repository already contains a Figma-first Button experiment with a 200-variant matrix and deterministic visual/behavior checks.

That implementation remains a benchmark while the new reference-first Button becomes the canonical target.

## Browsing what exists

`pnpm dev`, then:

| page | shows |
| --- | --- |
| `/catalog.html` | **every component** — all registry items with live previews, search, layer/tier filters and group navigation, plus the PRO compositions and Figma-verified canaries |
| `/adopted.html` | the adopted official Button specimen (source-owned) |
| `/parity.html` | rendered output against the recorded Figma reference |
| `/pro.html` | PRO compositions (Content item, Check item text, Help icon) |
| `/behavior.html` | behaviour states (hover/focus/disabled) |
| `/specimen.html`, `/grid.html` | geometry specimen and the Figma-first benchmark matrix |

Machines read the same facts from:

| file | contents |
| --- | --- |
| `.design-compiler/catalog.json` | the catalog page's index: 293 items with module, export, tier, status, group, install command (`pnpm catalog:build`) |
| `.design-compiler/registry/index.json` | authoritative registry index — membership, tier, layer, installability |
| `.design-compiler/references/untitledui/index.json` | source inventory: exports, kinds, dependencies, Figma name candidates |
| `.design-compiler/references/untitledui/pro-gap-compile.json` | PRO gap status board |
| `.design-compiler/report.json` | reconciliation and consistency report |

`pnpm verify:library` reconciles state, runs consistency, rebuilds the catalog (failing if it drifts from the registry index) and runs the full verification chain.

## Documentation

Start at [docs/README.md](docs/README.md).

Important:

- [Architecture](docs/DESIGN_SYSTEM_COMPILER.md)
- [Reference library](docs/REFERENCE_LIBRARY.md)
- [Reference parity](docs/REFERENCE_PARITY.md)
- [PRO Figma composition](docs/PRO_FIGMA_COMPOSITION.md)
- [Roadmap](docs/ROADMAP.md)
- [Master build prompt](docs/MASTER_BUILD_PROMPT.md)

Historical docs are under `docs/legacy/`.

## Current upstream reference

Official Untitled UI OSS React:

```text
https://github.com/untitleduico/react
```

The compiler must pin an exact revision before extracting contracts.

## Core principles

- reuse before generation;
- reference semantics before inference;
- Figma for visual/composition truth;
- Base UI/native for target behavior;
- shadcn for source-owned ergonomics and registry patterns;
- deterministic parity before model judgement;
- generate only the unknown delta;
- preserve license provenance.


## Coverage target

Button is only the first parity canary.

The intended library scope is:

```text
all eligible production components
from the pinned Untitled UI OSS repository
+
components/recipes/blocks that exist only
in the user's licensed Untitled UI PRO Figma
```

If a component exists in OSS, use the official code as semantic/behavior reference.

If it does not exist in OSS, slice it from the licensed PRO Figma, reuse all known nested components, and generate only the missing delta.

See [docs/COVERAGE_STRATEGY.md](docs/COVERAGE_STRATEGY.md).
