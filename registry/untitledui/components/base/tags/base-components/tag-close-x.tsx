/* Adopted from untitleduico/react@8b7409c078f8 — components/base/tags/base-components/tag-close-x.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { ComponentPropsWithRef, ReactElement } from "react";
import { XClose } from "@untitledui/icons";
import { useRender } from "@base-ui/react/use-render";
import type { PressEvents } from "@/components/base/buttons/button";
import { usePressEvents } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

interface TagCloseXProps extends Omit<ComponentPropsWithRef<"button">, "children" | "className" | "disabled" | "slot">, PressEvents {
    size?: "sm" | "md" | "lg";
    className?: string;
    /** Disables the button and shows a disabled state. */
    isDisabled?: boolean;
    /**
     * Whether the button is removed from the tab order. The tag itself handles removal from the
     * keyboard when it can, so the button stays out of the way.
     */
    excludeFromTabOrder?: boolean;
    /**
     * The slot the button fills. Kept for API compatibility: it renders the native `slot`
     * attribute and no longer registers the button with a parent collection.
     * @default "remove"
     */
    slot?: string | null;
    /**
     * Allows you to replace the button's HTML element with a different tag, or compose it with
     * another component — the same contract as every Base UI part. Accepts a `ReactElement` or
     * a function returning one.
     */
    render?: useRender.RenderProp<{ isDisabled: boolean }>;
}

const styles = {
    sm: { root: "p-0.5", icon: "size-2.5 stroke-[3.6px]" },
    md: { root: "p-0.5", icon: "size-3 stroke-[2.86px]" },
    lg: { root: "p-0.75", icon: "size-3.5 stroke-3" },
};

export const TagCloseX = ({
    size = "md",
    className,
    isDisabled,
    excludeFromTabOrder,
    slot = "remove",
    "aria-label": ariaLabel = "Remove this tag",
    ...otherProps
}: TagCloseXProps) => {
    const { ref, render, ...rest } = otherProps;
    // React Aria's press props are consumed here (never spread onto the DOM) and the consumer's own
    // pointer/keyboard handlers are chained behind the press logic.
    const elementProps = usePressEvents({ ...rest, isDisabled });

    return useRender({
        defaultTagName: "button",
        render,
        state: { isDisabled: Boolean(isDisabled) },
        stateAttributesMapping: { isDisabled: (value) => (value ? { "data-disabled": "" } : null) },
        props: {
            ...elementProps,
            ref,
            type: elementProps.type ?? "button",
            disabled: isDisabled,
            tabIndex: excludeFromTabOrder ? -1 : elementProps.tabIndex,
            slot,
            "aria-label": ariaLabel,
            className: cx(
                "flex cursor-pointer rounded-[3px] text-fg-quaternary outline-transparent transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed",
                styles[size].root,
                className,
            ),
            children: <XClose className={cx("transition-inherit-all", styles[size].icon)} />,
        },
    }) as ReactElement<any>;
};
