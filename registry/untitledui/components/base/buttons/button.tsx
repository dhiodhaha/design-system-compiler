/* Adopted from untitleduico/react@8b7409c078f8 — components/base/buttons/button.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { ComponentPropsWithRef, FC, ReactElement, ReactNode } from "react";
import { isValidElement, useRef } from "react";
import { useRender } from "@base-ui/react/use-render";
import { cx, sortCx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";

export const styles = sortCx({
    common: {
        root: [
            "group relative inline-flex h-max cursor-pointer items-center justify-center whitespace-nowrap outline-brand transition duration-100 ease-linear before:absolute focus-visible:outline-2 focus-visible:outline-offset-2",
            // When button is used within `InputGroup`
            "in-data-input-wrapper:shadow-xs in-data-input-wrapper:focus:!z-50 in-data-input-wrapper:in-data-leading:-mr-px in-data-input-wrapper:in-data-leading:rounded-r-none in-data-input-wrapper:in-data-leading:before:rounded-r-none in-data-input-wrapper:in-data-trailing:-ml-px in-data-input-wrapper:in-data-trailing:rounded-l-none in-data-input-wrapper:in-data-trailing:before:rounded-l-none",
            // Disabled styles
            "disabled:cursor-not-allowed disabled:opacity-50 in-data-input-wrapper:disabled:opacity-100",
            // Same as `icon` but for SSR icons that cannot be passed to the client as functions.
            "*:data-icon:pointer-events-none *:data-icon:size-5 *:data-icon:shrink-0 *:data-icon:transition-inherit-all",
        ].join(" "),
        icon: "pointer-events-none size-5 shrink-0 transition-inherit-all",
    },
    sizes: {
        xs: {
            root: [
                "gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold before:rounded-[7px] data-icon-only:p-2",
                "in-data-input-wrapper:px-3.5 in-data-input-wrapper:py-2.5 in-data-input-wrapper:data-icon-only:p-2.5",
                "*:data-icon:size-4 *:data-icon:stroke-[2.25px]",
            ].join(" "),
            linkRoot: "gap-1 *:data-text:underline-offset-3",
        },
        sm: {
            root: [
                "gap-1 rounded-lg px-3 py-2 text-sm font-semibold before:rounded-[7px] data-icon-only:p-2",
                "in-data-input-wrapper:px-3.5 in-data-input-wrapper:py-2.5 in-data-input-wrapper:data-icon-only:p-2.5",
            ].join(" "),
            linkRoot: "gap-1 *:data-text:underline-offset-3",
        },
        md: {
            root: [
                "gap-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold before:rounded-[7px] data-icon-only:p-2.5",
                "in-data-input-wrapper:gap-1.5 in-data-input-wrapper:px-4 in-data-input-wrapper:text-md in-data-input-wrapper:data-icon-only:p-3",
            ].join(" "),
            linkRoot: "gap-1 *:data-text:underline-offset-4",
        },
        lg: {
            root: "gap-1.5 rounded-lg px-4 py-2.5 text-md font-semibold before:rounded-[7px] data-icon-only:p-3",
            linkRoot: "gap-1.5 *:data-text:underline-offset-4",
        },
        xl: {
            root: "gap-1.5 rounded-lg px-4.5 py-3 text-md font-semibold before:rounded-[7px] data-icon-only:p-3.5",
            linkRoot: "gap-1.5 *:data-text:underline-offset-4",
        },
    },

    colors: {
        primary: {
            root: [
                "bg-brand-solid text-white shadow-xs-skeuomorphic ring-1 ring-transparent ring-inset hover:bg-brand-solid_hover data-loading:bg-brand-solid_hover",
                // Inner border gradient
                "before:absolute before:inset-px before:border before:border-white/12 before:mask-b-from-0%",
                // Icon styles
                "*:data-icon:text-white/60 hover:*:data-icon:text-white/70",
            ].join(" "),
        },
        secondary: {
            root: [
                "bg-primary text-secondary shadow-xs-skeuomorphic ring-1 ring-primary ring-inset hover:bg-primary_hover hover:text-secondary_hover data-loading:bg-primary_hover",
                // Icon styles
                "*:data-icon:text-fg-quaternary hover:*:data-icon:text-fg-quaternary_hover",
            ].join(" "),
        },
        tertiary: {
            root: [
                "text-tertiary hover:bg-primary_hover hover:text-tertiary_hover data-loading:bg-primary_hover",
                // Icon styles
                "*:data-icon:text-fg-quaternary hover:*:data-icon:text-fg-quaternary_hover",
            ].join(" "),
        },
        "link-color": {
            root: [
                "justify-normal rounded p-0! text-brand-secondary hover:text-brand-secondary_hover",
                // Inner text underline
                "*:data-text:underline *:data-text:decoration-transparent hover:*:data-text:decoration-fg-brand-secondary_alt",
                // Icon styles
                "*:data-icon:text-fg-brand-secondary_alt hover:*:data-icon:text-fg-brand-secondary_hover",
            ].join(" "),
        },
        "link-gray": {
            root: [
                "justify-normal rounded p-0! text-tertiary hover:text-tertiary_hover",
                // Inner text underline
                "*:data-text:underline *:data-text:decoration-transparent hover:*:data-text:decoration-fg-quaternary",
                // Icon styles
                "*:data-icon:text-fg-quaternary hover:*:data-icon:text-fg-quaternary_hover",
            ].join(" "),
        },
        "primary-destructive": {
            root: [
                "bg-error-solid text-white shadow-xs-skeuomorphic ring-1 ring-transparent outline-error ring-inset hover:bg-error-solid_hover data-loading:bg-error-solid_hover",
                // Inner border gradient
                "before:absolute before:inset-px before:border before:border-white/12 before:mask-b-from-0%",
                // Icon styles
                "*:data-icon:text-white/60 hover:*:data-icon:text-white/70",
            ].join(" "),
        },
        "secondary-destructive": {
            root: [
                "bg-primary text-error-primary shadow-xs-skeuomorphic ring-1 ring-error_subtle outline-error ring-inset hover:bg-error-primary hover:text-error-primary_hover data-loading:bg-error-primary",
                // Icon styles
                "*:data-icon:text-fg-error-secondary hover:*:data-icon:text-fg-error-primary",
            ].join(" "),
        },
        "tertiary-destructive": {
            root: [
                "text-error-primary outline-error hover:bg-error-primary hover:text-error-primary_hover data-loading:bg-error-primary",
                // Icon styles
                "*:data-icon:text-fg-error-secondary hover:*:data-icon:text-fg-error-primary",
            ].join(" "),
        },
        "link-destructive": {
            root: [
                "justify-normal rounded p-0! text-error-primary outline-error hover:text-error-primary_hover",
                // Inner text underline
                "*:data-text:underline *:data-text:decoration-transparent *:data-text:underline-offset-2 hover:*:data-text:decoration-current",
                // Icon styles
                "*:data-icon:text-fg-error-secondary hover:*:data-icon:text-fg-error-primary",
            ].join(" "),
        },
    },
});

/**
 * Common props shared between button and anchor variants
 */
