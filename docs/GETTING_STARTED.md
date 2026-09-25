# Getting Started

## Current project direction

This project is reference-first.

For Untitled UI, the intended first workflow is:

```text
pin official OSS React
→ index component
→ extract canonical contract
→ port/adapt to Base UI
→ verify against reference
→ verify against Figma
→ productionize
→ register source-owned component
```

## 1. Clone

```bash
git clone https://github.com/dhiodhaha/design-system-compiler.git
cd design-system-compiler
pnpm install
```

## 2. Read canonical docs

Start with:

```text
docs/DESIGN_SYSTEM_COMPILER.md
docs/REFERENCE_LIBRARY.md
docs/REFERENCE_PARITY.md
docs/API_DESIGN_POLICY.md
docs/MASTER_BUILD_PROMPT.md
```

Do not use `docs/legacy/` as active instructions.

## 3. Reference pin

Current inspected Untitled UI OSS reference:

```text
repo: untitleduico/react
revision: 8b7409c078f81ab89dfc5943ec185ec369932804
license: MIT for files included in that OSS repository
```

Future CLI direction:

```bash
npx ds-compiler reference add untitledui \
  --repo untitleduico/react \
  --ref 8b7409c078f81ab89dfc5943ec185ec369932804
```

## 4. First reference contract

Start with Button.

Inspect only the relevant upstream source and its material helpers/dependencies.

Extract:

- sizes/variants;
- slots/icons;
- disabled/loading;
- link/button behavior;
- spinner/motion;
- accessibility/keyboard capability;
- source path/revision/license.

Write a compact reference contract.

## 5. Reconcile with Figma

Use the Button component set to determine:

- exact visual variants;
- supported combinations;
- Figma component key;
- visual states;
- tokens;
- dimensions;
- nested placeholder fixtures.

Do not rediscover button/link/loading semantics from geometry if upstream already supplies them.

## 6. Base UI target

Create a target implementation plan from the canonical contract.

Do not perform direct text conversion from React Aria source.

Use Base UI primitives where selected by the adapter policy.

Use shadcn Base UI wrappers as a structural/ergonomic reference only.

## 7. Parity

Run:

```text
reference capability tests
Figma visual tests
behavior tests
accessibility tests
productionization tests
```

Only then can the target become canonical.

## 8. Current Button

The existing Figma-first Button is a benchmark, not necessarily the final production API.

Compare it against:

- official Untitled UI Button;
- canonical contract;
- new Base UI target.

Keep useful visual rule mining and discard semi-raw API artifacts.

## 9. PRO Figma

After enough base components are verified:

```text
PRO Figma component
→ map nested known instances
→ reuse verified library
→ generate only composition/glue
→ verify
```

Do not publish proprietary PRO-derived blocks unless the source license permits it.

## 10. Figma access

Set local credentials without committing them.

Example:

```bash
export FIGMA_TOKEN="..."
```

Use direct REST, Figma MCP, or another adapter as available.

## 11. Development commands

Current repo commands remain:

```bash
pnpm compile
pnpm test
pnpm verify
```

They currently exercise the Figma-first Button benchmark.

The next implementation milestone should add reference-index/parity commands without breaking the benchmark.

## 12. Next engineering slice

```text
P0:
reference manifest + Untitled UI Button contract

P1:
Base UI Button target + parity harness

P2:
expand to free base components

P3:
first PRO composition
```

See `ROADMAP.md`.
