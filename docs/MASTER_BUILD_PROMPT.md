# Master Build Prompt

## Mission

Build a **reference-first design system compiler**.

For components with an authoritative open-source implementation, extract and reuse its semantic contract before analyzing Figma for semantics.

The first supported reference library is Untitled UI React.

Target implementation direction:

```text
Untitled UI OSS React / React Aria
→ canonical contract
→ Base UI or native target
→ parity verification
```

Figma remains the visual and composition source of truth.

## Read first

Before architectural work, read:

1. `docs/DESIGN_SYSTEM_COMPILER.md`
2. `docs/REFERENCE_LIBRARY.md`
3. `docs/REFERENCE_PARITY.md`
4. `docs/API_DESIGN_POLICY.md`
5. `docs/COMPONENT_SEMANTICS.md`
6. `docs/ACCURACY_STRATEGY.md`

Do not use files under `docs/legacy/` as current instructions.

## Global rules

1. Prefer a pinned official reference implementation over semantic guessing.
2. Pin references by commit SHA. Never reason against floating `main` as authoritative memory.
3. Figma owns visual truth and composition.
4. The official reference owns semantic/behavior evidence where it exists.
5. Normalize meaning into a canonical contract before target implementation.
6. React Aria → Base UI is contract translation, not source-to-source syntax conversion.
7. shadcn is an ergonomics/registry/wrapper-shape reference, not visual truth.
8. Generate only the delta that cannot be reused.
9. Known nested Figma component instances must resolve to known components before raw HTML generation.
10. Test/specimen fixtures must not leak into production.
11. Production code must not expose test-only state controls.
12. Deterministic checks happen before model judgement.
13. Preserve provenance for important decisions.
14. If evidence conflicts, stop rather than silently invent.
15. Respect upstream and PRO licensing boundaries.

## Reference preflight

Before reading Figma deeply:

1. inspect `.design-compiler/references/libraries.json`;
2. resolve the candidate reference library;
3. confirm the pinned commit;
4. look for an indexed component contract;
5. inspect the smallest relevant upstream source files;
6. record upstream path, revision, and license;
7. only then inspect Figma for mapping/visual reconciliation.

If no reference exists, enter inference fallback mode.

## Untitled UI reference policy

For Untitled UI OSS:

```text
repository: untitleduico/react
license: MIT for files in that repository
engine: React Aria
target engine: Base UI / native according to target policy
```

Do not assume PRO React source is available or MIT.

Do not copy proprietary PRO content into a public registry.

## Reference Scout

Responsibilities:

- index upstream components;
- record exports and public capabilities;
- record primitive dependencies;
- record slots/content patterns;
- record state/behavior capability;
- record implementation path and commit;
- extract a compact ReferenceContract candidate.

Do not:

- redesign the public API;
- copy entire upstream repository into model context;
- infer Figma visuals from source classes when Figma evidence exists.

Output should be compact structured data.

## Figma Scout

Responsibilities:

- map Figma component/component-set identity;
- enumerate axes and supported combinations;
- capture component keys and nested references;
- extract visual/token/layout evidence;
- produce representative reads only when needed;
- record composition graph for PRO components.

Do not rediscover semantics already established by the reference unless reconciling a conflict.

## Contract Reconciler

Inputs:

- ReferenceContract;
- Figma family/composition IR;
- existing local manifest;
- target engine policy.

Responsibilities:

- create/update Canonical Component Contract;
- map reference capabilities to Figma variants;
- classify mismatches;
- identify missing reference capabilities;
- choose target primitive;
- produce PublicApiPlan;
- record provenance/confidence.

Required classifications:

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

## Target Implementer

The Implementer receives:

- canonical contract;
- approved PublicApiPlan;
- minimal upstream reference source;
- target primitive documentation/source;
- relevant Figma visual rules/tokens;
- existing local component source.

Rules:

- implement the contract, not the upstream syntax;
- use Base UI primitives where the selected target adapter requires them;
- preserve target framework independence;
- use shadcn-like wrapper ergonomics only when compatible with the contract;
- keep visual vocabulary from Figma;
- avoid authoring-only/test-only props;
- do not hard-code fixtures;
- do not use runtime child-position guessing unless explicitly approved by the contract.

## Productionization Gate

Before parity verification, assert:

```text
no invalid generated CSS
no semantic null values emitted
no fixture import in production
no test-only state prop in production
no unnecessary Figma trace attribute
no duplicate slot API without rationale
loading behavior is actually functional
motion respects reduced-motion policy
unused dependencies removed
public API matches approved contract
```

Failure blocks `PRODUCTION_PASS`.

## Reference Parity Validator

Compare target implementation with the pinned official reference for capabilities the reference actually defines.

Test:

- public capability coverage;
- default behavior;
- disabled behavior;
- loading behavior;
- icon/slot behavior;
- link/navigation behavior where applicable;
- keyboard behavior;
- focus semantics;
- accessible naming/roles;
- relevant controlled/uncontrolled semantics.

Do not demand identical DOM or prop names unless the contract explicitly requires them.

## Figma Visual Validator

Use deterministic rendering:

- fixed browser;
- fixed viewport;
- fixed DPR;
- pinned fonts;
- stable color scheme;
- motion frozen for static captures;
- geometry/computed styles;
- screenshot diff;
- mismatch regions.

For interaction states, trigger real behavior when possible.

Forced specimen states belong in the test harness, not production API.

## PRO Composition Compiler

For licensed PRO Figma:

1. traverse nested component instances;
2. resolve every known base mapping;
3. preserve known components;
4. reconstruct layout/composition;
5. generate only unknown glue or genuine new semantic pieces;
6. keep output local/private if the license does not permit redistribution;
7. verify against Figma.

Do not flatten known components into divs.

## AI / Jev policy

Use deterministic/reference resolution first.

Use a model only when:

- reference and Figma disagree semantically;
- target-engine mapping is genuinely ambiguous;
- a new component has no usable reference;
- contract decomposition is unclear.

Jev may make typed decisions. It must not generate production code.

## Required completion report

Report:

- reference library/revision used;
- upstream files inspected;
- license classification;
- Figma scopes read;
- mappings reused;
- canonical contract changes;
- target primitive mapping;
- files changed;
- API adaptations;
- behavior deltas;
- visual deltas;
- parity results;
- productionization results;
- AI/Jev calls;
- unresolved ambiguity;
- next smallest slice.

## Current next milestone

Do not continue polishing the old Figma-first Button blindly.

The next milestone is:

```text
pin Untitled UI OSS
→ index Button
→ extract Button reference contract
→ compare current compiler Button
→ implement/port Base UI target
→ run reference parity
→ run Figma parity
→ productionization pass
→ decide canonical Button
```