export interface CommonProps {
    /** Disables the button and shows a disabled state */
    isDisabled?: boolean;
    /** Shows a loading spinner and disables the button */
    isLoading?: boolean;
    /** The size variant of the button */
    size?: keyof typeof styles.sizes;
    /** The color variant of the button */
    color?: keyof typeof styles.colors;
    /** Icon component or element to show before the text */
    iconLeading?: FC<{ className?: string }> | ReactNode;
    /** Icon component or element to show after the text */
    iconTrailing?: FC<{ className?: string }> | ReactNode;
    /** Removes horizontal padding from the text content */
    noTextPadding?: boolean;
    /** When true, keeps the text visible during loading state */
    showTextWhileLoading?: boolean;

    children?: ReactNode;
    className?: string;
}

/** The pointer type that triggered a press event. */
export type PressPointerType = "mouse" | "pen" | "touch" | "keyboard" | "virtual";

/**
 * React Aria's press event payload, rebuilt from the native pointer and keyboard events so callers keep
 * receiving the same object. `x`/`y`/`clientX`/`clientY` are viewport coordinates: React Aria measured `x`/`y`
 * relative to the element, which no caller in this payload reads.
 */
export interface PressEvent {
    /** The type of press event being fired. */
    type: "pressstart" | "pressend" | "pressup" | "press";
    /** The pointer type that triggered the press event. */
    pointerType: PressPointerType;
    /** The target element of the press event. */
    target: Element;
    /** Whether the shift keyboard modifier was held during the press event. */
    shiftKey: boolean;
    /** Whether the ctrl keyboard modifier was held during the press event. */
    ctrlKey: boolean;
    /** Whether the meta keyboard modifier was held during the press event. */
    metaKey: boolean;
    /** Whether the alt keyboard modifier was held during the press event. */
    altKey: boolean;
    /** X position relative to the viewport. */
    x: number;
    /** Y position relative to the viewport. */
    y: number;
    /** X position relative to the viewport. */
    clientX: number;
    /** Y position relative to the viewport. */
    clientY: number;
    /** The key that triggered the press event, if it was triggered by a keyboard interaction. */
    key?: string;
    /** Press events never stop propagation, so a parent handler always receives the event too. */
    continuePropagation(): void;
}

