import { createRoot } from "react-dom/client";
import { Button, Spinner, buttonVariants, type ButtonSize, type ButtonVariant } from "./components/ui/button";
import { PlaceholderCircleIcon } from "./fixtures/placeholder-circle";
import "./index.css";

/**
 * Behavioral specimen page. Not a visual specimen — it exists so `visual/behavior.mjs` can exercise real
 * interaction on the compiled component (hover, keyboard focus, disabled, loading, activation) and so
 * axe-core can scan a page that contains the component in every state.
 *
 * Events are recorded on window.__events so assertions read observed behaviour instead of trusting code.
 */
declare global {
  interface Window {
    __events: Array<{ type: string; key: string }>;
  }
}
window.__events = [];

const log = (type: string, key: string) => () => window.__events.push({ type, key });

const cases: Array<{ key: string; variant?: ButtonVariant; size?: ButtonSize; disabled?: boolean; loading?: boolean; iconOnly?: boolean }> = [
  { key: "primary", variant: "primary" },
  { key: "secondary", variant: "secondary" },
  { key: "tertiary", variant: "tertiary" },
  { key: "link-color", variant: "link-color" },
  { key: "link-gray", variant: "link-gray" },
  { key: "size-xl", size: "xl" },
  { key: "disabled", disabled: true },
  { key: "loading", loading: true },
  { key: "icon-only", iconOnly: true },
];

createRoot(document.getElementById("behavior")!).render(
  <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, display: "flex", flexDirection: "column", gap: 16, alignItems: "start" }}>
    <h1 style={{ fontSize: 16, margin: 0 }}>Button behavioral specimens</h1>
    {cases.map((c) => (
      <Button
        key={c.key}
        data-testid={`case-${c.key}`}
        variant={c.variant}
        size={c.size}
        disabled={c.disabled}
        loading={c.loading}
        iconOnly={c.iconOnly}
        loadingText="Submitting..."
        leadingIcon={c.iconOnly ? undefined : <PlaceholderCircleIcon />}
        trailingIcon={c.iconOnly ? undefined : <PlaceholderCircleIcon />}
        aria-label={c.iconOnly ? "Settings" : undefined}
        onClick={log("click", c.key)}
      >
        {c.iconOnly ? <PlaceholderCircleIcon /> : c.loading ? "Submitting..." : "Button CTA"}
      </Button>
    ))}
    <Button data-testid="case-keyboard" onClick={log("click", "keyboard")}>
      Keyboard target
    </Button>
    {/* composition-first form (API_DESIGN_POLICY.md "Icon slots") */}
    <Button data-testid="case-composed-leading">
      <PlaceholderCircleIcon />
      Composed leading
    </Button>
    <Button data-testid="case-composed-trailing">
      Composed trailing
      <PlaceholderCircleIcon />
    </Button>
    {/* shadcn-style surface */}
    <Button data-testid="case-icon-size" size="icon-lg" aria-label="Icon size sugar">
      <PlaceholderCircleIcon />
    </Button>
    <Button data-testid="case-marked-slots" variant="tertiary">
      <PlaceholderCircleIcon data-icon="inline-start" />
      Marked slots
      <PlaceholderCircleIcon data-icon="inline-end" />
    </Button>
    <Button data-testid="case-composed-spinner" disabled>
      <Spinner data-icon="inline-start" />
      Generating
    </Button>
    <a data-testid="case-variants-helper" href="#link" {...buttonVariants({ variant: "secondary", size: "sm" })}>
      Link styled by buttonVariants
    </a>
  </main>,
);
