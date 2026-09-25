# Prerequisites

## Local development

Recommended:

- Git;
- Node.js 20+;
- pnpm;
- TypeScript;
- Chromium/browser automation;
- enough disk space for source caches and visual baselines.

Current repository uses React/TypeScript/Vite and deterministic Node/browser scripts.

## Reference source access

The first reference library is public:

```text
https://github.com/untitleduico/react
```

Reference indexing should pin an exact commit.

For substantial copied MIT source, preserve required MIT notices.

## Target primitive engine

Install/use Base UI when implementing the Base UI target.

The exact package/API should be validated against the pinned target dependency instead of guessed from stale documentation.

Shadcn Base UI wrappers may be inspected as implementation-shape reference.

## Figma access

For visual/composition reconciliation, provide access to the source Figma file.

Possible adapters:

- Figma REST;
- native Figma MCP;
- broker/integration.

Keep tokens local and secret.

Example:

```bash
FIGMA_TOKEN=...
```

## PRO input

A user must have lawful access to any PRO Figma used as compiler input.

PRO-derived output must retain appropriate provenance/distribution restrictions.

Do not assume OSS MIT terms apply to PRO assets.

## Fonts

Visual parity requires the same font family/weights as Figma.

Wait for `document.fonts.ready` before captures.

## Browser verification

Pin:

- browser version;
- viewport;
- DPR;
- fonts;
- color scheme;
- locale when relevant;
- motion policy.

## Recommended stack

```text
React
TypeScript
Base UI
Tailwind CSS 4
CVA where useful
Zod
Playwright/Puppeteer browser checks
pixel/perceptual diff
axe-core
```

Not every component needs every dependency.

## AI

AI is optional.

Use it only for unresolved ambiguity or implementation work that deterministic/reference logic cannot handle.

Do not store API keys in compiler state.

## Project-local state

Recommended:

```text
.design-compiler/
├── references/
├── manifest.json
├── mappings.json
├── tokens.json
├── exceptions.json
├── hashes.json
├── ir/
├── parity/
├── visual/
└── reports/
```

## Minimum next-slice requirements

For the reference-first Button milestone:

- repository checkout;
- network/GitHub access for pinned Untitled UI source;
- Base UI target dependency/docs/source;
- existing Button Figma evidence;
- deterministic browser tests;
- reference/contract storage.

Jev, MCP, and broad PRO compilation are not required yet.
