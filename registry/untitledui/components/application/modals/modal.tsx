/* Adopted from untitleduico/react@8b7409c078f8 — components/application/modals/modal.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `DialogTrigger`/`ModalOverlay`/`Modal`/`Dialog`
 * are replaced by `@base-ui/react@1.8.0` (`Dialog` = Root > Trigger > Portal > Backdrop, with the payload's own
 * dialog element inside the popup). Every export, prop name and default is unchanged; the composition and each
 * semantic difference are recorded in .design-compiler/base-ui-migration/units/overlay-family.json. */
"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useRender } from "@base-ui/react/use-render";
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode, Ref } from "react";
import { Children, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { cx } from "@/utils/cx";

/** The open-state API React Aria exposed to render props and to `Dialog`'s children function. */
export interface OverlayTriggerState {
    /** Whether the overlay is currently open. */
    readonly isOpen: boolean;
    /** Sets whether the overlay is open. */
    setOpen(isOpen: boolean): void;
    /** Opens the overlay. */
    open(): void;
    /** Closes the overlay. */
    close(): void;
    /** Toggles the overlay's visibility. */
    toggle(): void;
}

/** State handed to the overlay's `className`, `style` and children render props (React Aria's `ModalRenderProps`). */
export interface ModalRenderProps {
    /**
     * Whether the modal is performing its entry phase. Base UI's `data-starting-style` lasts a single frame, so the
     * entry phase is the popup's open state (`data-open`), which is what Base UI's own animation classes key off; an
     * exit is `data-ending-style`.
     */
    isEntering: boolean;
    /** Whether the modal is currently performing an exit animation. */
    isExiting: boolean;
    /** State of the modal. */
    state: OverlayTriggerState;
}

/** State handed to `Dialog`'s children function. */
export interface DialogRenderProps {
    /** Closes the dialog. */
    close: () => void;
}

export interface DialogTriggerProps {
    /** The trigger element and the overlay it opens, as siblings (React Aria's `DialogTrigger`). */
    children: ReactNode;
    /** Whether the overlay is open by default (controlled). */
    isOpen?: boolean;
    /** Whether the overlay is open by default (uncontrolled). */
    defaultOpen?: boolean;
    /** Handler that is called when the overlay's open state changes. */
    onOpenChange?: (isOpen: boolean) => void;
}

export interface ModalOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "slot" | "style"> {
    /** Whether to close the modal when the user interacts outside it. */
    isDismissable?: boolean;
    /** Whether pressing the escape key to close the modal should be disabled. */
    isKeyboardDismissDisabled?: boolean;
    /** When the user interacts outside the overlay, whether it should close. */
    shouldCloseOnInteractOutside?: (element: Element) => boolean;
    /** Whether the overlay is open by default (controlled). */
    isOpen?: boolean;
    /** Whether the overlay is open by default (uncontrolled). */
    defaultOpen?: boolean;
    /** Handler that is called when the overlay's open state changes. */
    onOpenChange?: (isOpen: boolean) => void;
    /** The CSS `className` for the element. A function may be provided to compute the class based on component state. */
    className?: string | ((state: ModalRenderProps) => string);
    /** The inline style for the element. A function may be provided to compute the style based on component state. */
    style?: CSSProperties | ((state: ModalRenderProps) => CSSProperties);
    /** Children of the overlay. A function may be provided to access the overlay's state. */
    children?: ReactNode | ((state: ModalRenderProps) => ReactNode);
    /**
     * Whether the modal is performing an entry animation. Kept for API compatibility — Base UI derives the phase
     * from the element's own state attributes, so it is not an input.
     */
    isEntering?: boolean;
    /**
     * Whether the modal is performing an exit animation. Kept for API compatibility — Base UI derives the phase
     * from the element's own state attributes, so it is not an input.
     */
    isExiting?: boolean;
    /** The container element in which the overlay portal will be placed. */
    UNSTABLE_portalContainer?: HTMLElement | null;
    /** The React Aria slot the rendered element fills. */
    slot?: string | null;
    ref?: Ref<HTMLDivElement>;
}

/** The modal box takes the same props as the overlay it is nested in, as in React Aria. */
export type ModalProps = ModalOverlayProps;

export interface DialogProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "role"> {
    /** The accessibility role for the dialog. */
    role?: "dialog" | "alertdialog";
    /** The CSS `className` for the element. */
    className?: string;
    /** Children of the dialog. A function may be provided to access a function to close the dialog. */
    children?: ReactNode | ((opts: DialogRenderProps) => ReactNode);
    /**
     * Allows you to replace the component's HTML element with a different tag, or compose it with another
     * component — the same contract as the React Aria `render` prop.
     */
    render?: useRender.RenderProp;
    ref?: Ref<HTMLElement>;
}

/** The imperative open/close pair React Aria exposed as the overlay state's methods. */
type DialogControls = { open: () => void; close: () => void };

/**
 * React Aria passed a trigger's state down to its overlay through context. Base UI instead links a trigger to its
 * root with a `handle`, so the trigger created here stays usable from a detached overlay (`DialogTrigger`'s children
 * are siblings, and detached triggers are the composition Base UI supports for exactly that shape).
 */
type DialogTriggerContextValue = {
    handle: BaseDialog.Handle<unknown>;
    isOpen?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
};

const DialogTriggerContext = createContext<DialogTriggerContextValue | null>(null);
const DialogControlsContext = createContext<DialogControls | null>(null);

/** A `Dialog` rendered outside any overlay has nothing to close, exactly as React Aria's context-less dialog. */
const NO_CONTROLS: DialogControls = { open: () => {}, close: () => {} };

type OverlayPartState = { open: boolean; transitionStatus?: "starting" | "ending" | "idle" | undefined };
type RenderElementProps = HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> };

