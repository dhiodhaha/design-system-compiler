/* Adopted from untitleduico/react@8b7409c078f8 — components/base/checkbox/checkbox.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import { Checkbox as BaseCheckbox, type CheckboxRootState } from "@base-ui/react/checkbox";
import { type ComponentPropsWithoutRef, type ComponentPropsWithRef, type CSSProperties, type PointerEvent, type ReactElement, type ReactNode, type Ref, useState } from "react";
import { cx } from "@/utils/cx";

export interface CheckboxBaseProps {
    size?: "sm" | "md";
    className?: string;
    isFocusVisible?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
    isIndeterminate?: boolean;
}

export const CheckboxBase = ({ className, isSelected, isDisabled, isIndeterminate, size = "sm", isFocusVisible = false }: CheckboxBaseProps) => {
    return (
        <div
            className={cx(
                "relative flex size-4 shrink-0 cursor-pointer appearance-none items-center justify-center rounded bg-primary ring-1 ring-primary ring-inset",
                size === "md" && "size-5 rounded-md",
                (isSelected || isIndeterminate) && "bg-brand-solid ring-brand-solid",
                isDisabled && "cursor-not-allowed opacity-50",
                isDisabled && !(isSelected || isIndeterminate) && "bg-tertiary",
                isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                className,
            )}
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 14 14"
                fill="none"
                className={cx(
                    "pointer-events-none absolute h-3 w-2.5 text-fg-white opacity-0 transition-inherit-all",
                    size === "md" && "size-3.5",
                    isIndeterminate && "opacity-100",
                )}
            >
                <path d="M2.91675 7H11.0834" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <svg
                aria-hidden="true"
                viewBox="0 0 14 14"
                fill="none"
                className={cx(
                    "pointer-events-none absolute size-3 text-fg-white opacity-0 transition-inherit-all",
                    size === "md" && "size-3.5",
                    isSelected && !isIndeterminate && "opacity-100",
                )}
            >
                <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
};
CheckboxBase.displayName = "CheckboxBase";

/**
 * The render-prop state React Aria handed to `className`, `style` and `children`.
 *
 * Selection and validation come from Base UI's own state; hover, focus and focus-visible are tracked here
 * because Base UI does not model them (it exposes them as CSS state only). Bindings React Aria supplied that
 * Base UI has no counterpart for (`isPressed`, `state`) are not reproduced.
 */
interface CheckboxState {
    isSelected: boolean;
    isIndeterminate: boolean;
    isHovered: boolean;
    isFocused: boolean;
    isFocusVisible: boolean;
    isDisabled: boolean;
    isReadOnly: boolean;
    isInvalid: boolean;
    isRequired: boolean;
}

/** React Aria's hover event payload, rebuilt from the native pointer event for `onHoverStart`/`onHoverEnd`. */
interface CheckboxHoverEvent {
    type: "hoverstart" | "hoverend" | "hoverchange";
    pointerType: "mouse" | "pen" | "touch" | "";
    target: Element;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
}

/**
 * Base UI types the root as a `<span>` and owns selection/validation state, so those bindings are replaced by
 * the React Aria names the payload exposes below; everything else (`id`, `name`, `value`, `form`, `aria-*`,
 * DOM events) passes straight through to the root element.
 */
type BaseCheckboxRootProps = Omit<
    ComponentPropsWithoutRef<typeof BaseCheckbox.Root>,
    | "ref"
    | "checked"
    | "defaultChecked"
    | "onCheckedChange"
    | "indeterminate"
    | "disabled"
    | "readOnly"
    | "required"
    | "nativeButton"
    | "parent"
    | "uncheckedValue"
    | "className"
    | "style"
    | "render"
>;

type CheckboxProps = BaseCheckboxRootProps & {
    ref?: Ref<HTMLLabelElement>;
    size?: "sm" | "md";
    label?: ReactNode;
    hint?: ReactNode;
    className?: string | ((state: CheckboxState) => string | undefined);
    style?: CSSProperties | ((state: CheckboxState) => CSSProperties | undefined);
    isSelected?: boolean;
    defaultSelected?: boolean;
    onChange?: (isSelected: boolean) => void;
    isIndeterminate?: boolean;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    isRequired?: boolean;
    isInvalid?: boolean;
    excludeFromTabOrder?: boolean;
    /** React Aria's DOM render escape hatch: replaces the root element, receiving the root props and the state. */
    render?: (props: ComponentPropsWithRef<"label">, state: CheckboxState) => ReactElement;
    onHoverStart?: (event: CheckboxHoverEvent) => void;
    onHoverEnd?: (event: CheckboxHoverEvent) => void;
    onHoverChange?: (isHovering: boolean) => void;
};

export const Checkbox = ({
    label,
    hint,
    size = "sm",
    className,
    style,
    render,
    ref,
    isSelected,
    defaultSelected,
    onChange,
    isIndeterminate,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    excludeFromTabOrder,
    onFocus,
    onBlur,
    onPointerEnter,
    onPointerLeave,
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    ...ariaCheckboxProps
}: CheckboxProps) => {
    const sizes = {
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

    // Base UI models selection/validation only, so the interaction flags React Aria exposed are tracked here.
    const [interaction, setInteraction] = useState({ isHovered: false, isFocused: false, isFocusVisible: false });

    const toState = (state: CheckboxRootState): CheckboxState => ({
        isSelected: state.checked,
        isIndeterminate: state.indeterminate,
        isHovered: interaction.isHovered,
        isFocused: interaction.isFocused,
        isFocusVisible: interaction.isFocusVisible,
        isDisabled: state.disabled,
        isReadOnly: state.readOnly,
        isInvalid: isInvalid ?? false,
        isRequired: state.required,
    });

    const hoverEvent = (type: CheckboxHoverEvent["type"], event: PointerEvent<Element>): CheckboxHoverEvent => ({
        type,
        pointerType: event.pointerType,
        target: event.currentTarget,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
    });

    return (
        <BaseCheckbox.Root
            ref={ref}
            checked={isSelected}
            defaultChecked={defaultSelected}
            onCheckedChange={onChange}
            indeterminate={isIndeterminate}
            disabled={isDisabled}
            readOnly={isReadOnly}
            required={isRequired}
            aria-invalid={isInvalid || undefined}
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
                    "relative flex items-start",
                    state.disabled && "cursor-not-allowed",
                    sizes[size].root,
                    typeof className === "function" ? className(toState(state)) : className,
                )
            }
            style={typeof style === "function" ? (state) => style(toState(state)) : style}
            render={(props, state) => {
                const children = (
                    <>
                        <CheckboxBase
                            size={size}
                            isSelected={state.checked}
                            isIndeterminate={state.indeterminate}
                            isDisabled={state.disabled}
                            isFocusVisible={interaction.isFocusVisible}
                            className={label || hint ? "mt-0.5" : ""}
                        />
                        {(label || hint) && (
                            <div className={cx("inline-flex flex-col", sizes[size].textWrapper)}>
                                {label && <p className={cx("text-secondary select-none", sizes[size].label)}>{label}</p>}
                                {hint && (
                                    <span className={cx("text-tertiary", sizes[size].hint)} onClick={(event) => event.stopPropagation()}>
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
            {...ariaCheckboxProps}
        />
    );
};
Checkbox.displayName = "Checkbox";
