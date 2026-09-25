# Design System Compiler

## Status

Architecture specification.

Primary target:

> Compile structured Figma design systems into visually faithful, reusable, framework-agnostic React source components while minimizing duplicated work and LLM usage.

---

# 1. Product Definition

This project is a **Design System Compiler**.

It is not primarily:

* screenshot-to-code
* landing-page generation
* Figma frame export
* AI website builder

The compiler learns the project's explicit design-system structure and produces reusable production components.

The target developer experience is conceptually similar to:

```bash
npx ds add button
npx ds add dialog
npx ds add card
```

The resulting source belongs to the consuming project.

---

# 2. Primary Outcomes

The project optimizes for five outcomes:

### Visual fidelity

Implementation should converge automatically toward the Figma source with minimal manual tweaking.

### Reuse

Existing verified components must be preferred over generated code.

### Portability

Core components must work across React frameworks.

### Token efficiency

Repeated model reasoning must decrease as the design system becomes more mature.

### Inspectability

Every important mapping, decision, exception, and validation result must be observable outside an LLM prompt.

---

# 3. Target Stack

```text
React
TypeScript
Base UI
Tailwind CSS 4
Zod
CVA when beneficial
Playwright
```

AI:

```text
Codex
DeepSeek
Jev later where justified
```

No Radix dependency should be introduced for primitives already covered by Base UI.

---

# 4. React Portability

The core design system is React-specific but framework-independent.

Supported consumers:

```text
Next.js
TanStack Start
Vite React
React Router applications
```

Core DS code must not import:

```text
next/*
@tanstack/react-router
@tanstack/start
```

Framework functionality must live behind adapters or composition.

Example:

```text
packages/
├── ui/
├── adapters/
│   ├── next/
│   └── tanstack/
└── registry/
```

---

# 5. Source Distribution

Prefer a shadcn-like distribution model.

The consumer should receive editable source code such as:

```text
src/components/ui/button.tsx
src/components/ui/card.tsx
src/components/ui/dialog.tsx
```

Advantages:

* no opaque design-system package
* easy local customization
* better Codex/DeepSeek repository visibility
* framework independence
* simple component ownership

A shared package may exist later, but source distribution remains a first-class output.

---

# 6. Base UI

Base UI is the behavioral primitive foundation.

Base UI owns:

```text
accessibility
keyboard interaction
focus
state
selection
popup behavior
dismissal
interaction mechanics
```

Our DS owns:

```text
component API
visual language
tokens
variants
motion presentation
composition
Figma mappings
```

Resolution priority:

```text
verified DS component
↓
verified DS variant
↓
composition
↓
Base UI primitive
↓
native HTML
↓
custom implementation
```

---

# 7. Compiler Architecture

```text
                         FIGMA
                           │
                    Figma Adapter
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
       metadata         variables        visual
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                   NORMALIZATION
                           │
                 ┌─────────┼─────────┐
                 ▼         ▼         ▼
             DesignIR   TokenIR   MotionIR
                 │         │         │
                 └─────────┼─────────┘
                           ▼
                  Component Resolver
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
      reuse              compose            missing
                                                │
                                                ▼
                                         AI generation
        └──────────────────┬───────────────────┘
                           ▼
                     React source
                           │
                           ▼
                       Playwright
                           │
               ┌───────────┴───────────┐
               ▼                       ▼
           Structural QA           Visual QA
               │                       │
               └───────────┬───────────┘
                           ▼
                     PASS / FAILURE
                           │
               ┌───────────┴───────────┐
               ▼                       ▼
             finish              targeted repair
                                       │
                                       └──────↺
```

---

# 8. Intermediate Representations

The compiler should use multiple focused IRs rather than one giant document.

## DesignIR

Represents semantic design-system structures.

## TokenIR

Represents:

```text
colors
spacing
radius
typography
shadow
motion tokens
```

## LayoutIR

Represents:

```text
flow
alignment
dimensions
gaps
padding
responsive relationships
```

## ComponentIR

Represents:

```text
semantic role
variant
state
children
composition
token references
behavior requirements
```

