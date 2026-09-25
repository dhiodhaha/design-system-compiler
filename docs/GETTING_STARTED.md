# Getting Started

This guide describes the intended workflow for compiling a Figma component set into a reusable React component.

The CLI shown here is the desired product interface. Until the CLI is implemented, an agent/harness can execute the same steps using the architecture docs.

## 1. Clone and prepare the repository

```bash
git clone https://github.com/dhiodhaha/design-system-skills.git
cd design-system-skills
```

When package scaffolding exists:

```bash
pnpm install
```

Install the Playwright browser when the visual validator exists:

```bash
pnpm exec playwright install chromium
```

## 2. Configure Figma access

Create a local secret file or export environment variables.

```bash
export FIGMA_TOKEN="..."
```

Do not commit the token.

A native Figma MCP transport may also be used when available, but the compiler should normalize both into the same IR.

## 3. Initialize compiler state

Future CLI:

```bash
npx ds-compiler init
```

Expected result:

```text
.design-compiler/
├── manifest.json
├── tokens.json
├── mappings.json
├── hashes.json
├── raw/
├── ir/
├── visual/
└── reports/
```

The exact package/command name is provisional.

## 4. Give the compiler a whole component-set URL

You should not copy every Figma variant manually.

Use the component set as the discovery scope:

```bash
npx ds-compiler inspect   "https://www.figma.com/design/<file>/<name>?node-id=<component-set-node>"
```

Conceptually, the compiler should:

```text
component set URL
↓
shallow structural read
↓
ComponentSetIndex
↓
axes + supported combinations
↓
representative selection
↓
DeepReadPlan
```

The LLM should not receive a giant full subtree just so it can decide what to ignore.

## 5. Optional: provide a verified/golden specimen

A single exact instance can be used to prove pixel fidelity first.

```text
Component scope:
[whole Button component set]

Golden specimen:
[one concrete Button instance]
```

The component set answers:

> What is Button in this design system?

The specimen answers:

> Can our implementation reproduce this exact Button?

These are different roles.

## 6. Compile the first base

Future CLI direction:

```bash
npx ds-compiler compile button   --figma "<component-set-url>"   --specimen "<golden-node-url>"
```

The first run can be relatively expensive because the compiler may need to learn:

- Figma shape;
- component anatomy;
- tokens;
- font behavior;
- visual-validator quirks;
- transport behavior.

Persist those lessons.

## 7. Verify the base

Future command:

```bash
npx ds-compiler verify button
```

Static verification should:

1. render the specimen;
2. wait for fonts;
3. freeze animations;
4. capture DOM geometry;
5. capture computed styles;
6. capture screenshot;
7. compare with Figma;
8. produce a structured diagnostic report.

Expected output should be more useful than a single mismatch percentage:

```text
geometry: PASS
font family: PASS
font size: PASS
padding-inline: expected 14, actual 16
radius: PASS
overall visual mismatch: 0.42%
```

The repair should touch only the responsible rule.

## 8. Expand through deltas, not rewrites

After the base passes, process the rest of the component set.

Do not ask the model to implement every variant independently.

For example:

```text
md / Primary / Default
→ verified base

md / Primary / Hover
→ background token delta

lg / Primary / Default
→ size/typography delta

md / Secondary / Default
→ hierarchy delta
```

Compile those deltas into CVA/compound variant rules.

## 9. Map Figma state to runtime semantics

Typical Button mapping:

```text
Figma Default
→ base classes

Figma Hover
→ hover:

Figma Focused
→ focus-visible:

Figma Disabled
→ native disabled + disabled:

Figma Loading
→ loading prop/state
```

Do not expose a production API such as:

```tsx
<Button state="hover" />
```

unless it is an internal test harness control.

## 10. Test representative coverage

Before full-matrix testing, test a compact set that covers unique rules.

Example:

```text
base primary default
small primary default
large primary default
secondary default
tertiary default
primary hover
primary focus
primary disabled
primary loading
primary icon-only
```

This catches rule errors cheaply.

## 11. Render the full supported matrix

After representative coverage passes, render every supported combination automatically.

This step should be deterministic and should not require an LLM.

If Figma lacks a combination, mark it unsupported rather than inventing it.

## 12. Related component sets

