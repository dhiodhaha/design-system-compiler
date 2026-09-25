/* Adopted from untitleduico/react@8b7409c078f8 — components/base/select/popover.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's single `<Popover>` element is replaced by
 * `@base-ui/react@1.8.0`'s Popover composition (`Popover.Portal > Popover.Positioner > Popover.Popup`). The
 * overlay rows that used to render this component (select/combobox/tag-select) now own Base UI's own select /
 * combobox popup parts, so this file keeps the popup *surface* (classes, sizing, positioning defaults) as the
 * shared vocabulary they and any future overlay reuse. Like React Aria's `Popover`, it is not standalone: it
 * must be rendered inside a `Popover.Root` that owns the trigger — the unit record is
 * .design-compiler/base-ui-migration/units/select-family.json. */
"use client";

import { Popover as BasePopover, type PopoverPopupState } from "@base-ui/react/popover";
import type { CSSProperties, ReactNode, Ref, RefObject } from "react";
import { cx } from "@/utils/cx";

/** React Aria's `placement` side vocabulary; Base UI positions with a `side` + `align` pair. */
type PopoverSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
/** React Aria's cross-axis alignment; the bare RAC placement strings were start-aligned. */
type PopoverAlign = "start" | "center" | "end";

interface PopoverProps {
    /** The size of the popup, which caps how tall it may grow. */
    size: "sm" | "md" | "lg";
    /** CSS class applied to the popup element, or a function that returns a class based on the popup's state. */
    className?: string | ((state: PopoverPopupState) => string | undefined);
    style?: CSSProperties;
    children?: ReactNode;
    /**
     * React Aria anchored the overlay to the trigger rendered around it; Base UI anchors explicitly, so the
     * trigger element (or a ref to it) is forwarded to `Popover.Positioner`'s `anchor`.
     */
    triggerRef?: RefObject<Element | null> | Element | null;
    /** The side of the anchor the popup is placed on. */
    side?: PopoverSide;
    /** The alignment of the popup relative to the anchor. */
    align?: PopoverAlign;
    /** Distance between the anchor and the popup, in pixels. */
    sideOffset?: number;
    /** Offset along the alignment axis, in pixels. */
    alignOffset?: number;
    /** Minimum distance the popup keeps from the collision boundary, in pixels. */
    collisionPadding?: number;
    ref?: Ref<HTMLDivElement>;
}

/**
 * The positioning React Aria's `placement="bottom"` + `offset={4}` + `containerPadding={0}` used to express,
 * on Base UI's `Positioner`. Shared by every select-family popup so they stay anchored identically.
 */
export const popoverPositionerProps = {
    side: "bottom",
    align: "start",
    sideOffset: 4,
    collisionPadding: 0,
} as const;

/**
 * The popup surface every select-family overlay shares. React Aria's animation state props were render-prop
 * booleans; Base UI exposes the same phases as attributes, so `isEntering` hangs off `data-open` (which covers
 * the whole open phase) and `isExiting` off `data-ending-style` (which covers the whole exit phase). React
 * Aria's `placement-*` variants were dead without `data-rac`, so they are re-pointed at Base UI's `data-side`.
 * `--trigger-width` / `--trigger-anchor-point` are Base UI's `--anchor-width` / `--transform-origin`.
 */
export const popoverPopupClassName = (size: "sm" | "md" | "lg") =>
    cx(
        "w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-primary py-1 shadow-lg ring-1 ring-secondary_alt outline-hidden will-change-transform",

        "data-open:duration-150 data-open:ease-out data-open:animate-in data-open:fade-in",
        "data-open:data-[side=right]:slide-in-from-left-0.5 data-open:data-[side=top]:slide-in-from-bottom-0.5 data-open:data-[side=bottom]:slide-in-from-top-0.5",
        "data-ending-style:duration-100 data-ending-style:ease-in data-ending-style:animate-out data-ending-style:fade-out",
        "data-ending-style:data-[side=right]:slide-out-to-left-0.5 data-ending-style:data-[side=top]:slide-out-to-bottom-0.5 data-ending-style:data-[side=bottom]:slide-out-to-top-0.5",

        size === "sm" && "max-h-56!",
        size === "md" && "max-h-64!",
        size === "lg" && "max-h-80!",
    );

export const Popover = ({
    size,
    className,
    style,
    children,
    triggerRef,
    side,
    align,
    sideOffset,
    alignOffset,
    collisionPadding,
    ref,
}: PopoverProps) => {
    return (
        <BasePopover.Portal>
            <BasePopover.Positioner
                {...popoverPositionerProps}
                side={side ?? popoverPositionerProps.side}
                align={align ?? popoverPositionerProps.align}
                sideOffset={sideOffset ?? popoverPositionerProps.sideOffset}
                alignOffset={alignOffset}
                collisionPadding={collisionPadding ?? popoverPositionerProps.collisionPadding}
                anchor={triggerRef ?? undefined}
                className="outline-hidden"
            >
                <BasePopover.Popup
                    ref={ref}
                    className={(state) => cx(popoverPopupClassName(size), typeof className === "function" ? className(state) : className)}
                    style={style}
                >
                    {children}
                </BasePopover.Popup>
            </BasePopover.Positioner>
        </BasePopover.Portal>
    );
};