## MotionIR

Represents interaction and animation.

## PageIR

Represents composition of resolved components.

---

# 9. Motion as a First-Class System

Motion should not be an afterthought.

Static Figma describes appearance.

Prototype/reference material may describe:

```text
hover behavior
open/close behavior
accordion transitions
dropdown appearance
sheet movement
tab transitions
interactive feedback
```

Motion behavior must be normalized separately.

Example:

```ts
interface MotionDefinition {
  trigger:
    | "hover"
    | "press"
    | "focus"
    | "open"
    | "close"
    | "enter"
    | "exit"
    | "scroll"

  properties: string[]

  durationMs?: number

  easing?: string

  delayMs?: number

  type:
    | "instant"
    | "transition"
    | "keyframes"
    | "spring"
    | "layout"

  source:
    | "existing-component"
    | "prototype"
    | "reference"
    | "explicit-spec"
}
```

Do not infer animation from static screenshots.

Unknown motion should default to conservative behavior.

---

# 10. Untitled UI / External Reference Usage

A reference design system can contribute evidence for:

```text
component anatomy
behavior
prototype transitions
state changes
motion language
interaction sequence
```

It should not automatically define:

```text
our color system
our tokens
our component naming
our implementation API
our architecture
```

When a reference prototype demonstrates useful behavior:

```text
prototype
↓
extract decision
↓
normalize to MotionIR
↓
map to existing DS motion pattern
↓
implement
```

Do not copy every animation literally.

Prefer reusable project-level motion rules.

---

# 11. Motion Tokens

Motion should become tokenized when repeated.

Example:

```css
--motion-duration-fast: 120ms;
--motion-duration-default: 180ms;
--motion-duration-slow: 280ms;

--motion-ease-standard: cubic-bezier(...);
--motion-ease-enter: cubic-bezier(...);
--motion-ease-exit: cubic-bezier(...);
```

Then:

```text
Dialog open
→ duration-default
→ ease-enter

Tooltip
→ duration-fast

Sheet
→ duration-slow
```

This reduces repeated AI reasoning.

---

# 12. Design System Manifest

The manifest is authoritative.

Example:

```json
{
  "Button": {
    "figmaComponentKey": "abc123",
    "source": "@/components/ui/button",
    "export": "Button",
    "status": "verified",

    "variants": {
      "Primary": "primary",
      "Secondary": "secondary"
    },

    "sizes": {
      "Small": "sm",
      "Medium": "md",
      "Large": "lg"
    }
  }
}
```

Known component mappings should resolve without an LLM.

---

# 13. Component Status

Supported states:

```text
unmapped
candidate
generated
verified
deprecated
```

Only verified mappings may bypass additional semantic checking.

---

# 14. Memory Architecture

The compiler should retain useful knowledge.

It should not depend on conversational memory.

## Authoritative Memory

Examples:

```text
manifest
tokens
verified mappings
motion tokens
component APIs
framework constraints
```

Highest priority.

---

## Build Memory

Examples:

```text
hashes
compiled output
visual baselines
dependency graph
last validation
```

Used for incremental compilation.

---

## Experience Memory

Examples:

```text
successful fixes
failed mappings
browser quirks
repeated visual issues
motion interpretations
```

Advisory.

---

# 15. Negative Memory

Repeated failed approaches should be stored.

Example:

```json
{
  "pattern": "pricing-card-v2",
  "rejected": "Panel",
  "reason": "incorrect hierarchy",
  "mismatch": 8.1,
  "successfulReplacement": "Card",
  "replacementMismatch": 0.6
}
```

Before trying a previously rejected approach:

```text
check whether relevant input changed
```

---

# 16. Initial Persistence

Do not introduce a vector database in the MVP.

Start with:

```text
.design-compiler/
├── manifest.json
├── tokens.json
├── mappings.json
├── motion.json
├── exceptions.json
├── hashes.json
└── visual/
```

Move to SQLite once relationships/history become cumbersome.

Semantic retrieval can be added later only if justified by actual usage.

---

# 17. Component Resolution

Resolution should be deterministic whenever possible.