Some Figma systems keep semantically related families in separate component sets, for example:

```text
Buttons/Button
Buttons/Button destructive
Buttons/Button utility
Buttons/Button loading icon
```

Do not automatically merge them.

First classify:

- public component;
- variant extension;
- internal helper;
- composition;
- recipe.

A destructive set is a good semantic-extension test:

```text
same anatomy + same states + same sizes + token differences
→ likely extend Button intent

different behavior/anatomy
→ may require a distinct component or composition
```

If the evidence remains ambiguous, this is a valid Jev decision point.

## 13. Reuse in later screens

Once Button is verified:

```text
Figma checkout page
├── verified Button
├── verified Input
├── verified Card
└── unknown OrderSummary
```

The compiler should reuse the first three and inspect/generate only the unknown part.

This is how token usage falls over time.

## 14. Expected user experience

The long-term UX should be:

```bash
npx ds-compiler init
npx ds-compiler inspect "<component-set-url>"
npx ds-compiler compile button
npx ds-compiler verify button
npx ds-compiler add button
```

For agents, the equivalent MCP tools should operate on the same compiler core.

## 15. Running with OMP

A good task prompt:

```text
Follow docs/MASTER_BUILD_PROMPT.md and docs/DESIGN_SYSTEM_COMPILER.md.

Process this component set:
[FIGMA_COMPONENT_SET_URL]

Existing verified specimen:
[OPTIONAL_SPECIMEN_URL]

Automatically discover and slice variants.
Do not require individual variant links.
Do not full-read the component set unless slicing fails.

Use scoped subagents where useful.
Persist compact IR between workers.
Reuse the existing verified implementation.
Run deterministic visual checks before any subjective visual judgement.

Stop after this component family is verified or a real semantic ambiguity requires escalation.
```

Recommended roles:

```text
Lead
├── Figma Scout
├── Variant/API Planner
├── Implementer
└── Validator
```

## 16. Debugging token explosion

If a Figma read produces tens of thousands of tokens, stop.

Ask:

- Did we deep-read a full component set?
- Could depth=1/shallow metadata build the index?
- Can the selection happen before model context?
- Are unchanged nodes already cached?
- Can one-axis representatives explain the rule?
- Can outliers be detected structurally before deep reads?

The correct fix is usually better slicing, not a bigger context window.

## 17. What success looks like

The first verified component may take significant effort.

The second hierarchy should be cheaper.

The tenth component should reuse:

- transport knowledge;
- tokens;
- fonts;
- validator;
- primitive mappings;
- existing components;
- semantic decisions.

The compiler is working when repeated work disappears.


## 18. Confirm family normalization before compile

Before allowing implementation, inspect the compiler's family summary.

Expected shape:

```text
Component family: Button
Figma component set: <id>
Variant count: N
Canonical React components: 1

State semantics:
Default  → base
Hover    → css:hover
Focused  → css:focus-visible
Disabled → native:disabled
Loading  → runtime:loading
```

If the output instead proposes separate components such as:

```text
ButtonDefault
ButtonHover
ButtonFocused
ButtonDisabled
ButtonLoading
```

stop the run. The component-set normalization step has failed.

Do not continue to code generation until the family mapping and axis classifications are correct.

See [COMPONENT_FAMILY_INVARIANTS.md](./COMPONENT_FAMILY_INVARIANTS.md).


## 19. Inspect semantic plan before production codegen

After family normalization, inspect the semantic plan.

For a Button-like component, expected output should resemble:

~~~text
Component: Button
Primitive: native button

Slots:
- leadingIcon: optional
- label: primary content
- trailingIcon: optional
- loadingIndicator: runtime

Fixtures:
- placeholder circles: visual-test icon fixtures
- "Button CTA": sample label

States:
- Default: base
- Hover: CSS
- Focused: focus-visible
- Disabled: native
- Loading: runtime
~~~

If placeholder assets are being hard-coded into the production Button merely because they appear in the Figma specimen, stop the run and fix semantic classification.

Only continue after the PublicApiPlan is coherent.

A final component should pass semantic/API tests as well as visual tests.

See [COMPONENT_SEMANTICS.md](./COMPONENT_SEMANTICS.md) and [ACCURACY_STRATEGY.md](./ACCURACY_STRATEGY.md).