/** Maps Base UI's popup state onto the render props React Aria handed to `className`/`style`/children functions. */
const toModalRenderProps = (state: OverlayPartState, controls: DialogControls): ModalRenderProps => ({
    isEntering: state.open && state.transitionStatus !== "ending",
    isExiting: state.transitionStatus === "ending",
    state: {
        isOpen: state.open,
        setOpen: (isOpen: boolean) => (isOpen ? controls.open() : controls.close()),
        open: controls.open,
        close: controls.close,
        toggle: () => (state.open ? controls.close() : controls.open()),
    },
});

const OVERLAY_CLASSES = cx(
    "fixed inset-0 z-50 flex min-h-dvh w-full items-end justify-center bg-overlay/70 px-4 outline-hidden backdrop-blur-[6px] sm:items-center sm:justify-center sm:px-8",
    // Vertical padding
    "pt-(--modal-pt) pb-(--modal-pb) [--modal-pb:clamp(16px,8vh,64px)] [--modal-pt:16px] sm:[--modal-pb:32px] sm:[--modal-pt:32px]",
    // Animations: Base UI animates in while the popup is open and out while it carries `data-ending-style`.
    "data-open:duration-300 data-open:ease-out data-open:animate-in data-open:fade-in",
    "data-ending-style:duration-200 data-ending-style:ease-in data-ending-style:animate-out data-ending-style:fade-out",
);

const MODAL_CLASSES = cx(
    "w-full rounded-xl bg-primary align-middle shadow-xl outline-hidden max-sm:overflow-y-auto sm:rounded-2xl",
    // Max height based on parent's vertical padding
    "max-h-[calc(var(--visual-viewport-height)-var(--modal-pt)-var(--modal-pb))]",
    // Animations
    "data-open:duration-300 data-open:ease-out data-open:animate-in data-open:zoom-in-95",
    "data-ending-style:duration-200 data-ending-style:ease-in data-ending-style:animate-out data-ending-style:zoom-out-95",
);

const DIALOG_CLASSES = "relative max-h-[inherit] w-full overflow-y-auto outline-hidden";

/**
 * An overlay trigger: the first child is the element that opens the overlay, the remaining children are the overlay
 * itself, matching React Aria's `DialogTrigger` composition.
 */
