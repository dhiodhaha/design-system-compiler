/* Adopted from untitleduico/react@8b7409c078f8 — components/base/avatar/base-components/avatar-add-button.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import { Plus } from "@untitledui/icons";
import type { ComponentPropsWithRef } from "react";
import type { PressEvents } from "@/components/base/buttons/button";
import { usePressEvents } from "@/components/base/buttons/button";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

const sizes = {
    xs: { root: "size-6", icon: "size-4" },
    sm: { root: "size-8", icon: "size-4" },
    md: { root: "size-10", icon: "size-5" },
};

interface AvatarAddButtonProps extends Omit<ComponentPropsWithRef<"button">, "children" | "className" | "color" | "disabled" | "slot">, PressEvents {
    size: "xs" | "sm" | "md";
    title?: string;
    className?: string;
    /** Disables the button and shows a disabled state */
    isDisabled?: boolean;
    /** The slot the rendered button fills. Renders no attribute when `null`. */
    slot?: string | null;
}

export const AvatarAddButton = ({ size, className, title = "Add user", slot, isDisabled, ...props }: AvatarAddButtonProps) => {
    // React Aria's press props are resolved into native handlers so the trigger button keeps React Aria's
    // press API, and the consumer's own handlers are chained behind the press logic.
    const elementProps = usePressEvents({ ...props, isDisabled });

    return (
        <Tooltip title={title}>
            <TooltipTrigger
                {...elementProps}
                isDisabled={isDisabled}
                // `null` opts out of the slot; the native attribute only knows `undefined`.
                slot={slot ?? undefined}
                aria-label={title}
                className={cx(
                    "flex cursor-pointer items-center justify-center rounded-full border border-dashed border-primary bg-primary text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50",
                    sizes[size].root,
                    className,
                )}
            >
                <Plus className={cx("text-current transition-inherit-all", sizes[size].icon)} />
            </TooltipTrigger>
        </Tooltip>
    );
};