/** React Aria's press handler props. */
export interface PressEvents {
    /** Handler that is called when the press is released over the target. */
    onPress?: (event: PressEvent) => void;
    /** Handler that is called when a press interaction starts. */
    onPressStart?: (event: PressEvent) => void;
    /** Handler that is called when a press interaction ends, either over the target or when the pointer leaves it. */
    onPressEnd?: (event: PressEvent) => void;
    /** Handler that is called when a press is released over the target, regardless of where it started. */
    onPressUp?: (event: PressEvent) => void;
    /** Handler that is called when the press state changes. */
    onPressChange?: (isPressed: boolean) => void;
}

/** The native handlers the press layer wraps, so a consumer's own handlers keep firing. */
interface PressNativeHandlers {
    onClick?: React.MouseEventHandler<Element>;
    onPointerDown?: React.PointerEventHandler<Element>;
    onPointerUp?: React.PointerEventHandler<Element>;
    onPointerLeave?: React.PointerEventHandler<Element>;
    onKeyDown?: React.KeyboardEventHandler<Element>;
    onKeyUp?: React.KeyboardEventHandler<Element>;
}

interface ActivePress {
    pointerType: PressPointerType;
    key?: string;
}

/**
 * React Aria's press events, rebuilt on native pointer and keyboard events: a press starts on pointer down
 * (or Enter/Space key down), activates through the native click, and ends when the pointer leaves the
 * element. A disabled button starts no press at all, and a pending one is blocked exactly like React Aria's
 * `isPending`. The press props are consumed here (never spread onto the DOM) and the consumer's own handlers
 * for the same native events are chained after the press logic.
 */
export const usePressEvents = <Props extends PressEvents & PressNativeHandlers & Record<string, unknown>>(
    props: Props & { isDisabled?: boolean; isLoading?: boolean },
): Omit<Props, keyof PressEvents | "isDisabled" | "isLoading"> & PressNativeHandlers => {
    const {
        isDisabled,
        isLoading,
        onPress,
        onPressStart,
        onPressEnd,
        onPressUp,
        onPressChange,
        onClick,
        onPointerDown,
        onPointerUp,
        onPointerLeave,
        onKeyDown,
        onKeyUp,
        ...rest
    } = props;
    const isBlocked = Boolean(isDisabled) || Boolean(isLoading);
    // The press in flight, and a press released over the target that is waiting for its native click.
    const active = useRef<ActivePress | null>(null);
    const released = useRef<ActivePress | null>(null);

    const createEvent = (
        type: PressEvent["type"],
        event: React.MouseEvent<Element> | React.PointerEvent<Element> | React.KeyboardEvent<Element>,
        press: ActivePress,
    ): PressEvent => {
        const coordinates = "clientX" in event ? { clientX: event.clientX, clientY: event.clientY } : { clientX: 0, clientY: 0 };

        return {
            type,
            pointerType: press.pointerType,
            target: event.target as Element,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            x: coordinates.clientX,
            y: coordinates.clientY,
            clientX: coordinates.clientX,
            clientY: coordinates.clientY,
            key: press.key,
            continuePropagation() {},
        };
    };

    // Press events fire before the consumer's own handler for the same native event, exactly as React Aria
    // merged its press layer behind the consumer's props.
    return {
        ...rest,
        onPointerDown(event: React.PointerEvent<Element>) {
            if (!isBlocked && !active.current && !released.current && !(event.pointerType === "mouse" && event.button !== 0)) {
                active.current = { pointerType: (event.pointerType || "virtual") as PressPointerType };
                onPressChange?.(true);
                onPressStart?.(createEvent("pressstart", event, active.current));
            }

            onPointerDown?.(event);
        },
        onPointerUp(event: React.PointerEvent<Element>) {
            const press = active.current;
            if (press) {
                released.current = press;
                active.current = null;
                onPressUp?.(createEvent("pressup", event, press));
            }

            onPointerUp?.(event);
        },
        onPointerLeave(event: React.PointerEvent<Element>) {
            released.current = null;
            const press = active.current;
            if (press) {
                active.current = null;
                onPressEnd?.(createEvent("pressend", event, press));
                onPressChange?.(false);
            }

            onPointerLeave?.(event);
        },
        onKeyDown(event: React.KeyboardEvent<Element>) {
            // Only the element itself presses: a key event bubbling out of a child is not its own activation.
            if (!isBlocked && !active.current && !released.current && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                active.current = { pointerType: "keyboard", key: event.key };
                onPressChange?.(true);
                onPressStart?.(createEvent("pressstart", event, active.current));
            }

            onKeyDown?.(event);
        },
        onKeyUp(event: React.KeyboardEvent<Element>) {
            const press = active.current;
            if (press && (event.key === "Enter" || event.key === " ")) {
                active.current = null;
                released.current = press;
                onPressUp?.(createEvent("pressup", event, press));

                // Native elements activate themselves (a <button> clicks on Enter/Space, a link on Enter); the
                // link fallback <span> does not, so its activation is dispatched here.
                const target = event.currentTarget;
                const activatesNatively = target.tagName === "BUTTON" || (target instanceof HTMLAnchorElement && target.hasAttribute("href"));
                if (!activatesNatively && !isBlocked) {
                    released.current = null;
                    onPress?.(createEvent("press", event, press));
                    onPressEnd?.(createEvent("pressend", event, press));
                    onPressChange?.(false);
                }
            }

            onKeyUp?.(event);
        },
        onClick(event: React.MouseEvent<Element>) {
            const press = released.current ?? active.current;
            active.current = null;
            released.current = null;
            if (!isBlocked && press) {
                onPress?.(createEvent("press", event, press));
                onPressEnd?.(createEvent("pressend", event, press));
                onPressChange?.(false);
            }

            onClick?.(event);
        },
    };
};