Pseudo-flow:

```text
component key exact?
→ reuse

known mapping?
→ reuse

known variant?
→ reuse variant

composition recognized?
→ compose

Base UI primitive?
→ wrap primitive

native semantic element?
→ use native

otherwise
→ generate
```

Creation is the final branch.

---

# 18. Component Similarity

Potential matching signals:

```text
Figma component key
name
semantic role
variant structure
children
token usage
layout
dimensions
behavior
```

Similarity scores can help route ambiguous cases but may not override exact verified mappings.

---

# 19. Token System

Figma variables should become semantic design tokens.

Pipeline:

```text
Figma Variable
↓
TokenIR
↓
semantic CSS variable
↓
Tailwind theme
```

Avoid raw arbitrary values when reusable tokens exist.

---

# 20. Incremental Compilation

Every normalized relevant node receives a content hash.

Example:

```text
Navbar     unchanged
Hero       changed
Features   unchanged
Footer     unchanged
```

Only Hero enters the expensive pipeline.

Hashing should exclude irrelevant metadata that does not affect implementation.

---

# 21. AI Context Budget

The compiler must actively minimize model context.

Priority:

```text
metadata first
↓
IR only
↓
relevant source only
↓
cropped visual evidence
↓
broader context only if needed
```

Never resend known component specifications unnecessarily.

---

# 22. AI Budget Rule

Every AI invocation should answer:

```text
Why is AI needed here?
Why cannot deterministic code resolve this?
What is the smallest sufficient context?
What new reusable knowledge can be persisted afterward?
```

If these cannot be answered, reconsider the model call.

---

# 23. Model Routing

```text
lookup
→ deterministic

image diff
→ deterministic

geometry diff
→ deterministic

simple repetitive generation
→ economical coding model

complex repo-aware implementation
→ Codex

ambiguous structured decision
→ Jev

known mapping
→ manifest
```

---

# 24. Visual Fidelity

The system should automatically converge toward Figma.

Inputs:

```text
reference image
rendered browser image
DOM geometry
computed styles
design tokens
```

Outputs:

```text
PASS
or
structured failure report
```

---

# 25. Acceptance Threshold

Initial configurable threshold:

```text
geometry error:
<= 1px

spacing error:
<= 1px

component dimensions:
<= 1px

critical layout mismatch:
0

semantic token mismatch:
0

overall visual mismatch:
< 1%
```

Typography should compare:

```text
family
size
weight
line height
letter spacing
```

Exact pixel equality is not mandatory due to anti-aliasing and rasterization differences.

---

# 26. Region-Based Repair

Full-page visual failure must be reduced to local failures.

Example:

```text
Page mismatch 1.9%

Navbar
0.15%
PASS

Hero
4.7%
FAIL

Button
0.09%
PASS
```

Only Hero should enter the repair loop.

AI should receive:

```text
Hero IR
Hero implementation
Hero reference crop
Hero actual crop
structured mismatch
```

Not the entire application.

---

# 27. Structured Failure Types

```text
position
dimensions
spacing
typography
color
border
radius
shadow
content
component-selection
responsive
motion
rendering-noise
```

Where possible, fix directly without AI.

Example:

```json
{
  "issue": "spacing",
  "property": "gap",
  "expected": 12,
  "actual": 16,
  "requiresAI": false
}
```

---

# 28. Visual Convergence

Maximum correction cycles must be bounded.

Default:

```text
5
```

Stop when:

```text
threshold passed
```

or:

```text
no measurable improvement
same failure repeats
regression occurs
maximum reached
```

Create a diagnostic report instead of endlessly consuming tokens.

---

# 29. Motion Validation

Motion is validated differently from static visuals.

Tests may include:

```text
trigger occurs
initial state correct
final state correct
duration within tolerance
easing token correct
focus behavior correct
reduced-motion behavior correct
```

Avoid expensive frame-by-frame comparison unless specifically required.

---

# 30. Animation Decision Resolver

Animation behavior should resolve in this order:

```text
existing component motion
↓
project motion token
↓
prototype specification
↓
recognized reference pattern
↓
conservative default
```

