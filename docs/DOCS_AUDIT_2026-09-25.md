# Documentation Audit — 2026-09-25

## Reason for audit

The project direction changed from:

```text
Figma-first semantic inference
```

to:

```text
reference-first semantic extraction
+
Figma visual/composition truth
+
Base UI target
```

The documentation was scanned before this migration.

## Findings

### Duplicates

The repository root contained:

- `DESIGN_SYSTEM_COMPILER.md`
- `MASTER_BUILD_PROMPT.md`

They were byte-identical to the corresponding files under `docs/`.

Action:

- preserve one historical copy under `docs/legacy/figma-first-v1/`;
- remove root duplicates;
- use `docs/` as canonical documentation location.

### Existing archive

`docs/archive/` contained two older pre-v1 documents.

Action:

- move them under `docs/legacy/pre-v1/`;
- remove the old archive filenames to avoid implying they are current.

### Still-current concepts

These remain useful after the pivot:

- component-family invariants;
- Figma slicing for visual/inference fallback;
- semantic slots/fixtures;
- deterministic visual QA;
- accuracy/provenance;
- CLI/MCP shared-core direction;
- token-efficient context;
- source-owned distribution;
- optional agent skills.

They should be updated, not discarded.

### Superseded assumptions

These assumptions are no longer primary:

- derive component semantics from Figma before checking an official implementation;
- design the public API mainly from Figma + shadcn heuristics;
- treat the Figma-first generated Button as automatically canonical once visual/behavior tests pass;
- use shadcn as the main external API teacher when an official implementation exists.

They remain useful only for fallback compilation.

## New canonical model

```text
pinned official implementation
→ reference contract

Figma
→ visual/composition reconciliation

canonical component contract
→ engine-independent meaning

Base UI/native adapter
→ target implementation

shadcn
→ wrapper/registry ergonomics

parity + productionization
→ verified component
```

## Canonical docs after migration

- `DESIGN_SYSTEM_COMPILER.md`
- `REFERENCE_LIBRARY.md`
- `REFERENCE_PARITY.md`
- `API_DESIGN_POLICY.md`
- `COMPONENT_SEMANTICS.md`
- `COMPONENT_FAMILY_INVARIANTS.md`
- `FIGMA_SLICING.md`
- `PRO_FIGMA_COMPOSITION.md`
- `ACCURACY_STRATEGY.md`
- `ROADMAP.md`
- `GETTING_STARTED.md`
- `CLI_AND_MCP.md`
- `PREREQUISITES.md`
- `SKILLS.md`
- `MASTER_BUILD_PROMPT.md`

Files under `docs/legacy/` are historical and must not be used as active agent instructions.
