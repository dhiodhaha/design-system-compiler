/* Adopted from untitleduico/react@8b7409c078f8 — components/base/toggle/toggle.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import { Switch as BaseSwitch, type SwitchRootState } from "@base-ui/react/switch";
import { type ComponentPropsWithoutRef, type ComponentPropsWithRef, type CSSProperties, type PointerEvent, type ReactElement, type ReactNode, type Ref, useState } from "react";
import { cx } from "@/utils/cx";

interface ToggleBaseProps {
    size?: "sm" | "md";
    slim?: boolean;
    className?: string;
    isHovered?: boolean;
    isFocusVisible?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
}

export const ToggleBase = ({ className, isHovered, isDisabled, isFocusVisible, isSelected, slim, size = "sm" }: ToggleBaseProps) => {
    const styles = {
        default: {
            sm: {
                root: "h-5 w-9 p-0.5",
                switch: cx("size-4", isSelected && "translate-x-4"),
            },
            md: {
                root: "h-6 w-11 p-0.5",
                switch: cx("size-5", isSelected && "translate-x-5"),
            },
        },
        slim: {
            sm: {
                root: "h-4 w-8",
                switch: cx("size-4", isSelected && "translate-x-4"),
            },
            md: {
                root: "h-5 w-10",
                switch: cx("size-5", isSelected && "translate-x-5"),
            },
        },
    };

    const classes = slim ? styles.slim[size] : styles.default[size];

    return (
        <div
            className={cx(
                "cursor-pointer rounded-full bg-tertiary ring-[0.5px] ring-secondary outline-focus-ring transition duration-150 ease-linear ring-inset",
                isSelected && "bg-brand-solid",
                isSelected && isHovered && "bg-brand-solid_hover",
                isDisabled && "cursor-not-allowed opacity-50",
                isFocusVisible && "outline-2 outline-offset-2",

                slim && "ring-1",
                slim && isSelected && "ring-transparent",
                classes.root,
                className,
            )}
        >
            <div
                style={{
                    transition: "transform 0.15s ease-in-out, translate 0.15s ease-in-out, border-color 0.1s linear, background-color 0.1s linear",
                }}
                className={cx(
                    "rounded-full bg-fg-white shadow-sm",

                    slim && "shadow-xs",
                    slim && "border border-toggle-border",
                    slim && isSelected && "border-toggle-slim-border_pressed",
                    slim && isSelected && isHovered && "border-toggle-slim-border_pressed-hover",

                    classes.switch,
                )}
            />
        </div>
    );
};

const styles = {
    sm: {
        root: "gap-2",
        textWrapper: "",
        label: "text-sm font-medium",
        hint: "text-sm",
    },
    md: {
        root: "gap-3",
        textWrapper: "gap-0.5",
        label: "text-md font-medium",
        hint: "text-md",
    },
};

/**
 * The render-prop state React Aria handed to `className`, `style` and `children`.
 *
 * Selection comes from Base UI's own state; hover, focus and focus-visible are tracked here because Base UI
 * does not model them (it exposes them as CSS state only). `isPressed` and `state` are not reproduced.
 */
interface ToggleState {
    isSelected: boolean;
    isHovered: boolean;
    isFocused: boolean;
    isFocusVisible: boolean;
    isDisabled: boolean;
    isReadOnly: boolean;
}

/** React Aria's hover event payload, rebuilt from the native pointer event for `onHoverStart`/`onHoverEnd`. */
interface ToggleHoverEvent {
    type: "hoverstart" | "hoverend" | "hoverchange";
    pointerType: "mouse" | "pen" | "touch" | "";
    target: Element;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
}

/**
 * Base UI types the root as a `<span>` and owns selection state, so those bindings are replaced by the React
 * Aria names the payload exposes below; everything else (`id`, `name`, `value`, `form`, `aria-*`, DOM events)
 * passes straight through to the root element.
 */
type BaseSwitchRootProps = Omit<
    ComponentPropsWithoutRef<typeof BaseSwitch.Root>,
    "ref" | "checked" | "defaultChecked" | "onCheckedChange" | "disabled" | "readOnly" | "required" | "nativeButton" | "className" | "style" | "render"
>;