Example:

```text
Figma/Untitled UI prototype:
Popover fades + scales on open

Existing project Popover:
already uses motion-popover-enter

Decision:
reuse existing motion token

NOT:
generate new animation
```

---

# 31. Animation Library Policy

Do not introduce a motion dependency by default.

Use:

```text
CSS transitions
CSS animations
```

first.

A dedicated motion library is allowed only for behavior that materially benefits from it, for example:

```text
complex layout interpolation
physics-based interaction
shared layout transition
gesture interaction
```

The choice must remain implementation-specific, not embedded into MotionIR.

---

# 32. Component API Boundary

Consumer code should use DS components rather than Base UI directly when an abstraction exists.

Prefer:

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
} from "@/components/ui/dialog"
```

instead of coupling consumers to Base UI APIs.

This keeps Base UI replaceable.

---

# 33. Accessibility Boundary

Visual fidelity cannot override:

```text
semantic correctness
focus management
keyboard access
ARIA behavior
reduced motion
disabled semantics
```

If a screenshot conflicts with accessible behavior, preserve accessible implementation.

---

# 34. Visual Baselines

A verified component should receive a stored baseline.

Example:

```text
Button
├── primary-md
├── primary-lg
├── secondary-md
├── disabled
├── hover
└── focus
```

Future changes can be regression-tested without rereading the entire Figma system.

---

# 35. State Coverage

Components should model relevant states:

```text
default
hover
focus
active
disabled
open
closed
selected
invalid
loading
```

Only states relevant to the component need to exist.

State definitions should come from:

```text
Figma variants
Base UI behavior
prototype information
explicit project specification
```

---

# 36. Responsive Coverage

Use configurable project viewports.

Initial test set may be:

```text
390
768
1440
```

Do not assume every component requires independent screenshots at every breakpoint.

Prioritize:

```text
layout-sensitive components
responsive navigation
grids
complex cards
application compositions
```

---

# 37. Metrics

Track:

```text
reuse rate
new-component rate
component coverage
token coverage
motion reuse
cache hit rate
deterministic resolution rate
AI calls per compile
input tokens per compile
output tokens per compile
visual iterations
final mismatch
repeated failures
```

A successful mature project should show:

```text
reuse ↑
deterministic resolution ↑
cache hits ↑

AI calls ↓
token usage ↓
visual corrections ↓
```

---

# 38. Repository Layout

Suggested:

```text
/
├── components/
│   ├── ui/
│   └── generated/
│
├── design-system/
│   ├── manifest.json
│   ├── tokens.json
│   ├── mappings.json
│   ├── motion.json
│   └── exceptions.json
│
├── compiler/
│   ├── figma/
│   ├── ir/
│   ├── resolver/
│   ├── generator/
│   ├── memory/
│   └── cache/
│
├── visual/
│   ├── capture.ts
│   ├── compare.ts
│   ├── regions.ts
│   ├── geometry.ts
│   └── report.ts
│
├── motion/
│   ├── resolver.ts
│   ├── tokens.ts
│   └── validate.ts
│
└── tests/
```

Do not create all directories prematurely if a vertical slice does not need them.

---

# 39. Development Phases

## P0 — Core proof

One component:

```text
Button
```

Flow:

```text
Figma
↓
extract
↓
IR
↓
manifest mapping
↓
existing React Button
↓
render
↓
visual validation
```

Goal:

```text
no AI required
```

---

## P1 — Mini design system

Add:

```text
Button
Input
Card
Badge
Avatar
```

Goals:

```text
verified manifest
token mapping
visual baselines
reuse
```

---

## P2 — Interactive primitive

Add one:

```text
Dialog
Popover
Select
Accordion
```

Use Base UI.

Validate interaction and accessibility.

---

## P3 — Motion

Select one component with a useful prototype/reference animation.

Flow:

```text
prototype/reference
↓
MotionIR
↓
motion decision
↓
implementation
↓
motion validation
```

This proves the animation decision layer.

---

## P4 — Complete screen

Compile one real screen.

Reuse known components.

Generate only genuinely unresolved composition.

---

## P5 — Visual auto-repair

Implement region-based visual correction.

Start with:

```text
width
height
padding
margin
gap
font size
line height
radius
```

---

## P6 — Incremental compiler

Add:

```text
hashing
cache
changed-node filtering
```

---

## P7 — Experience memory

Persist:

```text
successful decisions
failed decisions
visual fixes
motion decisions
```

---

## P8 — Jev

Only introduce Jev if enough real ambiguous decisions exist.

Use it as a typed decision engine, not as a code generator.

---

# 40. MVP Success Criteria

One screen should achieve:

```text
>= 80% reuse of known components

