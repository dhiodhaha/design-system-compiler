# Roadmap

## P0 — Full OSS inventory + reference infrastructure

Build:

- pinned reference library manifest;
- **whole-repository Untitled UI OSS inventory**;
- component/demo/story/helper classification;
- dependency graph;
- reference component contract format;
- license provenance;
- reference diff/sync flow.

Done when the entire pinned OSS repository can be indexed deterministically and every candidate is classified without sending the full repository to an LLM.

Button is selected from that inventory only as the first parity canary.

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

## P2 — Exhaustive eligible OSS component conversion

Port **all eligible production components** from the pinned Untitled UI OSS inventory in dependency order.

This includes, where eligible:

```text
base components
compound components
application components
foundations/assets
shared reusable components
```

Do not convert demo/story/test/internal files into public registry components, but keep them as reference evidence.

Use Base UI where it is the correct target primitive, native HTML where sufficient, and retain specialized runtime dependencies when they are the correct abstraction.

Prioritize dependency leaves first so later components mostly compose verified components.

Completion is measured by inventory coverage, not by a hand-picked list.

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

## P5 — PRO-only gap compiler

Use the licensed PRO Figma to discover components and compositions absent from the OSS GitHub inventory.

For each missing family:

```text
no OSS reference
→ slice Figma
→ resolve known nested components
→ classify component/recipe/block
→ generate only unresolved delta
→ verify
```

Start with one PRO component that is mostly composed of verified OSS-derived components.

Goal:

```text
>= 80% known child reuse
0 duplicated known primitives
only missing component/composition/glue generated
visual parity within configured thresholds
```

Then expand through the remaining PRO-only gap inventory.

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


## Coverage principle

The end goal is:

```text
all eligible public OSS components
+
licensed PRO-only Figma gaps
=
the widest verified local Untitled-compatible library practical
```

OSS is always preferred when an official implementation exists.

PRO Figma fills the missing surface through slicing and composition, not by replacing the OSS path.

See [COVERAGE_STRATEGY.md](./COVERAGE_STRATEGY.md).
