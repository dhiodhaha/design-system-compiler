# CLI, npx, and MCP Direction

## Recommendation

Build one compiler core and expose it through three interfaces:

```text
                       compiler core
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
            CLI            npx            MCP
       local/CI engine   distribution   agent interface
```

Do not build separate logic for CLI and MCP.

The CLI should be the canonical deterministic execution surface.

`npx` is a convenient way to run the CLI without a global install.

The MCP server should expose the same compiler APIs to agents.

## Why CLI first

A CLI gives the project:

- deterministic behavior;
- easy local debugging;
- CI integration;
- no model dependency;
- structured JSON output;
- reproducible commands;
- simple caching;
- a stable core that MCP can wrap later.

If the compiler only exists inside an agent prompt, it is harder to test and reuse.

## Proposed package layout

```text
packages/
  core/
  design-ir/
  figma/
  validator/
  registry/
  cli/
  mcp/
```

Possible future package names:

```text
@ds-compiler/core
@ds-compiler/figma
@ds-compiler/validator
@ds-compiler/cli
@ds-compiler/mcp
```

Names are placeholders until publication.

## Proposed CLI commands

### init

```bash
npx ds-compiler init
```

Creates:

```text
.design-compiler/
design-system.config.ts
```

### inspect

```bash
npx ds-compiler inspect "<figma-component-set-url>"
```

Responsibilities:

- parse URL;
- shallow-read component set;
- create ComponentSetIndex;
- show axes;
- show supported combinations;
- produce SlicePlan;
- do not implement code.

Useful flags:

```text
--json
--refresh
--transport rest|mcp|broker
--max-deep-reads <n>
```

### slice

```bash
npx ds-compiler slice button
```

Responsibilities:

- choose representative nodes;
- explain why each node is selected;
- detect likely outliers;
- write DeepReadPlan.

### compile

```bash
npx ds-compiler compile button
```

Responsibilities:

- use cached IR where possible;
- deep-read required slices;
- resolve semantics;
- reuse/extend/create;
- update implementation;
- update manifest.

Useful future flags:

```text
--no-ai
--model <provider/model>
--allow-create
--dry-run
--json
```

### verify

```bash
npx ds-compiler verify button
```

Responsibilities:

- render representative specimens;
- geometry/computed-style checks;
- pixel diff;
- emit structured report.

Possible flags:

```text
--representative
--full-matrix
--update-baseline
--threshold <value>
--json
```

### status

```bash
npx ds-compiler status
```

Example output:

```text
Button       partial   18/22 representative rules verified
Input        unstarted
Tooltip      unstarted
Dialog       unstarted

cache hit rate: 92%
AI calls last compile: 0
```

### add

```bash
npx ds-compiler add button
```

This is the source-distribution command inspired by shadcn.

It should copy the verified component and required dependencies into the consumer project.

The registry should declare:

- files;
- token dependencies;
- component dependencies;
- runtime dependencies;
- supported framework adapters.

### explain

```bash
npx ds-compiler explain button
```

Useful for observability:

- why a Figma node maps to Button;
- why a variant became CSS state;
- why a combination is unsupported;
- why a new component was or was not created;
- which decision came from deterministic logic vs Jev vs model.

## Structured output is mandatory

Every important CLI command should support `--json`.

Agents and CI should consume structured data rather than scrape pretty terminal output.

Example:

```json
{
  "component": "Button",
  "status": "partial",
  "figmaRequests": 2,
  "cacheHits": 17,
  "modelCalls": 0,
  "jevCalls": 0,
  "representativeTests": {
    "passed": 12,
    "failed": 0
  }
}
```

## Config direction

Possible future `design-system.config.ts`:

```ts
export default {
  figma: {
    transport: "rest",
  },
  output: {
    framework: "react",
    styling: "tailwind4",
    componentsDir: "src/components/ui",
  },
  validation: {
    browser: "chromium",
    maxGeometryDeltaPx: 1,
    maxVisualMismatch: 0.01,
  },
  ai: {
    enabled: true,
    policy: "only-when-needed",
  },
}
```

Exact schema should be Zod-validated.

## npx

`npx` should simply run the published CLI package.

Example desired UX:

```bash
npx ds-compiler@latest inspect "<figma-url>"
```

