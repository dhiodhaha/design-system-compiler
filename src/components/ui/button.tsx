import { Children, forwardRef, isValidElement, type ComponentPropsWithRef, type ReactNode } from "react";
import { ButtonSpinnerIcon } from "../icons/spinner";
import { FIGMA_VARIANT, SIZES, SUPPORTS_ICON_ONLY, UNSUPPORTED, VARIANTS, type ButtonSize, type ButtonVariant, type ButtonVisualState } from "./button.abi";

/**
 * Button — compiled from Figma `Buttons/Button` (component set 3287:427074), 200 variants.
 *
 * Production contract
 *   • Rendering     native <button>, all native props preserved (type, disabled, onClick, form, aria-*, data-*)
 *   • Styling hook  data-variant / data-size / data-icon-only / data-state — the same values as the public
 *                   props. Figma's authoring vocabulary never reaches the DOM. Rules live in the generated
 *                   src/styles/button.theme.css; tokens in src/styles/tokens.css.
 *   • Composition   <Button><PlusIcon /> Add user</Button> — an element child in the leading or trailing
 *                   position fills that visual slot; explicit leadingIcon/trailingIcon props win.
 *   • States        hover = :hover, focus = :focus-visible, disabled = native disabled, loading = runtime.
 *                   A visual test may force a state by passing data-state (plain attribute), not via a prop.
 *   • Loading       sets aria-busy, keeps focus, and blocks activation (no double submit). `loadingText`
 *                   defaults to the normal label; Figma's "Submitting..." is specimen content, not a default.
 *   • Motion        the generated stylesheet disables transitions under prefers-reduced-motion and keeps a
 *                   visible border under forced-colors.
 *
 * Unsupported: Figma defines no Link color / Link gray icon-only variant (50 combinations,
 * .design-compiler/ir/unsupported.json). Those are rejected in dev and have no styles.
 */
export type { ButtonVariant, ButtonSize, ButtonVisualState };

/** Ergonomics from shadcn's base Button: icon sizes are size values, not a separate boolean. */
export type ButtonIconSize = "icon" | "icon-xs" | "icon-sm" | "icon-lg" | "icon-xl";
export type ButtonSizeProp = ButtonSize | ButtonIconSize;

const ICON_SIZE: Record<ButtonIconSize, ButtonSize> = { "icon": "md", "icon-xs": "xs", "icon-sm": "sm", "icon-lg": "lg", "icon-xl": "xl" };
const isIconSize = (size: string): size is ButtonIconSize => size in ICON_SIZE;

/**
 * The public styling contract as a spreadable object — the same contract <Button> writes, so a plain
 * anchor/Link can look like a button without wrapping it (shadcn's `buttonVariants` equivalent):
 *
 *   <a href="/login" {...buttonVariants({ variant: "secondary", size: "sm" })}>Login</a>
 */
export function buttonVariants({ variant = "primary", size = "xs", className }: { variant?: ButtonVariant; size?: ButtonSizeProp; className?: string } = {}) {
  const iconOnly = isIconSize(size);
  const base = iconOnly ? ICON_SIZE[size] : size;
  return {
    className: ["ds-button", className].filter(Boolean).join(" "),
    "data-ds-button": "",
    "data-slot": "button",
    "data-variant": variant,
    "data-size": base,
    "data-icon-only": iconOnly ? "true" : "false",
  } as const;
}

