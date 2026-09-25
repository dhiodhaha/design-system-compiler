# CLI, npx, and MCP Direction

## Principle

One compiler core, multiple thin interfaces:

```text
compiler core
├── CLI
├── npx distribution
└── MCP
```

Do not duplicate business logic.

## Reference commands

Future canonical direction:

```bash
npx ds-compiler reference add untitledui --repo untitleduico/react --ref <sha>
npx ds-compiler reference sync untitledui
npx ds-compiler reference inspect untitledui/button
npx ds-compiler reference diff untitledui --to <sha>
```

These commands should produce compact structured contracts and provenance.

## Port commands

```bash
npx ds-compiler port button --reference untitledui --target base-ui
npx ds-compiler parity button
```

`port` means contract adaptation, not syntax rewriting.

## Figma commands

```bash
npx ds-compiler inspect "<figma-url>"
npx ds-compiler compile "<figma-url>"
npx ds-compiler verify button --figma
```

For reference-backed components, `compile` should reconcile the existing contract instead of creating semantics from scratch.

## Distribution

```bash
npx ds-compiler add button
```

The registry item should include:

- source files;
- target primitive dependency;
- token/style dependencies;
- component dependencies;
- upstream reference provenance;
- Figma mapping;
- parity status;
- license/distribution metadata.

## Shared services

Conceptual:

```ts
addReferenceLibrary()
syncReferenceLibrary()
indexReferenceComponent()
extractReferenceContract()
resolveFigmaFamily()
reconcileContract()
planTargetImplementation()
portComponent()
verifyReferenceParity()
verifyFigmaParity()
verifyProductionization()
compileComposition()
addRegistryItem()
explainDecision()
```

CLI, MCP, tests, and agents all call the same services.

## Structured output

Every important command should support `--json`.

Example:

```json
{
  "component": "Button",
  "reference": {
    "library": "untitledui",
    "revision": "<sha>",
    "status": "REFERENCE_INDEXED"
  },
  "target": {
    "engine": "base-ui",
    "status": "TARGET_IMPLEMENTED"
  },
  "parity": {
    "reference": "PASS",
    "figma": "PASS",
    "behavior": "PASS",
    "production": "PASS"
  }
}
```

## MCP context firewall

MCP should return:

- summaries;
- IDs;
- compact contract fragments;
- paginated diagnostics.

Do not dump full upstream repos or Figma trees into model context.

## Build order

1. reference manifest + indexer;
2. canonical contract schema;
3. Button reference extraction;
4. Base UI target adapter;
5. parity harness;
6. Figma reconciliation;
7. productionization gate;
8. registry/source distribution;
9. CLI UX polish;
10. MCP wrapper.

The existing Figma benchmark/compiler may remain as a fallback subsystem.

## Explainability

`explain` should show:

- reference source and revision;
- Figma evidence;
- canonical contract decision;
- target primitive mapping;
- API adaptation;
- behavior delta;
- visual delta;
- confidence;
- license provenance.

## Product thesis

The CLI makes the compiler reproducible.

The reference layer makes semantics reusable.

The parity layer makes primitive migration safe.

The registry makes output source-owned.

The MCP makes the compiler agent-native.
