/* Adopted from untitleduico/react@8b7409c078f8 — components/base/buttons/close-button.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import { X as CloseIcon } from "@untitledui/icons";
import type { ComponentPropsWithRef, ReactElement } from "react";
import { useRender } from "@base-ui/react/use-render";
import { cx } from "@/utils/cx";
import type { PressEvents } from "./button";
import { usePressEvents } from "./button";

const sizes = {
    xs: { root: "size-7", icon: "size-4" },
    sm: { root: "size-9", icon: "size-5" },
    md: { root: "size-10", icon: "size-5" },
    lg: { root: "size-11", icon: "size-6" },
};

const themes = {
    light: "text-fg-quaternary hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring",
    dark: "text-fg-white/70 hover:text-fg-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring",
};

/**
 * The component state, passed to a `className` function. Interaction states
 * (`:hover`, `:focus-visible`, `:active`, `:disabled`) are native CSS selectors.
 */
export interface CloseButtonState {
    /** Whether the button is disabled. (`data-disabled`) */
    isDisabled: boolean;
}

interface CloseButtonProps extends Omit<ComponentPropsWithRef<"button">, "children" | "className" | "color" | "disabled" | "slot">, PressEvents {
    theme?: "light" | "dark";
    size?: "xs" | "sm" | "md" | "lg";
    label?: string;
    /**
     * The slot the button fills. Kept for API compatibility: it renders the native
     * `slot` attribute and no longer registers the button with a parent dialog —
     * a dialog's own close part handles that now.
     * @default "close"
     */
    slot?: string | null;
    /** Disables the button and shows a disabled state */
    isDisabled?: boolean;
    className?: string | ((state: CloseButtonState) => string | undefined);
    /**
     * Allows you to replace the button's HTML element with a different tag, or
     * compose it with another component — the same contract as the React Aria
     * `render` prop. Accepts a `ReactElement` or a function returning one.
     */
    render?: useRender.RenderProp<CloseButtonState>;
}

export const CloseButton = ({ label, className, size = "sm", theme = "light", slot = "close", isDisabled, ...otherProps }: CloseButtonProps) => {
    const { ref, render, ...rest } = otherProps;
    const state = { isDisabled: Boolean(isDisabled) } satisfies CloseButtonState;
    // React Aria's press props are consumed here and the consumer's own pointer/keyboard handlers are
    // chained behind the press logic.
    const elementProps = usePressEvents({ ...rest, isDisabled });

    return useRender({
        defaultTagName: "button",
        render,
        state,
        stateAttributesMapping: { isDisabled: (value) => (value ? { "data-disabled": "" } : null) },
        props: {
            ...elementProps,
            // The ref of the element actually rendered.
            ref,
            type: elementProps.type ?? "button",
            disabled: isDisabled,
            slot,
            "aria-label": label || "Close",
            className: cx(
                "flex cursor-pointer items-center justify-center rounded-lg p-2 transition duration-100 ease-linear focus:outline-hidden",
                sizes[size].root,
                themes[theme],
                typeof className === "function" ? className(state) : className,
            ),
            children: <CloseIcon aria-hidden="true" className={cx("shrink-0 transition-inherit-all", sizes[size].icon)} />,
        },
    }) as ReactElement<any>;
};