/** The component state, exposed to the `render` callback and mapped onto the `data-*`
 * attributes consumer CSS keys off (`data-disabled`, `data-loading`, `data-icon-only`).
 * Interaction states are native CSS (`:hover`, `:focus-visible`, `:active`, `:disabled`).
 */
export interface ButtonState {
    /** Whether the button is disabled. (`data-disabled`) */
    isDisabled: boolean;
    /** Whether the button shows its loading spinner. (`data-loading`) */
    isLoading: boolean;
    /** Whether the button renders an icon without text. (`data-icon-only`) */
    iconOnly: boolean;
}

/** Props shared by both variants, spread onto the element the button renders. */
interface ElementProps {
    /** The React Aria slot the rendered element fills. Renders no attribute when `null`. */
    slot?: string | null;
    /**
     * Allows you to replace the component's HTML element with a different tag, or
     * compose it with another component — the same contract as the React Aria
     * `render` prop. Accepts a `ReactElement` or a function returning one.
     */
    render?: useRender.RenderProp<ButtonState>;
}

/**
 * Props for the button variant (non-link)
 */
export interface ButtonProps extends CommonProps, Omit<ComponentPropsWithRef<"button">, "children" | "className" | "color" | "disabled" | "slot">, ElementProps {}
/**
 * Props for the link variant (anchor tag)
 */
interface LinkProps extends CommonProps, Omit<ComponentPropsWithRef<"a">, "children" | "className" | "color" | "href" | "slot">, ElementProps {
    /** The link target. Required as a key to select the link variant; renders a non-interactive `span` when empty. */
    href: string;
}

/** Union type of button and link props */
export type Props = ButtonProps | LinkProps;