export interface ButtonProps extends Omit<ComponentPropsWithRef<"button">, "color"> {
  /** Visual hierarchy. Maps to Figma `Hierarchy`. */
  variant?: ButtonVariant;
  /** Figma `Size`; `icon*` values also set the icon-only layout (shadcn ergonomics). */
  size?: ButtonSizeProp;
  /** Figma `Icon only=True`: a single icon, no label. Requires an accessible name. */
  iconOnly?: boolean;
  /** Runtime pending state: aria-busy, activation blocked, spinner in the leading slot. */
  loading?: boolean;
  /** Label shown while loading. Defaults to `children`; never baked from the Figma specimen. */
  loadingText?: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const isDev = (() => {
  // framework-agnostic: works under Vite, Next, TanStack Start and plain bundlers
  try {
    return typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
  } catch {
    return false;
  }
})();

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "xs", iconOnly = false, loading = false, loadingText, leadingIcon, trailingIcon, disabled, type = "button", children, className, onClick, ...props },
  ref,
) {
  const sizeIsIcon = isIconSize(size);
  const resolvedSize: ButtonSize = sizeIsIcon ? ICON_SIZE[size] : size;
  const resolvedIconOnly = iconOnly || sizeIsIcon;
  if (isDev) {
    if (!VARIANTS.includes(variant)) console.warn(`[Button] unknown variant "${variant}". Known: ${VARIANTS.join(", ")}.`);
    if (!isIconSize(size) && !SIZES.includes(size as ButtonSize)) console.warn(`[Button] unknown size "${size}". Known: ${SIZES.join(", ")} and ${Object.keys(ICON_SIZE).join(", ")}.`);
    if (resolvedIconOnly && !SUPPORTS_ICON_ONLY.includes(variant)) {
      console.warn(
        `[Button] unsupported combination: variant="${variant}" iconOnly — the Figma component set defines no such variant (known unsupported: ${UNSUPPORTED.map((u) => u.variant).join(", ")}).`,
      );
    }
    if (resolvedIconOnly && !props["aria-label"] && !props["aria-labelledby"]) {
      console.warn("[Button] iconOnly renders no text: provide aria-label or aria-labelledby.");
    }
  }
  const unsupported = resolvedIconOnly && !SUPPORTS_ICON_ONLY.includes(variant);

  // No state prop. Real states are native/CSS; a visual-regression harness may force one by passing the
  // `data-state` attribute (ordinary attribute passthrough), so production carries no test-only API.
  const forcedState = (props as { "data-state"?: ButtonVisualState })["data-state"];
  const resolvedState = loading ? "loading" : disabled ? "disabled" : forcedState;

  // Composition-first slots. Precedence: explicit props > `data-icon="inline-start|inline-end"` markers
  // (shadcn's convention) > element child in the leading/trailing position.
  let leading = leadingIcon;
  let trailing = trailingIcon;
  let content: ReactNode = children;
  if (!resolvedIconOnly) {
    let items = Children.toArray(children);
    const marked = (node: ReactNode) => (isValidElement(node) ? ((node.props as Record<string, unknown>)["data-icon"] as string | undefined) : undefined);
    const explicitStart = items.find((n) => marked(n) === "inline-start");
    const explicitEnd = items.find((n) => marked(n) === "inline-end");
    if (!leading && explicitStart) {
      leading = explicitStart;
      items = items.filter((n) => n !== explicitStart);
    }
    if (!trailing && explicitEnd) {
      trailing = explicitEnd;
      items = items.filter((n) => n !== explicitEnd);
    }
    if (!leading && !explicitStart && items.length > 1 && isValidElement(items[0])) {
      leading = items[0];
      items = items.slice(1);
    }
    if (!trailing && !explicitEnd && items.length > 1 && isValidElement(items[items.length - 1])) {
      trailing = items[items.length - 1];
      items = items.slice(0, -1);
    }
    content = items.length ? items : children;
  }

  const label = loading && loadingText !== undefined ? loadingText : content;
  // loading keeps the button focusable and announced, but must not fire actions
  const interactive = !loading && !disabled;

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      data-ds-button=""
      data-slot="button"
      data-variant={variant}
      data-size={resolvedSize}
      data-icon-only={resolvedIconOnly ? "true" : "false"}
      data-state={resolvedState}
      data-unsupported={unsupported || undefined}
      data-figma-variant={FIGMA_VARIANT[variant]}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading && !disabled ? true : undefined}
      className={className}
      onClick={(event) => {
        if (!interactive) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
      onKeyDown={(event) => {
        if (loading && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          return;
        }
        props.onKeyDown?.(event);
      }}
    >
      {iconOnly ? (
        <span data-slot="icon" aria-hidden="true">
          {loading ? <ButtonSpinnerIcon size={resolvedSize} /> : content}
        </span>
      ) : (
        <>
          {leading || loading ? (
            <span data-slot={loading ? "spinner" : "icon"} aria-hidden="true">
              {loading ? <ButtonSpinnerIcon size={resolvedSize} /> : leading}
            </span>
          ) : null}
          {label ? <span data-slot="label">{label}</span> : null}
          {trailing ? (
            <span data-slot="icon" aria-hidden="true">
              {trailing}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
});

/** Spinner for composition: <Button disabled><Spinner data-icon=\"inline-start\" /> Generating</Button> */
export { ButtonSpinnerIcon as Spinner };