export const DialogTrigger = ({ children, isOpen, defaultOpen, onOpenChange }: DialogTriggerProps) => {
    // The handle is created once per trigger and shared with the overlay through context.
    const handle = useMemo(() => BaseDialog.createHandle(), []);
    const [trigger, ...overlays] = Children.toArray(children);

    const value = useMemo<DialogTriggerContextValue>(
        () => ({ handle, isOpen, defaultOpen, onOpenChange }),
        [handle, isOpen, defaultOpen, onOpenChange],
    );

    return (
        <DialogTriggerContext.Provider value={value}>
            {isValidElement(trigger) ? (
                <BaseDialog.Trigger
                    handle={handle}
                    // A trigger rendered as a link is not a native <button>, so Base UI must not apply button semantics.
                    nativeButton={typeof (trigger.props as { href?: unknown } | null)?.href !== "string"}
                    render={trigger}
                />
            ) : null}
            {overlays}
        </DialogTriggerContext.Provider>
    );
};

export const ModalOverlay = ({
    children,
    className,
    style,
    isDismissable = false,
    isKeyboardDismissDisabled = false,
    shouldCloseOnInteractOutside,
    isOpen,
    defaultOpen,
    onOpenChange,
    UNSTABLE_portalContainer,
    isEntering: _isEntering,
    isExiting: _isExiting,
    slot,
    ref,
    ...elementProps
}: ModalOverlayProps) => {
    const trigger = useContext(DialogTriggerContext);
    const ownHandle = useMemo(() => BaseDialog.createHandle(), []);
    // A standalone overlay owns its handle; under a `DialogTrigger` both parts drive the trigger's handle.
    const handle = trigger?.handle ?? ownHandle;
    const controls = useMemo<DialogControls>(() => ({ open: () => handle.open(null), close: () => handle.close() }), [handle]);

    const onOpenChangeLocal = onOpenChange ?? trigger?.onOpenChange;

    const handleOpenChange = (nextOpen: boolean, eventDetails: BaseDialog.Root.ChangeEventDetails) => {
        // React Aria's `isKeyboardDismissDisabled`: Base UI hands the decision back through the change event.
        if (isKeyboardDismissDisabled && eventDetails.reason === "escape-key") {
            eventDetails.cancel();
            return;
        }
        // React Aria's `shouldCloseOnInteractOutside`, vetoed the same way.
        if (shouldCloseOnInteractOutside && (eventDetails.reason === "outside-press" || eventDetails.reason === "focus-out")) {
            const target = eventDetails.event.target;
            if (target instanceof Element && !shouldCloseOnInteractOutside(target)) {
                eventDetails.cancel();
                return;
            }
        }
        onOpenChangeLocal?.(nextOpen);
    };

    return (
        <DialogControlsContext.Provider value={controls}>
            <BaseDialog.Root
                handle={handle}
                open={isOpen ?? trigger?.isOpen}
                defaultOpen={defaultOpen ?? trigger?.defaultOpen}
                onOpenChange={handleOpenChange}
                // React Aria's `isDismissable` (false by default) is Base UI's `disablePointerDismissal`.
                disablePointerDismissal={!isDismissable}
            >
                <BaseDialog.Portal container={UNSTABLE_portalContainer}>
                    <BaseDialog.Backdrop
                        {...elementProps}
                        ref={ref}
                        slot={slot ?? undefined}
                        className={(state) =>
                            cx(OVERLAY_CLASSES, typeof className === "function" ? className(toModalRenderProps(state, controls)) : className)
                        }
                        style={(state) => (typeof style === "function" ? style(toModalRenderProps(state, controls)) : style)}
                        render={(backdropProps: RenderElementProps, state: BaseDialog.Backdrop.State): ReactElement => (
                            <div {...backdropProps}>
                                {typeof children === "function" ? children(toModalRenderProps(state, controls)) : children}
                            </div>
                        )}
                    />
                </BaseDialog.Portal>
            </BaseDialog.Root>
        </DialogControlsContext.Provider>
    );
};