export const Button: {
    (props: LinkProps): ReactElement<LinkProps>;
    (props: ButtonProps): ReactElement<ButtonProps>;
} = ({
    size = "sm",
    color = "primary",
    children,
    className,
    noTextPadding,
    iconLeading: IconLeading,
    iconTrailing: IconTrailing,
    isDisabled: disabled,
    isLoading: loading,
    showTextWhileLoading,
    ...props
}) => {
    const href = "href" in props ? props.href : undefined;

    const isIcon = Boolean((IconLeading || IconTrailing) && !children);
    const isLinkType = ["link-gray", "link-color", "link-destructive"].includes(color);

    noTextPadding = isLinkType || noTextPadding;

    const commonChildren = (
        <>
            {/* Leading icon */}
            {isValidElement(IconLeading) && IconLeading}
            {isReactComponent(IconLeading) && <IconLeading data-icon="leading" className={styles.common.icon} />}

            {loading && (
                <svg
                    fill="none"
                    data-icon="loading"
                    viewBox="0 0 20 20"
                    className={cx(styles.common.icon, !showTextWhileLoading && "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2")}
                >
                    {/* Background circle */}
                    <circle className="stroke-current opacity-30" cx="10" cy="10" r="8" fill="none" strokeWidth="2" />
                    {/* Spinning circle */}
                    <circle
                        className="origin-center animate-spin stroke-current"
                        cx="10"
                        cy="10"
                        r="8"
                        fill="none"
                        strokeWidth="2"
                        strokeDasharray="12.5 50"
                        strokeLinecap="round"
                    />
                </svg>
            )}

            {children && (
                <span data-text className={cx("transition-inherit-all", !noTextPadding && "px-0.5")}>
                    {children}
                </span>
            )}

            {/* Trailing icon */}
            {isValidElement(IconTrailing) && IconTrailing}
            {isReactComponent(IconTrailing) && <IconTrailing data-icon="trailing" className={styles.common.icon} />}
        </>
    );

    const { ref, render, ...rest } = props;

    // A link without a usable target (empty `href`, or disabled) is not an anchor: it degrades to a
    // `span[role=link]`, exactly as React Aria's link fallback rendered it.
    const isAnchor = Boolean(href) && !disabled;
    const tagName = "href" in props ? (isAnchor ? "a" : "span") : "button";

    // React Aria's press props are consumed here (never spread onto the DOM) and the consumer's own
    // pointer/keyboard handlers are chained behind the press logic. A loading *link* keeps React Aria's
    // link behaviour: its pending state only existed on the button variant.
    const elementProps = usePressEvents({ ...rest, isDisabled: disabled, isLoading: loading && tagName === "button" });

    // `useRender` is generic over the element it renders; the call signatures declared above are this
    // component's public contract (the same element type JSX used to produce here).
    return useRender({
        defaultTagName: tagName,
        render,
        state: { isDisabled: Boolean(disabled), isLoading: Boolean(loading), iconOnly: isIcon },
        stateAttributesMapping: {
            isDisabled: (value) => (value ? { "data-disabled": "" } : null),
            isLoading: (value) => (value ? { "data-loading": "" } : null),
            iconOnly: (value) => (value ? { "data-icon-only": "" } : null),
        },
        props: {
            ...elementProps,
            // The ref of the element actually rendered (button, anchor or fallback span).
            ref,
            ...(tagName === "span"
                ? {
                      // A `span` has no native link semantics, so it carries them explicitly.
                      href: undefined,
                      role: "link",
                      // A consumer tabIndex wins; the fallback is focusable only while it is not disabled.
                      tabIndex: elementProps.tabIndex ?? (disabled ? undefined : 0),
                      "aria-disabled": disabled || elementProps["aria-disabled"],
                  }
                : tagName === "a"
                  ? { href, "aria-disabled": disabled || elementProps["aria-disabled"] }
                  : {
                        // A pending button keeps focus but must not activate or submit.
                        type: loading && elementProps.type === "submit" ? "button" : (elementProps.type ?? "button"),
                        disabled,
                        onClick: loading ? undefined : elementProps.onClick,
                        "aria-disabled": loading ? true : elementProps["aria-disabled"],
                    }),
            className: cx(
                styles.common.root,
                styles.sizes[size].root,
                styles.colors[color].root,
                isLinkType && styles.sizes[size].linkRoot,
                (loading || (href && (disabled || loading))) && "pointer-events-none",
                // If in `loading` state, hide everything except the loading icon (and text if `showTextWhileLoading` is true).
                loading && (showTextWhileLoading ? "[&>*:not([data-icon=loading]):not([data-text])]:hidden" : "[&>*:not([data-icon=loading])]:invisible"),
                // The non-anchor link fallback has no native `disabled`, so the disabled look comes from the state attribute.
                !isAnchor && "href" in props && disabled && "data-disabled:cursor-not-allowed data-disabled:opacity-50",
                className,
            ),
            children: commonChildren,
        },
    }) as ReactElement<any>;
};
