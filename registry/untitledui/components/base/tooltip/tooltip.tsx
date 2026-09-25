/* Adopted from untitleduico/react@8b7409c078f8 — components/base/tooltip/tooltip.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `Tooltip`/`TooltipTrigger`/`OverlayArrow`
 * are replaced by `@base-ui/react@1.8.0` (`Tooltip` = Root > Trigger > Portal > Positioner > Popup > Arrow).
 * Every export, prop name and default is unchanged; only the state hooks the Tailwind classes hang off were
 * re-pointed at Base UI's attributes (`data-open` / `data-ending-style` / `data-side`) — the unit record is
 * .design-compiler/base-ui-migration/units/tooltip-overlay.json. */
"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref, RefObject } from "react";
import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cx } from "@/utils/cx";

/**
 * The placement of the tooltip with respect to the trigger — React Aria's `Placement` vocabulary, kept so
 * `placement` values written against the previous implementation keep working. Base UI positions with a
 * `side` + `align` pair, derived from these values.
 */
export type TooltipPlacement =
    | "top"
    | "top left"
    | "top right"
    | "top start"
    | "top end"
    | "bottom"
    | "bottom left"
    | "bottom right"
    | "bottom start"
    | "bottom end"
    | "left"
    | "left top"
    | "left bottom"
    | "right"
    | "right top"
    | "right bottom"
    | "start"
    | "start top"
    | "start bottom"
    | "end"
    | "end top"
    | "end bottom";

type BaseUiSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
type BaseUiAlign = "start" | "center" | "end";

/** React Aria side tokens → Base UI sides (`start`/`end` are logical, so they stay RTL-aware). */
const BASE_UI_SIDES: Record<string, BaseUiSide> = {
    top: "top",
    bottom: "bottom",
    left: "left",
    right: "right",
    start: "inline-start",
    end: "inline-end",
};

/** React Aria alignment tokens → Base UI alignments (`top`/`left` are the alignment axis' start). */
const BASE_UI_ALIGNMENTS: Record<string, BaseUiAlign> = {
    top: "start",
    left: "start",
    start: "start",
    bottom: "end",
    right: "end",
    end: "end",
    center: "center",
};

const getSideAndAlign = (placement: TooltipPlacement) => {
    const [side, align] = placement.trim().split(/\s+/);

    return { side: BASE_UI_SIDES[side] ?? "top", align: align ? (BASE_UI_ALIGNMENTS[align] ?? "center") : "center" } as const;
};

/** Base UI's `collisionAvoidance` value that keeps React Aria's `shouldFlip={false}` behaviour. */
const NO_FLIP = { side: "none", align: "shift", fallbackAxisSide: "none" } as const;

/**
 * React Aria kept the tooltip "warmup" in module scope (react-stately `useTooltipTriggerState`): once a
 * tooltip has been shown, any other tooltip opens without a delay for a short cooldown window, and opening
 * one closes the others. Base UI only groups delays behind `Tooltip.Provider`, which is opt-in per provider
 * instance, so the original global semantics are kept here.
 */
const WARMUP_COOLDOWN = 500; // React Aria's TOOLTIP_COOLDOWN

let warmedUp = false;
let warmupTimeout: number | null = null;
const warmupSubscribers = new Set<() => void>();
const openTooltips = new Map<string, () => void>();

const subscribeToWarmup = (onStoreChange: () => void) => {
    warmupSubscribers.add(onStoreChange);

    return () => {
        warmupSubscribers.delete(onStoreChange);
    };
};

const setWarmedUp = (value: boolean) => {
    if (warmedUp === value) {
        return;
    }

    warmedUp = value;
    warmupSubscribers.forEach((subscriber) => subscriber());
};

const clearWarmupTimeout = () => {
    if (warmupTimeout !== null) {
        window.clearTimeout(warmupTimeout);
        warmupTimeout = null;
    }
};

const showTooltip = (id: string) => {
    clearWarmupTimeout();
    openTooltips.forEach((close, openId) => {
        if (openId !== id) close();
    });
    setWarmedUp(true);
};

const hideTooltip = (closeDelay: number) => {
    clearWarmupTimeout();
    warmupTimeout = window.setTimeout(() => {
        warmupTimeout = null;
        setWarmedUp(false);
    }, Math.max(WARMUP_COOLDOWN, closeDelay));
};

/** Replaces React Aria's `ButtonContext` propagation: `TooltipTrigger` inherits `isDisabled` from `Tooltip`. */
const TooltipDefaultsContext = createContext<{ isDisabled: boolean }>({ isDisabled: false });

export interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "title" | "color"> {
    /**
     * The title of the tooltip.
     */
    title: ReactNode;
    /**
     * The description of the tooltip.
     */
    description?: ReactNode;
    /**
     * The trigger element the tooltip is attached to. It is rendered as-is and registered as the tooltip's
     * trigger (React Aria attached the trigger behaviour to the child element in the same way).
     */
    children?: ReactNode;
    /**
     * Whether to show the arrow on the tooltip.
     *
     * @default false
     */
    arrow?: boolean;
    /**
     * Delay in milliseconds before the tooltip is shown.
     *
     * @default 300
     */
    delay?: number;
    /**
     * Delay in milliseconds before the tooltip is hidden.
     *
     * @default 0
     */
    closeDelay?: number;
    /**
     * The interaction that opens the tooltip. Base UI always opens on both hover and focus.
     *
     * @default 'hover'
     */
    trigger?: "hover" | "focus";
    /**
     * Whether the tooltip is disabled.
     */
    isDisabled?: boolean;
    /**
     * Whether the tooltip is currently open (controlled).
     */
    isOpen?: boolean;
    /**
     * Whether the tooltip is open by default (uncontrolled).
     */
    defaultOpen?: boolean;
    /**
     * Handler that is called when the tooltip's open state changes.
     */
    onOpenChange?: (isOpen: boolean) => void;
    /**
     * The placement of the tooltip with respect to the trigger.
     *
     * @default 'top'
     */
    placement?: TooltipPlacement;
    /**
     * The distance between the trigger and the tooltip.
     *
     * @default 6
     */
    offset?: number;
    /**
     * The offset of the tooltip relative to the trigger along the cross axis.
     */
    crossOffset?: number;
    /**
     * Whether the tooltip should flip when there is not enough space next to the trigger.
     */
    shouldFlip?: boolean;
    /**
     * The padding between the tooltip and the edges of the container.
     */
    containerPadding?: number;
    /**
     * The minimum distance the arrow's edge should be from the edge of the tooltip.
     */
    arrowBoundaryOffset?: number;
    /**
     * The ref for the element which the tooltip positions itself with respect to.
     *
     * When used within a `Tooltip` this is set automatically. It is only required when used standalone.
     */
    triggerRef?: RefObject<Element | null>;
    /**
     * Whether the tooltip is currently performing an entry animation. Kept for API compatibility — Base UI
     * decides this from CSS animation/transition state.
     */
    isEntering?: boolean;
    /**
     * Whether the tooltip is currently performing an exit animation. Kept for API compatibility — Base UI
     * decides this from CSS animation/transition state.
     */
    isExiting?: boolean;
    /**
     * The container element in which the overlay portal will be placed.
     *
     * @default document.body
     */
    UNSTABLE_portalContainer?: HTMLElement | null;
    /**
     * Any additional `data-` attributes are forwarded to the tooltip element.
     */
    [dataAttribute: `data-${string}`]: unknown;
}

