You are the lead agent for the first vertical slice of a Figma → React Design System Compiler.

Read `DESIGN_SYSTEM_COMPILER.md` and `MASTER_BUILD_PROMPT.md` first.

Do NOT attempt to implement the entire architecture.

Your only objective for this run is to prove this vertical slice:

```text
Figma Button Component Set
→ structured extraction
→ normalized IR
→ design-system mapping
→ reusable React Button
→ browser render
→ visual validation
→ PASS / diagnostic FAIL
```

## Inputs

Repository:

```text
REPO_PATH
```

Target Figma component:

```text
FIGMA_NODE_URL
```

The provided Figma URL points to the exact Button component/component-set that should be used for this experiment.

Use that exact node as the primary scope.

Do not crawl or ingest the entire Figma file unless required to resolve a specific dependency.

---

# Runtime

Primary implementation model:

```text
DeepSeek V4.1 Flash
```

The orchestration environment supports spawning subagents.

Jev credentials already exist in the shell environment.

Never print, expose, persist, or log the Jev API key.

If Jev environment discovery is necessary, inspect environment variable NAMES only. Never output secret values.

Jev is optional for this vertical slice.

Do not use Jev unless an actual ambiguous typed decision exists that deterministic code cannot resolve.

---

# Critical constraint

Optimize for:

```text
high fidelity
high reuse
low token usage
deterministic behavior
small context
small diffs
```

The goal is NOT to maximize the amount of AI-generated code.

The goal is to minimize how much AI is required.

---

# Subagent Strategy

You MAY spawn subagents.

Use subagents for isolated responsibilities instead of giving every agent the entire project context.

Recommended responsibilities:

### 1. Figma Scout

Responsibility:

```text
inspect the exact Figma target
extract only required metadata
identify variants
identify variables/tokens
identify dimensions/layout
identify states
detect whether motion exists
```

The scout must NOT implement React.

Start from the exact provided node.

Use structured Figma context.

For a large selection:

```text
metadata first
→ relevant child nodes only
→ design context only where needed
```

Do not dump the full Figma file into context.

Return a compact structured summary / IR candidate to the lead agent.

---

### 2. Repository Scout

Responsibility:

```text
inspect existing React/Tailwind setup
inspect existing components
inspect utilities
inspect Tailwind configuration
inspect package dependencies
check whether Base UI already exists
check whether Button already exists
```

Do NOT modify code.

Do NOT read unrelated application directories unnecessarily.

Return paths and reusable capabilities.

---

### 3. Implementer

Only start after the two scouts finish.

Inputs should be limited to:

```text
relevant repository files
normalized Button design information
existing token/component information
```

Do not give the implementer raw full-repository context or full Figma context.

Responsibility:

```text
implement the smallest reusable Button vertical slice
```

Requirements:

```text
React
TypeScript
Tailwind CSS 4
Base UI only if a behavioral primitive is actually needed
CVA when useful for variants
framework agnostic
no Next.js dependency
no TanStack dependency
```

Button should remain usable from both:

```text
Next.js
TanStack Start
```

Prefer native `<button>` semantics when Base UI provides no meaningful benefit for this primitive.

---

### 4. Visual Validator

Responsibility:

```text
render component
capture browser screenshot
compare against Figma reference
inspect geometry
produce structured PASS/FAIL
```

Do not modify implementation initially.

Return something conceptually like:

```json
{
  "component": "Button",
  "variant": "primary",
  "size": "md",
  "status": "FAIL",
  "visualMismatch": 1.8,
  "issues": [
    {
      "type": "spacing",
      "property": "padding-inline",
      "expected": 16,
      "actual": 14
    }
  ]
}
```

Only after a diagnostic exists should a repair agent be invoked.

---

# Figma Retrieval Rules

Do not blindly request every available Figma artifact.

Start with the provided component node.

Retrieve the minimum required information:

```text
structure
variants
component properties
variables
dimensions
layout
visual reference
```

Use screenshot evidence for fidelity validation.

Do not repeatedly request the same context.

Cache normalized information locally.

If the target is too large:

```text
get sparse metadata
→ identify relevant child
→ retrieve child context only
```

---

# Motion

Motion is NOT part of the initial Button milestone unless the target actually defines meaningful interaction/motion.

If motion exists:

```text
static design context
↓
motion context
↓
MotionIR
```

Do not infer animation from screenshots.

Do not use Untitled UI as a motion reference during P0 unless explicitly supplied as a requirement.

Later, reference prototypes may contribute to MotionIR.

---

# Required Persistent Output

Create the smallest useful persistent representation.

Conceptually:

```text
.design-compiler/
├── manifest.json
├── tokens.json
├── mappings.json
└── hashes.json
```

Do not create empty architecture for future phases.

Only create files required by this vertical slice.

---

# Manifest expectation

The resulting mapping should eventually allow:

```text
Figma:
Button
variant = Primary
size = Large

↓

React:
<Button variant="primary" size="lg" />
```

Once the mapping is verified, future compilation must resolve it without an LLM call.

---

# Token Rules

Do not hardcode values if corresponding Figma variables or existing project tokens exist.

Resolution:

```text
existing project semantic token
↓
mapped Figma variable
↓
new semantic token
↓
hardcoded exception only as final fallback
```

Any hardcoded visual exception should be explicitly recorded.

---

# Visual Fidelity

Do not decide fidelity subjectively.

Use deterministic comparison.

Initial expectations:

```text
geometry deviation <= 1px
spacing deviation <= 1px
critical layout errors = 0
semantic token mismatch = 0
overall visual mismatch target < 1%
```

Do not demand literal zero differing pixels because browser text rasterization and anti-aliasing may differ.

---

# Repair Loop

If validation fails:

```text
identify exact failure
↓
identify responsible source
↓
send only that source + diagnostic + relevant crop
↓
make smallest patch
↓
validate again
```

Never regenerate the whole component merely because one property is wrong.

Maximum automated repair iterations:

```text
3
```

for this P0 experiment.

If it still fails, produce diagnostics rather than endlessly consuming tokens.

---

# Token Budget Discipline

Subagents must NOT receive the same large context by default.

Share artifacts instead.

Preferred information flow:

```text
Figma Scout
→ compact FigmaIR

Repository Scout
→ compact RepoCapabilities

Lead
→ resolver decision

Implementer
→ only required IR + files

Validator
→ rendered output + reference

Repair
→ only failed region/source
```

Do not transmit full chat history to every subagent if OMP allows narrower task context.

Do not resend immutable component descriptions after they have been normalized and persisted.

---

# No Premature Jev

Do not integrate Jev infrastructure merely because credentials exist.

For P0:

```text
deterministic mapping > Jev
```

Jev becomes valuable when decisions such as these become genuinely ambiguous:

```text
reuse existing?
compose?
extend?
create new?
real visual mismatch?
browser rendering noise?
```

Until then, keep it out of the hot path.

---

# Definition of Done

This run is successful only if we can demonstrate:

```text
1 exact Figma Button target
↓
normalized local representation
↓
reusable React Button implementation/mapping
↓
at least one representative variant rendered
↓
automatic screenshot/geometry comparison
↓
structured PASS or FAIL
```

And:

```text
no entire-file Figma ingestion
no duplicated existing component
no framework coupling
no unnecessary model call
no uncontrolled visual refinement loop
```

---

# Final Report

At the end, report:

```text
Files created
Files changed

Figma nodes accessed

Existing components reused

Tokens discovered
Tokens reused
Tokens created

AI calls that were actually necessary

Whether Jev was used and why

Visual mismatch result

Remaining blockers

Recommended next vertical slice
```

Do not begin the next phase automatically.
