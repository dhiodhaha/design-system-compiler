# Agent Skills and Skill Routing

Skills are optional accelerators for agents. They are not the compiler architecture and they should not be required for deterministic runtime behavior.

The main rule:

> Do not load every installed skill into every subagent.

Load the smallest skill set that fits the current task.

## Recommended skills

### Figma analysis

Useful candidates from the Southleft Figma Console MCP skills repository:

- `figma-analyze-component-set`
- `figma-deep-component`
- `figma-export-tokens`
- later: `figma-check-design-parity`
- later: `figma-annotations`
- later: `figma-design-system-inventory`

Potential installation pattern:

```bash
npx skills add https://github.com/southleft/figma-console-mcp-skills   --skill figma-analyze-component-set

npx skills add https://github.com/southleft/figma-console-mcp-skills   --skill figma-deep-component

npx skills add https://github.com/southleft/figma-console-mcp-skills   --skill figma-export-tokens
```

Add parity only when the base visual pipeline exists:

```bash
npx skills add https://github.com/southleft/figma-console-mcp-skills   --skill figma-check-design-parity
```

### React composition

```bash
npx skills add https://github.com/vercel-labs/agent-skills   --skill vercel-composition-patterns
```

Use this when deciding component boundaries, compound components, composition, and avoiding boolean-prop explosion.

### shadcn architecture

```bash
npx skills add https://github.com/shadcn-ui/ui   --skill shadcn
```

Use shadcn as a reference for:

- source-owned components;
- registry/distribution;
- editable source;
- CLI UX.

Do not use shadcn as the visual source of truth.

### Browser testing

After the visual test harness exists:

```bash
npx skills add https://github.com/anthropics/skills   --skill webapp-testing
```

Use it to support browser automation workflows, but keep project-local deterministic validation scripts authoritative.

## Important compatibility caveat

Some Figma skills expect a specific Figma console/plugin tool such as `use_figma`.

Installing a SKILL.md does not magically provide the underlying runtime/tool integration.

Before using a Figma skill:

1. read its requirements;
2. confirm the required Figma tool exists in the agent environment;
3. if the required integration is unavailable, fall back to this project's Figma adapter and deterministic extractor.

Never make the compiler depend on an optional skill.

## Skill routing by worker

### Figma Scout

Possible skills:

- `figma-analyze-component-set`
- `figma-deep-component`
- `figma-export-tokens`

Use `figma-analyze-component-set` for:

- component-set axes;
- state/size classification;
- variant matrix reduction.

Use `figma-deep-component` for:

- detailed anatomy;
- nested instances;
- token references;
- prototype reactions;
- annotations.

Use `figma-export-tokens` only when:

- initializing tokens;
- refreshing changed variables;
- modes/aliases need re-export.

Do not re-export all tokens for every component compile.

### Variant/API Planner

Possible skills:

- `vercel-composition-patterns`
- `shadcn`

Use composition patterns when:

- a Figma axis might create boolean-prop explosion;
- a giant component should become compound components/recipes;
- a public API needs semantic decomposition.

Use shadcn when:

- designing source distribution;
- designing registry metadata;
- designing installation UX.

### Validator

Possible skills:

- `figma-check-design-parity`
- `webapp-testing`

Use deterministic project scripts before model reasoning.

A skill should help explain or automate the check, not replace measurable truth.

### Motion worker

Do not load motion skills during static component work.

Later, motion-oriented skills can be introduced after MotionIR exists.

Motion must come from:

1. explicit prototype/reaction;
2. Figma annotation;
3. existing verified motion token;
4. established DS behavior;
5. conservative fallback/no animation.

## Context rule

A skill can be useful but expensive if its instructions and tool output are unnecessarily injected everywhere.

Each subagent should receive only:

- its role;
- its relevant skills;
- relevant IR;
- relevant code files;
- relevant Figma node(s);
- expected output contract.

## Compiler vs skill responsibility

The compiler must own:

- slicing;
- IR schemas;
- cache;
- resolver order;
- supported combinations;
- deterministic validation;
- manifest;
- registry data.

Skills may assist:

- extraction;
- architecture reasoning;
- implementation planning;
- browser operations.

If a skill disappears tomorrow, the compiler's core data model should remain valid.

## Suggested installation phases

### P0

Install only if useful and compatible:

```text
figma-analyze-component-set
figma-deep-component
figma-export-tokens
vercel-composition-patterns
shadcn
```

### P1

After the golden component works:

```text
figma-check-design-parity
webapp-testing
```

### Later

When the corresponding feature exists:

```text
figma-annotations
figma-design-system-inventory
motion-specific skills
```

Do not install twenty skills just because they might be useful someday.