For reproducible CI, pin a version:

```bash
npx ds-compiler@0.3.0 verify --full-matrix button
```

Do not make `npx` a separate implementation.

## MCP server

The MCP server exists so Codex/Claude/other agents can operate the compiler without manually invoking shell commands.

It should expose narrow tools that return compact structured responses.

Possible tools:

### `ds_init`

Initialize compiler state.

### `ds_inspect_component_set`

Input:

```json
{
  "figmaUrl": "..."
}
```

Output:

```json
{
  "component": "Button",
  "axes": {},
  "variantCount": 200,
  "slicePlanId": "..."
}
```

Do not return the full raw Figma tree.

### `ds_get_slice_plan`

Returns only selected representative nodes and reasons.

### `ds_compile_component`

Compiles/reuses/extends a component.

Optional mode:

```text
deterministic-only
allow-ai
```

### `ds_verify_component`

Runs representative or full-matrix validation.

### `ds_get_manifest`

Returns compact mappings/status.

### `ds_explain_decision`

Explains the provenance of a semantic decision.

### `ds_add_component`

Copies a verified registry item to the target project.

## MCP response policy

The MCP server should protect model context.

It should:

- return summaries by default;
- return references/IDs to large artifacts;
- provide pagination/ranges for verbose reports;
- never dump entire raw Figma cache unless explicitly requested;
- expose structured diagnostics.

The MCP server is an anti-context-explosion boundary.

## CLI and MCP share the same services

Example internal API:

```ts
inspectComponentSet()
planSlices()
compileComponent()
verifyComponent()
getManifest()
addRegistryItem()
explainDecision()
```

CLI calls these functions.

MCP calls these functions.

Tests call these functions.

No duplicate business logic.

## Model integration

The compiler core should support model providers behind an interface.

The CLI/MCP should expose model policy rather than model-specific implementation details.

Example:

```text
--ai never
--ai auto
--ai required
```

`auto` means:

```text
deterministic resolver
→ ambiguity?
   no → continue without model
   yes → typed decision / coding model as configured
```

## Jev integration

Jev should be another service behind a typed interface.

Potential command:

```bash
npx ds-compiler explain-decision <decision-id>
```

The stored decision should show:

- evidence;
- deterministic rules attempted;
- Jev request schema;
- typed result;
- confidence if available;
- final action.

Never store the API key.

## CI use case

Example future workflow:

```bash
npx ds-compiler verify --full-matrix button
npx ds-compiler verify --changed
```

CI can fail when:

- a verified component drifts beyond threshold;
- a token changed without updated baselines;
- a supported combination regresses;
- registry output is stale.

## Registry direction

The registry is the bridge from compiler output to shadcn-like consumption.

A registry item should describe:

```json
{
  "name": "button",
  "files": [
    "src/components/ui/button.tsx"
  ],
  "styleDependencies": [
    "tokens.css"
  ],
  "componentDependencies": [],
  "runtimeDependencies": [
    "class-variance-authority"
  ]
}
```

Then:

```bash
npx ds-compiler add button
```

copies source into a consumer app.

## Suggested build order

1. compiler core + IR;
2. Figma adapter/cache;
3. slicer;
4. deterministic validator;
5. CLI;
6. registry;
7. MCP wrapper;
8. broader model-provider integrations.

Do not build the MCP first and hide immature compiler logic behind tools.

## Product thesis

The CLI makes the compiler reproducible.

The registry makes the output reusable.

The MCP makes the compiler agent-native.

All three should be thin interfaces over the same verified core.


## API-policy provenance

The CLI/MCP should expose why a public API decision was made.

For example:

~~~json
{
  "component": "Button",
  "decision": "leading icon uses composition",
  "sources": [
    "figma:INSTANCE_SWAP",
    "compiler:slot-policy",
    "api-policy:composition-first"
  ],
  "references": [
    "shadcn-like ergonomics"
  ],
  "visualSource": "figma",
  "behaviorSource": "native-button"
}
~~~

Shadcn references must never be reported as visual provenance.

The registry/source-owned model may be shadcn-inspired, but visual styling and semantic evidence remain specific to the compiled design system.

See [API_DESIGN_POLICY.md](./API_DESIGN_POLICY.md).