type ToggleProps = BaseSwitchRootProps & {
    ref?: Ref<HTMLLabelElement>;
    size?: "sm" | "md";
    label?: string;
    hint?: ReactNode;
    slim?: boolean;
    className?: string | ((state: ToggleState) => string | undefined);
    style?: CSSProperties | ((state: ToggleState) => CSSProperties | undefined);
    isSelected?: boolean;
    defaultSelected?: boolean;
    onChange?: (isSelected: boolean) => void;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    excludeFromTabOrder?: boolean;
    /** React Aria's DOM render escape hatch: replaces the root element, receiving the root props and the state. */
    render?: (props: ComponentPropsWithRef<"label">, state: ToggleState) => ReactElement;
    onHoverStart?: (event: ToggleHoverEvent) => void;
    onHoverEnd?: (event: ToggleHoverEvent) => void;
    onHoverChange?: (isHovering: boolean) => void;
};

export const Toggle = ({
    label,
    hint,
    className,
    style,
    render,
    ref,
    size = "sm",
    slim,
    isSelected,
    defaultSelected,
    onChange,
    isDisabled,
    isReadOnly,
    excludeFromTabOrder,
    onFocus,
    onBlur,
    onPointerEnter,
    onPointerLeave,
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    ...ariaSwitchProps
}: ToggleProps) => {
    // Base UI models selection only, so the interaction flags React Aria exposed are tracked here.
    const [interaction, setInteraction] = useState({ isHovered: false, isFocused: false, isFocusVisible: false });

    const toState = (state: SwitchRootState): ToggleState => ({
        isSelected: state.checked,
        isHovered: interaction.isHovered,
        isFocused: interaction.isFocused,
        isFocusVisible: interaction.isFocusVisible,
        isDisabled: state.disabled,
        isReadOnly: state.readOnly,
    });

    const hoverEvent = (type: ToggleHoverEvent["type"], event: PointerEvent<Element>): ToggleHoverEvent => ({
        type,
        pointerType: event.pointerType,
        target: event.currentTarget,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
    });

    return (
        <BaseSwitch.Root
            ref={ref}
            checked={isSelected}
            defaultChecked={defaultSelected}
            onCheckedChange={onChange}
            disabled={isDisabled}
            readOnly={isReadOnly}
            // Spread rather than pass `tabIndex={undefined}`: an explicit undefined would clobber the tab index
            // Base UI puts on its root element.
            {...(excludeFromTabOrder ? { tabIndex: -1 } : {})}
            onFocus={(event) => {
                onFocus?.(event);
                // Read the event synchronously: React nulls `currentTarget` before the state updater runs.
                const isFocusVisible = event.currentTarget.matches(":focus-visible");
                setInteraction((current) => ({ ...current, isFocused: true, isFocusVisible }));
            }}
            onBlur={(event) => {
                onBlur?.(event);
                setInteraction((current) => ({ ...current, isFocused: false, isFocusVisible: false }));
            }}
            onPointerEnter={(event) => {
                onPointerEnter?.(event);
                if (event.pointerType === "touch") return;
                onHoverStart?.(hoverEvent("hoverstart", event));
                onHoverChange?.(true);
                setInteraction((current) => ({ ...current, isHovered: true }));
            }}
            onPointerLeave={(event) => {
                onPointerLeave?.(event);
                if (event.pointerType === "touch") return;
                onHoverEnd?.(hoverEvent("hoverend", event));
                onHoverChange?.(false);
                setInteraction((current) => ({ ...current, isHovered: false }));
            }}
            className={(state) =>
                cx(
                    "relative flex w-max items-start",
                    state.disabled && "cursor-not-allowed",
                    styles[size].root,
                    typeof className === "function" ? className(toState(state)) : className,
                )
            }
            style={typeof style === "function" ? (state) => style(toState(state)) : style}
            render={(props, state) => {
                const children = (
                    <>
                        <ToggleBase
                            slim={slim}
                            size={size}
                            isHovered={interaction.isHovered}
                            isDisabled={state.disabled}
                            isFocusVisible={interaction.isFocusVisible}
                            isSelected={state.checked}
                            className={slim ? "mt-0.5" : ""}
                        />

                        {(label || hint) && (
                            <div className={cx("flex flex-col", styles[size].textWrapper)}>
                                {label && <p className={cx("text-secondary select-none", styles[size].label)}>{label}</p>}
                                {hint && (
                                    <span className={cx("text-tertiary", styles[size].hint)} onClick={(event) => event.stopPropagation()}>
                                        {hint}
                                    </span>
                                )}
                            </div>
                        )}
                    </>
                );

                // React Aria's `render` escape hatch, given the root props (children included) and the state.
                return render ? render({ ...props, children }, toState(state)) : <label {...props}>{children}</label>;
            }}
            {...ariaSwitchProps}
        />
    );
};
