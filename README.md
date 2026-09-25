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
