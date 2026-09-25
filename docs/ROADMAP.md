# Roadmap

## P0 — Reference infrastructure

Build:

- pinned reference library manifest;
- Untitled UI OSS indexer;
- reference component contract format;
- license provenance;
- reference diff/sync flow.

Done when Button can be indexed from a pinned upstream commit without sending the entire repository to an LLM.

## P1 — Button parity migration

Use Button as the first contract migration.

Compare:

```text
official Untitled UI React Button
vs
current Figma-first Button benchmark
vs
new Base UI target Button
```

Required:

- canonical Button contract;
- target adapter;
- loading motion;
- button/link capability;
- icon capability;
- disabled/focus behavior;
- Figma visual parity;
- productionization pass;
- no test-only state prop in production;
- no invalid generated CSS.

## P2 — Free base library

Port/index a practical base set.

Suggested order:

```text
Button
Checkbox
Input
Tooltip
Dialog/Modal primitive
Select
Combobox
Dropdown/Menu
Radio
Switch
```

Prioritize components that unlock higher-level PRO compositions.

## P3 — Reference registry

Create source-owned registry output:

- component files;
- dependency graph;
- token dependencies;
- target primitive dependencies;
- upstream revision provenance;
- parity status.

## P4 — Figma mapping graph

Map Figma component keys to canonical contracts and target components.

Known instance resolution should require zero AI.

## P5 — First PRO composition

Pick one licensed PRO component that is mostly composed of verified base components.

Goal:

```text
>= 80% known child reuse
0 duplicated known primitives
only composition/glue generated
visual parity within configured thresholds
```

## P6 — Production composition compiler

Add:

- recipe/block/page classifications;
- responsive layout extraction;
- nested reference resolution;
- private distribution metadata;
- composition regression tests.

## P7 — Generic fallback compiler

Strengthen the Figma-only path for design systems without official code.

Reuse the existing:

- family invariant;
- slicing;
- semantic inference;
- visual validator;
- token memory.

Reference-first remains preferred when a trustworthy source exists.

## P8 — CLI / npx

Commands should expose the shared core.

Target direction:

```bash
npx ds-compiler reference add ...
npx ds-compiler reference sync ...
npx ds-compiler reference inspect ...
npx ds-compiler port button --target base-ui
npx ds-compiler parity button
npx ds-compiler compile "<figma-url>"
npx ds-compiler verify button
npx ds-compiler add button
```

## P9 — MCP

Expose compact agent-facing tools over the same services.

Do not duplicate compiler logic in MCP.

## P10 — Broader design-system references

Only after the Untitled UI path is proven, consider adapters for other design systems.

The architecture should remain generic; no Untitled-specific assumption should enter the canonical contract layer unless the concept is genuinely universal.
