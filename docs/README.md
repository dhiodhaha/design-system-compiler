# Documentation

This directory contains the canonical documentation for the Design System Compiler.

## Current architecture

The project is **reference-first**.

```text
official reference implementation
+
Figma visual/composition truth
↓
canonical component contract
↓
Base UI/native target
↓
reference parity + Figma parity
↓
source-owned verified components
```

## Read in this order

1. [Architecture](DESIGN_SYSTEM_COMPILER.md)
2. [Reference library](REFERENCE_LIBRARY.md)
3. [Reference parity](REFERENCE_PARITY.md)
4. [API design policy](API_DESIGN_POLICY.md)
5. [Component semantics](COMPONENT_SEMANTICS.md)
6. [Component family invariants](COMPONENT_FAMILY_INVARIANTS.md)
7. [PRO Figma composition](PRO_FIGMA_COMPOSITION.md)
8. [Accuracy strategy](ACCURACY_STRATEGY.md)
9. [Roadmap](ROADMAP.md)
10. [Master build prompt](MASTER_BUILD_PROMPT.md)

Supporting docs:

- [Figma slicing](FIGMA_SLICING.md)
- [Getting started](GETTING_STARTED.md)
- [CLI/MCP](CLI_AND_MCP.md)
- [Prerequisites](PREREQUISITES.md)
- [Skills](SKILLS.md)
- [Documentation audit](DOCS_AUDIT_2026-09-25.md)

## Legacy

Historical Figma-first documents live under [legacy](legacy/).

They explain how the project reached the current architecture, but they are **not active instructions**.

## Current reference target

The first reference library is the official Untitled UI open-source React repository, pinned by commit in compiler state.

The target migration direction is:

```text
Untitled UI React / React Aria
→ canonical contract
→ Base UI implementation
```

Figma remains the visual source of truth.

Shadcn remains an ergonomics/registry reference, not a visual source.
