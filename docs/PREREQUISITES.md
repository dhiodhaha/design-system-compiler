# Prerequisites

This document describes what is required to run or develop the Design System Compiler.

The exact package names and CLI commands may change while the project is being built. The architectural prerequisites are more stable than the package surface.

## 1. Local development environment

Recommended:

- Git
- Node.js 20 or newer
- a modern package manager such as pnpm
- TypeScript
- Chromium installed through Playwright
- macOS, Linux, or WSL2
- enough disk space for cached Figma JSON, screenshots, and visual baselines

Windows is also viable. If the compiler runs in WSL while Figma Desktop runs on Windows, remember that localhost bridging can differ depending on WSL networking mode.

## 2. Target React environment

The generated design-system core is intended for React applications.

Supported target direction:

- TanStack Start
- Next.js
- Vite React
- React Router

The core generated components should stay framework-agnostic.

A target project should be able to support:

- React
- TypeScript
- Tailwind CSS 4, if using the recommended styling target
- CSS custom properties
- CVA or an equivalent variant-rule system

## 3. Figma access

You need access to the Figma source file.

The compiler should support multiple transport options.

### Option A — direct Figma REST

Recommended for headless/compiler operation because it is deterministic and cacheable.

Provide a Figma token through an environment variable. The exact permission set depends on the Figma endpoints being used.

At minimum, the token must be able to read the target file/nodes.

If the workflow needs Figma variables/modes through endpoints that require a dedicated variables permission, the token must include that permission as well.

Never commit the token.

Example environment naming:

```bash
FIGMA_TOKEN=...
```

The variable name is a project convention and may be changed by the implementation.

### Option B — native Figma MCP

Useful for interactive work when Figma/Dev Mode integration is available.

Advantages can include:

- direct node IDs;
- design context;
- variable definitions;
- interactive source inspection.

It should be treated as one adapter, not as the compiler architecture itself.

### Option C — broker/integration provider

A broker can simplify authentication, but may redact fields or expose a narrower API surface.

The compiler should normalize it into the same internal IR.

## 4. Figma source quality

The compiler works best when the Figma file has:

- real component sets;
- named variant properties;
- consistent auto layout;
- variables/styles;
- reusable nested instances;
- explicit component boundaries;
- consistent naming;
- prototypes/annotations for motion when motion is intended.

The compiler can still work with imperfect files, but semantic ambiguity and AI/human review will increase.

## 5. Fonts

Pixel comparison depends heavily on fonts.

For reliable visual validation:

- use the same font family as Figma;
- ensure required weights are available;
- ensure the browser can load the font;
- wait for `document.fonts.ready`;
- avoid fallback fonts in the visual test environment.

Font rasterization can differ slightly across OS/browser environments, so the validator must distinguish layout errors from harmless glyph-edge rendering differences.

## 6. Browser testing

Install Playwright and its browser runtime in the future implementation.

Typical setup direction:

```bash
pnpm exec playwright install chromium
```

Visual tests should standardize:

- browser version;
- viewport;
- DPR;
- fonts;
- color scheme;
- animations;
- test data.

## 7. Recommended implementation libraries

The current recommended stack includes:

- React
- TypeScript
- Base UI
- Tailwind CSS 4
- class-variance-authority (CVA)
- Zod
- Playwright
- pixelmatch and/or SSIM tooling

Not every generated component needs every dependency.

Example: a native Button may not need Base UI at all.

## 8. AI providers

AI is optional for deterministic runs after enough compiler knowledge exists.

During development, useful roles include:

- implementation/refactoring;
- semantic planning;
- metadata classification;
- difficult architecture changes.

The harness should support provider abstraction rather than hard-coding one model.

Possible environment variables depend on the provider.

Never:

- write API keys to logs;
- commit keys;
- copy keys into IR;
- include keys in prompts.

## 9. Jev

Jev is optional.

It is useful only for typed ambiguity decisions such as:

- extend existing component vs create new component;
- React prop vs composition;
- component vs recipe;
- borderline rendering noise classification.

Example environment convention:

```bash
JEV_API_KEY=...
```

The compiler must remain useful without Jev.

## 10. OMP / agent harness

OMP or another multi-agent harness is optional but useful.

The recommended worker roles are:

- Lead
- Figma Scout
- Variant/API Planner
- Implementer
- Validator

The important capability is scoped context and artifact passing, not the number of agents.

The harness should allow workers to read compact files such as:

```text
.design-compiler/ir/button.component-set.json
.design-compiler/ir/button.deltas.json
.design-compiler/validation/button.json
```

rather than forwarding giant transcripts.

## 11. Optional agent skills

Skills can accelerate specific tasks but must not become hard dependencies of the compiler.

Recommended optional skills are documented in [SKILLS.md](./SKILLS.md).

The compiler should continue to work if a skill is unavailable.

## 12. Suggested environment file

A future local-only `.env` might look like:

```bash
FIGMA_TOKEN=...
JEV_API_KEY=...
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=...
```

Only define providers actually used.

Add `.env` and other secret files to `.gitignore`.

## 13. Expected project-local state

The compiler should use a project-local working directory:

```text
.design-compiler/
├── manifest.json
├── tokens.json
├── mappings.json
├── motion.json
├── exceptions.json
├── hashes.json
├── raw/
├── ir/
├── visual/
└── reports/
```

This directory contains compiler memory and build artifacts, not secrets.

Some subdirectories may be cache-only and can be gitignored; authoritative files may optionally be committed depending on project policy.

## 14. Minimum prerequisite for the first vertical slice

For a Button P0, the minimum practical requirements are:

- a Figma file and component-set URL;
- access to fetch the relevant nodes;
- a React/TypeScript test project;
- the exact required font;
- a browser/Playwright environment;
- a place to store IR and screenshots.

You do not need:

- Jev;
- an MCP server made by this project;
- a registry CLI;
- a full design-system inventory;
- every optional skill.

Start small and prove the deterministic loop first.
