# Design System Compiler

A reusable, token-efficient Figma-to-React design system compiler.

The project is intentionally **not** a one-shot "Figma screenshot to JSX" generator. Its goal is to compile a real Figma design system into a reusable React design system, preserve component reuse, verify visual fidelity deterministically, and reduce AI usage as the system learns.

## Core idea

```text
Figma component set
        ↓
cheap structural discovery
        ↓
Design System IR
        ↓
slice planner
        ↓
representative deep reads only
        ↓
semantic resolver
        ↓
reuse / extend / compose / create
        ↓
React + Tailwind CSS 4 + CVA + Base UI
        ↓
Playwright + geometry + pixel diff
        ↓
verified manifest + cache
```

A mature project should require **less AI over time**, not more.

## Current architecture goals

- Pixel-perfect output against Figma references.
- One reusable React component instead of one component per Figma variant.
- Figma states such as hover/focus become CSS/browser states when appropriate.
- Existing verified components are reused before generating anything new.
- Large Figma component sets are sliced before verbose retrieval.
- Unsupported Figma combinations remain unsupported; the compiler does not invent them.
- Core components stay framework-agnostic and can be consumed by TanStack Start, Next.js, Vite React, and React Router.
- Components are distributed as editable source, inspired by shadcn's source-owned model.
- Base UI is the preferred behavioral primitive layer where a primitive is actually needed.
- Jev is optional and only handles genuinely ambiguous typed decisions.
- OMP/subagents are used as scoped workers, not as copies of the same giant context.

## Documentation

- [Architecture](docs/DESIGN_SYSTEM_COMPILER.md)
- [Agent / harness operating prompt](docs/MASTER_BUILD_PROMPT.md)
- [Prerequisites](docs/PREREQUISITES.md)
- [Getting started](docs/GETTING_STARTED.md)
- [Skill routing](docs/SKILLS.md)
- [CLI, npx, and MCP product direction](docs/CLI_AND_MCP.md)
- [Figma slicing and variant compilation](docs/FIGMA_SLICING.md)
- [Component family invariants](docs/COMPONENT_FAMILY_INVARIANTS.md)
- [Component semantic pass](docs/COMPONENT_SEMANTICS.md)
- [Accuracy strategy](docs/ACCURACY_STRATEGY.md)
- [API design policy](docs/API_DESIGN_POLICY.md)

## Recommended implementation stack

```text
React
TypeScript
Base UI
Tailwind CSS 4
CVA
Zod
Playwright
pixelmatch and/or SSIM
Figma REST / Figma MCP adapters
Codex / DeepSeek for implementation work
Jev only for ambiguous typed decisions
```

## Product direction

The recommended product shape is:

```text
                    compiler core
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
         CLI          npx UX           MCP
 deterministic      zero-install     agent-facing
 local runtime        commands        tool layer
```

The CLI should be the canonical execution engine. The MCP server should wrap the same compiler APIs rather than reimplementing them.

Example future UX:

```bash
npx ds-compiler init
npx ds-compiler inspect "<figma-component-set-url>"
npx ds-compiler compile button
npx ds-compiler verify button
npx ds-compiler add button
```

These command names are a proposal, not a claim that they are already implemented.

## Project status

The architecture has been validated with a Button proof of concept: a reusable React/CVA component can be driven from normalized Figma IR and verified with deterministic visual comparison. The next milestone is proving that one verified base can expand across the supported variant matrix through deltas rather than rebuilding every variant from scratch.

## Principle

> Figma is the visual source of truth. The manifest is the compiler's authoritative memory. Deterministic code decides what it can. AI only handles what remains uncertain or requires implementation.


## Hard component-family invariant

A Figma component set is treated as **one component family by default**. Child variants such as Default, Hover, Focused, Disabled, Loading, size variants, and hierarchy variants must not independently generate public React components.

Code generation is blocked until the family is normalized and every variant axis is classified into public variants, CSS/browser states, runtime/native states, composition, internal dimensions, or unsupported constraints.

See [Component family invariants](docs/COMPONENT_FAMILY_INVARIANTS.md).


## Semantic fidelity

Pixel-perfect is necessary but not sufficient. Before code generation, the compiler must understand component anatomy, slots, behavior, accessibility obligations, public API shape, and the difference between Figma fixtures and production semantics.

For example, placeholder circles around a Button label may be visual fixtures for leading/trailing icon slots. They may be rendered in visual tests, but they must not automatically become hard-coded production children.

See [Component semantic pass](docs/COMPONENT_SEMANTICS.md) and [Accuracy strategy](docs/ACCURACY_STRATEGY.md).


## Reference policy

The compiler deliberately separates sources of truth:

~~~text
Figma            → visual truth
shadcn           → API ergonomics + source-distribution reference
native / Base UI → behavior + accessibility foundation
our compiler     → semantic translation + verification
~~~

Shadcn styles must not be copied as the target appearance. Figma properties must not be translated 1:1 into React props. The compiler should synthesize a semantic, composition-first, source-owned API.

See [API design policy](docs/API_DESIGN_POLICY.md).
