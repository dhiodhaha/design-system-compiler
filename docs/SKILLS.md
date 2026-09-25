# Agent Skills and Routing

Skills are optional accelerators, not compiler architecture.

## Main rule

Do not load every skill into every agent.

The reference-first pipeline reduces the amount of semantic guessing agents should perform.

## Reference Scout

Useful capabilities:

- GitHub/source inspection;
- TypeScript/React API analysis;
- dependency graph inspection.

Responsibilities:

- inspect pinned upstream component;
- extract compact capabilities;
- identify material helpers/dependencies;
- preserve revision/license provenance.

No Figma skill is necessary for this role.

## Figma Scout

Possible skills:

- `figma-analyze-component-set`;
- `figma-deep-component`;
- `figma-export-tokens`;
- later `figma-check-design-parity`.

Use only when compatible with the available Figma runtime.

The project's own adapter remains authoritative.

## Target Adapter / React Architecture

Useful:

- Base UI documentation/source;
- shadcn Base UI wrappers;
- `vercel-composition-patterns`;
- shadcn skill when useful for registry/source-owned patterns.

Important:

```text
official Untitled UI
→ semantic reference

Base UI
→ target primitive

shadcn
→ target wrapper ergonomics

Figma
→ visual truth
```

Do not let shadcn override the Untitled UI/Figma contract.

## Validator

Useful:

- browser testing;
- visual parity tooling;
- accessibility tooling.

Deterministic repo scripts remain authoritative.

## Agent topology

Recommended:

```text
Lead
├── Reference Scout
├── Figma Scout
├── Contract Reconciler
├── Target Implementer
└── Parity Validator
```

For PRO composition:

```text
Lead
├── Composition Scout
├── Resolver
├── Implementer
└── Validator
```

## Context policy

Pass compact artifacts:

```text
Reference Scout → reference.contract.json
Figma Scout     → figma.family.json
Reconciler      → canonical.contract.json
Implementer     → patch
Validator       → parity report
```

Do not forward full repository/Figma transcripts.

## Model routing

Cheap/fast model:

- classification;
- metadata;
- simple contract diffs;
- test-log classification.

Strong coding model:

- target adapter implementation;
- cross-component refactor;
- complex Base UI integration;
- compiler core changes.

Typed ambiguity resolver:

- genuine contract conflict;
- component vs recipe;
- accepted behavior delta.

## Motion

Reference runtime behavior may be valid motion evidence.

Figma static imagery alone is not.

Priority:

1. pinned official reference behavior;
2. Figma prototype/annotation;
3. verified project motion token;
4. conservative fallback.

## Failure rule

If a skill disappears, the compiler's structured reference/contract/parity pipeline must still work.