export const Tooltip = ({
    title,
    description,
    children,
    arrow = false,
    delay = 300,
    closeDelay = 0,
    isDisabled,
    isOpen,
    defaultOpen,
    // Accepted for API compatibility: Base UI opens tooltips on hover and focus and derives the
    // entering/exiting phases from CSS animation state, so these have no pass-through equivalent.
    trigger: _trigger,
    isEntering: _isEntering,
    isExiting: _isExiting,
    offset = 6,
    crossOffset,
    placement = "top",
    shouldFlip,
    containerPadding,
    arrowBoundaryOffset,
    triggerRef,
    UNSTABLE_portalContainer,
    onOpenChange,
    ...tooltipProps
}: TooltipProps) => {
    const isTopOrBottomLeft = ["top left", "top end", "bottom left", "bottom end"].includes(placement);
    const isTopOrBottomRight = ["top right", "top start", "bottom right", "bottom start"].includes(placement);
    // Set negative cross offset for left and right placement to visually balance the tooltip.
    const calculatedCrossOffset = isTopOrBottomLeft ? -12 : isTopOrBottomRight ? 12 : 0;

    const { side, align } = getSideAndAlign(placement);
    const tooltipId = useId();

    // Once any tooltip has been shown, the next one opens instantly (React Aria's warmup behaviour).
    const isWarmedUp = useSyncExternalStore(subscribeToWarmup, () => warmedUp, () => false);

    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
    const open = isOpen ?? uncontrolledOpen;

    const actionsRef = useRef<{ unmount: () => void; close: () => void } | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        // Only one tooltip is visible at a time, as in React Aria.
        openTooltips.set(tooltipId, () => actionsRef.current?.close());

        return () => {
            openTooltips.delete(tooltipId);
        };
    }, [open, tooltipId]);

    const handleOpenChange = (nextOpen: boolean) => {
        setUncontrolledOpen(nextOpen);

        if (nextOpen) {
            showTooltip(tooltipId);
        } else {
            hideTooltip(closeDelay);
        }

        onOpenChange?.(nextOpen);
    };

    const triggerElement = useMemo(() => {
        const items = Children.toArray(children);

        return items.length === 1 && isValidElement(items[0]) ? items[0] : null;
    }, [children]);

    return (
        <TooltipDefaultsContext.Provider value={{ isDisabled: isDisabled ?? false }}>
            <BaseTooltip.Root
                open={isOpen}
                defaultOpen={defaultOpen}
                onOpenChange={handleOpenChange}
                disabled={isDisabled}
                actionsRef={actionsRef}
            >
                {triggerElement ? (
                    <BaseTooltip.Trigger
                        delay={isWarmedUp ? 0 : delay}
                        closeDelay={closeDelay}
                        render={(triggerProps, triggerState) =>
                            cloneElement(
                                triggerElement,
                                mergeProps(triggerProps, {
                                    // Tooltips describe their trigger while they are visible, as in React Aria.
                                    "aria-describedby": open || triggerState.open ? tooltipId : undefined,
                                    // React Aria disabled the trigger element itself; `TooltipTrigger` applies the
                                    // native `disabled` attribute for this case, other elements get `aria-disabled`.
                                    ...(isDisabled && triggerElement.type !== TooltipTrigger ? { "aria-disabled": "true" } : {}),
                                }),
                            )
                        }
                    />
                ) : (
                    children
                )}

                <BaseTooltip.Portal container={UNSTABLE_portalContainer}>
                    <BaseTooltip.Positioner
                        side={side}
                        align={align}
                        sideOffset={offset}
                        alignOffset={crossOffset ?? calculatedCrossOffset}
                        anchor={triggerRef}
                        collisionPadding={containerPadding}
                        arrowPadding={arrowBoundaryOffset ?? 0}
                        collisionAvoidance={shouldFlip === false ? NO_FLIP : undefined}
                    >
                        <BaseTooltip.Popup
                            {...tooltipProps}
                            role="tooltip"
                            id={tooltipId}
                            className="data-open:ease-out data-open:animate-in data-ending-style:ease-in data-ending-style:animate-out"
                        >
                            <div
                                className={cx(
                                    "z-50 flex max-w-xs origin-(--transform-origin) flex-col items-start gap-1 rounded-lg bg-primary-solid px-3 shadow-lg will-change-transform",
                                    description ? "py-3" : "py-2",
                                    "in-data-open:ease-out in-data-open:animate-in in-data-open:fade-in in-data-open:zoom-in-95 in-data-[side=left]:slide-in-from-right-0.5 in-data-[side=right]:slide-in-from-left-0.5 in-data-[side=top]:slide-in-from-bottom-0.5 in-data-[side=bottom]:slide-in-from-top-0.5",
                                    "in-data-ending-style:ease-in in-data-ending-style:animate-out in-data-ending-style:fade-out in-data-ending-style:zoom-out-95 in-data-[side=left]:slide-out-to-right-0.5 in-data-[side=right]:slide-out-to-left-0.5 in-data-[side=top]:slide-out-to-bottom-0.5 in-data-[side=bottom]:slide-out-to-top-0.5",
                                )}
                            >
                                <span className="text-xs font-semibold text-white">{title}</span>

                                {description && <span className="text-xs font-medium text-tooltip-supporting-text">{description}</span>}

                                {arrow && (
                                    /* React Aria positioned the arrow against the overlay's edge itself; Base UI only
                                     * places it along the cross axis, so the side-facing edge is set here. */
                                    <BaseTooltip.Arrow className="data-[side=top]:top-full data-[side=bottom]:bottom-full data-[side=left]:left-full data-[side=right]:right-full">
                                        <svg
                                            viewBox="0 0 100 100"
                                            className="size-2.5 fill-bg-primary-solid in-data-[side=left]:-rotate-90 in-data-[side=right]:rotate-90 in-data-[side=top]:rotate-0 in-data-[side=bottom]:rotate-180"
                                        >
                                            <path d="M0,0 L35.858,35.858 Q50,50 64.142,35.858 L100,0 Z" />
                                        </svg>
                                    </BaseTooltip.Arrow>
                                )}
                            </div>
                        </BaseTooltip.Popup>
                    </BaseTooltip.Positioner>
                </BaseTooltip.Portal>
            </BaseTooltip.Root>
        </TooltipDefaultsContext.Provider>
    );
};

export interface TooltipTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
    /** Whether the tooltip trigger is disabled. Inherited from the parent `Tooltip` when not set. */
    isDisabled?: boolean;
    /** Whether the tooltip trigger is pending. */
    isPending?: boolean;
    ref?: Ref<HTMLButtonElement>;
}

export const TooltipTrigger = ({ children, className, isDisabled, isPending, type = "button", ref, ...buttonProps }: TooltipTriggerProps) => {
    const defaults = useContext(TooltipDefaultsContext);

    return (
        <button
            {...buttonProps}
            ref={ref}
            type={type}
            disabled={isDisabled ?? defaults.isDisabled}
            data-pending={isPending ? "" : undefined}
            className={cx("h-max w-max outline-hidden", className)}
        >
            {children}
        </button>
    );
};