0 duplicated known components

0 unnecessary tokens

< 1% final visual mismatch

<= 3 correction iterations

unchanged nodes skipped

only relevant failure regions sent to AI

framework-independent DS output
```

---

# 41. Longer-Term Success Criteria

With a mature design system:

```text
> 90% known component reuse

most builds resolved deterministically

LLM used primarily for genuinely new components

known screens compile incrementally

motion patterns reused instead of regenerated

visual regressions caught automatically
```

---

# 42. Agent Rules

Every coding agent must:

1. Read this file before architectural changes.
2. Inspect the repository before creating abstractions.
3. Prefer reuse over creation.
4. Prefer deterministic resolution over AI.
5. Prefer Base UI for complex behavioral primitives.
6. Preserve framework portability.
7. Use semantic tokens.
8. Avoid unrelated refactors.
9. Modify the smallest possible scope.
10. Run visual validation.
11. Run interaction validation where relevant.
12. Persist reusable knowledge.
13. Record meaningful rejected approaches.
14. Never loop indefinitely.
15. Avoid feeding the model context already encoded in structured state.

---

# 43. Core Product Thesis

The competitive advantage is not:

> AI generates React from Figma.

It is:

> The compiler understands the project's reusable design language, resolves existing components before generating anything, validates implementation automatically against visual and interaction evidence, learns from verified outcomes, and requires progressively less AI as the design system matures.

---

# 44. Guiding Principle

```text
Humans define intent.

Figma defines design.

Base UI provides reliable behavior.

The compiler resolves structure.

Deterministic tools measure correctness.

AI handles ambiguity.

Memory prevents repeated work.

Visual QA drives convergence.
```

The mature system should become **more deterministic, more reusable, more visually accurate, and cheaper to operate over time**.

# Skill Routing

Skills are capabilities, not global context.

Never load every installed skill into every agent.

Load only the smallest skill set required by the current task.

## Figma Scout

Preferred skills:

- figma-analyze-component-set
- figma-deep-component
- figma-export-tokens

Use `figma-analyze-component-set` when analyzing a COMPONENT_SET
and translating Figma variant axes into a reusable code API.

Use `figma-deep-component` when detailed anatomy, resolved tokens,
instance references, prototype reactions, or nested composition
are required.

Use `figma-export-tokens` only when extracting or refreshing the
canonical token system.

Do not repeatedly export tokens for individual component work
when the token cache is still valid.

## React Architecture Agent

Preferred skills:

- vercel-composition-patterns
- shadcn

Use composition-patterns when deciding component boundaries,
compound component APIs, composition, or avoiding boolean prop
proliferation.

Use shadcn for source-distribution and registry architecture.

Do not use shadcn as the visual design source.

Our visual source of truth is Figma.
Our behavioral primitive foundation is Base UI.

## Visual Validator

Preferred skills:

- figma-check-design-parity
- webapp-testing

Use deterministic parity and browser testing before asking an LLM
to diagnose visual differences.

## Motion Agent

Do not load motion-related skills during static component work.

Motion sources, in priority order:

1. explicit prototype/reaction data
2. Figma annotations
3. verified project motion tokens
4. existing component behavior
5. conservative fallback

Never infer decorative motion from a static screenshot.

## Context Rule

Subagents receive only:
- their task
- required skill instructions
- relevant IR
- relevant files
- relevant Figma node(s)

Do not forward the full parent-agent context unless required.