export const Modal = ({
    children,
    className,
    style,
    isDismissable,
    isKeyboardDismissDisabled,
    shouldCloseOnInteractOutside,
    isOpen,
    defaultOpen,
    onOpenChange,
    isEntering,
    isExiting,
    UNSTABLE_portalContainer,
    ...elementProps
}: ModalProps) => {
    const overlay = useContext(DialogControlsContext);
    const content = (
        <ModalContent {...elementProps} className={className} style={style}>
            {children}
        </ModalContent>
    );

    // Used on its own (without a `ModalOverlay` around it), React Aria's `Modal` brought its own overlay, and the
    // overlay-only props belong to it in that case.
    if (overlay) {
        return content;
    }

    return (
        <ModalOverlay
            isDismissable={isDismissable}
            isKeyboardDismissDisabled={isKeyboardDismissDisabled}
            shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
            isOpen={isOpen}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
            isEntering={isEntering}
            isExiting={isExiting}
            UNSTABLE_portalContainer={UNSTABLE_portalContainer}
        >
            {content}
        </ModalOverlay>
    );
};

const ModalContent = ({ children, className, style, slot, ref, ...elementProps }: ModalProps) => {
    const controls = useContext(DialogControlsContext) ?? NO_CONTROLS;
    const visualViewportHeight = useVisualViewportHeight();

    return (
        <BaseDialog.Popup
            {...elementProps}
            ref={ref}
            slot={slot ?? undefined}
            // Base UI's popup is itself `role="dialog"`; the adopted payload renders its own dialog element inside it
            // (React Aria's `Dialog`), so the container keeps no role and the inner element stays the dialog.
            role={undefined}
            className={(state) => cx(MODAL_CLASSES, typeof className === "function" ? className(toModalRenderProps(state, controls)) : className)}
            style={(state) => ({
                "--visual-viewport-height": `${visualViewportHeight}px`,
                ...(typeof style === "function" ? style(toModalRenderProps(state, controls)) : style),
            })}
            render={(popupProps: RenderElementProps, state: BaseDialog.Popup.State): ReactElement => (
                <div {...popupProps}>{typeof children === "function" ? children(toModalRenderProps(state, controls)) : children}</div>
            )}
        />
    );
};

/**
 * Keeps React Aria's `--visual-viewport-height` on the modal element: it sized the modal's `max-height` against the
 * visual viewport (so a mobile keyboard shrinks the dialog rather than pushing it off-screen). Base UI has no
 * equivalent variable, so the same measurement is restored here. `0` matches React Aria's server-rendered value.
 */
const useVisualViewportHeight = () => {
    const [height, setHeight] = useState(0);

    // A layout effect, so the first painted frame already carries the measurement React Aria read during render.
    const useIsomorphicLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

    useIsomorphicLayoutEffect(() => {
        const viewport = window.visualViewport;
        const read = () => setHeight(viewport ? viewport.height * viewport.scale : document.documentElement.clientHeight);
        const onResize = () => {
            // Ignore updates while the page is pinch-zoomed, as React Aria did.
            if (viewport && viewport.scale > 1) {
                return;
            }
            read();
        };

        read();
        if (viewport) {
            viewport.addEventListener("resize", onResize);
        } else {
            window.addEventListener("resize", onResize);
        }

        return () => {
            if (viewport) {
                viewport.removeEventListener("resize", onResize);
            } else {
                window.removeEventListener("resize", onResize);
            }
        };
    }, []);

    return height;
};

export const Dialog = ({ className, children, role = "dialog", render, ref, ...elementProps }: DialogProps) => {
    const controls = useContext(DialogControlsContext) ?? NO_CONTROLS;

    return useRender({
        defaultTagName: "section",
        render,
        ref,
        props: {
            ...elementProps,
            role,
            className: cx(DIALOG_CLASSES, className),
            children: typeof children === "function" ? children({ close: controls.close }) : children,
        },
    });
};
