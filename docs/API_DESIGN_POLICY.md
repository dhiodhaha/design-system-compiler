# API Design Policy

This document defines how the compiler turns Figma semantics into a production React API.

## Reference policy

The compiler uses different sources for different kinds of truth:

~~~text
Figma
→ visual truth
→ tokens, spacing, typography, radius, effects, dimensions, visual states

shadcn
→ API ergonomics and distribution reference
→ source-owned components, composition, registry patterns, editable source

native HTML / Base UI
→ behavior and accessibility foundations

Design System Compiler
→ semantic translation, reuse, policy enforcement, code generation, verification
~~~

No one source owns everything.

## Hard rule: do not copy shadcn visually

Shadcn is not the visual source of truth.

Do not copy:

- shadcn colors;
- shadcn spacing;
- shadcn radii;
- shadcn shadows;
- shadcn focus rings;
- shadcn component appearance;
- shadcn component-specific visual defaults;

unless the Figma design independently specifies the same result.

The production component must look like the target Figma design system.

## Hard rule: do not translate Figma props 1:1

Figma properties are design-authoring evidence, not automatically public React props.

Bad:

~~~tsx
<Button
  leadingIcon
  trailingIcon={false}
  iconOnly={false}
  state="hover"
/>
~~~

Preferred direction:

~~~tsx
<Button variant="secondary" size="md">
  <PlusIcon />
  Add user
</Button>
~~~

The compiler must pass through semantic/API synthesis before code generation.

## API policy defaults

Unless component-specific evidence requires otherwise, prefer:

~~~text
composition-first
native props preserved
small orthogonal variant axes
CVA or equivalent variant rules
slots over fixture props
children for primary content
compound components for complex composition
framework-agnostic core
source-owned output
explicit unsupported combinations
no boolean-prop explosion
~~~

## Native props

If the semantic root is a native element, preserve its normal React props.

For a Button:

~~~tsx
<Button type="submit">Submit</Button>
<Button onClick={handleClick}>Continue</Button>
<Button disabled>Delete</Button>
<Button aria-label="Open settings" size="icon-md">
  <SettingsIcon />
</Button>
~~~

Do not replace native behavior with proprietary props unless necessary.

## Icon slots

Figma placeholder icons are evidence of slots, not production dependencies.

The production API should allow real icons:

~~~tsx
<Button>
  <PlusIcon />
  Add user
</Button>

<Button>
  Continue
  <ArrowRightIcon />
</Button>
~~~

The compiler may internally understand leading and trailing slots even when the public API uses child ordering/composition.

The visual test harness may use Figma placeholder fixtures to match the source specimen exactly.

## Loading

Loading is usually controlled runtime state.

Preferred production direction:

~~~tsx
<Button loading={isPending}>
  Save
</Button>

<Button loading={isPending} loadingText="Saving...">
  Save
</Button>
~~~

The core Button should not automatically decide that every click means loading.

A higher-level AsyncButton or application wrapper may own async orchestration if the project wants it.

"Submitting..." found in Figma should normally be treated as specimen content unless the design system explicitly documents it as a fixed label.

## State policy

Typical mapping:

~~~text
Default  → base styles
Hover    → CSS :hover
Focused  → CSS :focus-visible
Disabled → native disabled + CSS
Loading  → runtime state
~~~

Do not expose hover/focus as ordinary production props merely because they exist as Figma variants.

A test harness may force those states internally for visual verification.

## Variant policy

Prefer orthogonal variants:

~~~tsx
<Button
  variant="secondary"
  intent="danger"
  size="lg"
  loading={isPending}
>
  Delete project
</Button>
~~~

Avoid flattened combinations:

~~~text
primary
primaryDanger
primaryDangerHover
secondaryDangerDisabled
...
~~~

Use compound variants only when the design proves axes interact.

## Component vs recipe/block

Use shadcn-like distinction:

~~~text
Button
Input
Tooltip
Dialog shell
→ reusable design-system components

PaymentDetailsDialog
InviteUserDialog
CheckoutSummary
→ recipes/blocks/compositions unless deliberately promoted
~~~

A large Figma Type axis must not automatically become one giant string-union prop.

## Source ownership

Generated components should be source-owned by the consumer when distributed.

Desired model:

~~~bash
npx ds-compiler add button
~~~

The consumer receives editable component source plus declared dependencies.

This is inspired by shadcn's distribution model, but the generated visuals and semantics remain specific to the compiled design system.

## Registry policy

A registry item should declare:

- source files;
- design-token dependencies;
- component dependencies;
- runtime dependencies;
- optional primitive dependencies;
- framework adapter requirements;
- verification status.

Registry metadata must not imply that the component visually matches shadcn.

## Base UI policy

Base UI is preferred for complex behavioral primitives when useful.

Examples:

~~~text
Dialog
Tooltip
Popover
Menu
Select
~~~

Native HTML is preferred when it is already sufficient.

Example:

~~~text
Button
→ native <button> is normally sufficient
~~~

The public API belongs to this design system; Base UI remains an implementation foundation.

## PublicApiPlan requirements

Before codegen, the planner should resolve:

~~~text
component name
semantic root / primitive
public variant props
runtime props
native props preserved
content slots
composition strategy
state mappings
unsupported combinations
accessibility requirements
fixture exclusions
~~~

Example Button plan:

~~~text
component: Button
root: button

props:
- variant
- size
- intent when supported
- loading
- loadingText when useful

native:
- type
- disabled
- onClick
- aria-*
- data-*

content:
- label/content via children
- leading/trailing visual via composition
- icon-only derived from content/size policy

states:
- hover → CSS
- focus → CSS
- disabled → native
- loading → runtime

fixtures excluded from production:
- placeholder circles
- "Button CTA"
- "Submitting..."
~~~

## API verification

A component API should fail semantic verification if it:

- exposes hover/focus as normal consumer props without a strong reason;
- hard-codes Figma placeholder assets;
- turns every Figma boolean into a React boolean prop;
- duplicates native HTML props unnecessarily;
- creates separate public components for ordinary state variants;
- copies shadcn visual styling instead of Figma;
- hides required behavior in framework-specific code;
- invents unsupported combinations.

## Reference hierarchy

When designing the production API:

~~~text
1. explicit design-system semantics/documentation
2. native platform semantics
3. existing verified local API conventions
4. Base UI primitive contract when used
5. shadcn-style ergonomic patterns
6. deterministic compiler policy
7. Jev/model decision when still ambiguous
8. human review
~~~

Shadcn is a teacher for API ergonomics and source distribution, not an authority over the target design system.

## Final formula

~~~text
Figma appearance
+
semantic compiler
+
shadcn-like ergonomics
+
native/Base UI behavior
+
deterministic verification
=
production design-system component
~~~
