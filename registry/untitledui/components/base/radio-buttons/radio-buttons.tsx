/* Adopted from untitleduico/react@8b7409c078f8 — components/base/radio-buttons/radio-buttons.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import { Radio as BaseRadio, type RadioRootState } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup, type RadioGroupState as BaseRadioGroupState } from "@base-ui/react/radio-group";
import { type ComponentPropsWithoutRef, type ComponentPropsWithRef, type CSSProperties, type PointerEvent, type ReactElement, type ReactNode, type Ref, createContext, useContext, useState } from "react";
import { cx } from "@/utils/cx";

export interface RadioGroupContextType {
    size?: "sm" | "md";
}

const RadioGroupContext = createContext<RadioGroupContextType | null>(null);

export interface RadioButtonBaseProps {
    size?: "sm" | "md";
    className?: string;
    isFocusVisible?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
}

export const RadioButtonBase = ({ className, isFocusVisible, isSelected, isDisabled, size = "sm" }: RadioButtonBaseProps) => {
    return (
        <div
            className={cx(
                "flex size-4 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full bg-primary ring-1 ring-primary ring-inset",
                size === "md" && "size-5",
                isSelected && "bg-brand-solid ring-brand-solid",
                isDisabled && "cursor-not-allowed opacity-50",
                isDisabled && !isSelected && "bg-tertiary",
                isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                className,
            )}
        >
            <div className={cx("size-1.5 rounded-full bg-fg-white opacity-0 transition-inherit-all", size === "md" && "size-2", isSelected && "opacity-100")} />
        </div>
    );
};
RadioButtonBase.displayName = "RadioButtonBase";

/**
 * The render-prop state React Aria handed to `className`, `style` and `children`.
 *
 * Selection and validity come from Base UI's state; hover, focus and focus-visible are tracked here because
 * Base UI does not model them (it exposes them as CSS state only). `isPressed` and `state` are not reproduced.
 */
interface RadioButtonState {
    isSelected: boolean;
    isHovered: boolean;
    isFocused: boolean;
    isFocusVisible: boolean;
    isDisabled: boolean;
    isReadOnly: boolean;
    isRequired: boolean;
    isInvalid: boolean;
}

/** React Aria's hover event payload, rebuilt from the native pointer event for `onHoverStart`/`onHoverEnd`. */
interface RadioButtonHoverEvent {
    type: "hoverstart" | "hoverend" | "hoverchange";
    pointerType: "mouse" | "pen" | "touch" | "";
    target: Element;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
}

/** React Aria's press event payload. Accepted for source compatibility; see `onPress` on RadioButtonProps. */
interface RadioButtonPressEvent {
    type: "pressstart" | "pressend" | "pressup" | "press" | "presschange";
    pointerType: "mouse" | "pen" | "touch" | "";
    target: Element;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
}

/**
 * Base UI types the radio root as a `<span>` and owns selection/validity state, so those bindings are replaced
 * by the React Aria names the payload exposes below; everything else (`id`, `aria-*`, DOM events) passes
 * straight through to the root element.
 */
type BaseRadioRootProps = Omit<
    ComponentPropsWithoutRef<typeof BaseRadio.Root>,
    "ref" | "value" | "disabled" | "readOnly" | "required" | "nativeButton" | "className" | "style" | "render"
>;

type RadioButtonProps = BaseRadioRootProps & {
    ref?: Ref<HTMLLabelElement>;
    size?: "sm" | "md";
    label?: ReactNode;
    hint?: ReactNode;
    className?: string | ((state: RadioButtonState) => string | undefined);
    style?: CSSProperties | ((state: RadioButtonState) => CSSProperties | undefined);
    /** The unique identifying value of the radio inside its group. */
    value: string | number;
    isDisabled?: boolean;
    excludeFromTabOrder?: boolean;
    /** React Aria's DOM render escape hatch: replaces the root element, receiving the root props and the state. */
    render?: (props: ComponentPropsWithRef<"label">, state: RadioButtonState) => ReactElement;
    onHoverStart?: (event: RadioButtonHoverEvent) => void;
    onHoverEnd?: (event: RadioButtonHoverEvent) => void;
    onHoverChange?: (isHovering: boolean) => void;
    /**
     * React Aria's press callbacks are accepted for source compatibility but are not invoked: Base UI activates
     * a radio through the root's click handler and its hidden input, and exposes no press-event API to hook into.
     */
    onPressStart?: (event: RadioButtonPressEvent) => void;
    onPressEnd?: (event: RadioButtonPressEvent) => void;
    onPress?: (event: RadioButtonPressEvent) => void;
    onPressUp?: (event: RadioButtonPressEvent) => void;
    onPressChange?: (isPressed: boolean) => void;
};

export const RadioButton = ({
    label,
    hint,
    className,
    style,
    render,
    ref,
    size = "sm",
    value,
    isDisabled,
    excludeFromTabOrder,
    onFocus,
    onBlur,
    onPointerEnter,
    onPointerLeave,
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    onPressStart: _onPressStart,
    onPressEnd: _onPressEnd,
    onPress: _onPress,
    onPressUp: _onPressUp,
    onPressChange: _onPressChange,
    ...ariaRadioProps
}: RadioButtonProps) => {
    const context = useContext(RadioGroupContext);

    size = context?.size ?? size;

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

    // Base UI models selection/validity only, so the interaction flags React Aria exposed are tracked here.
    const [interaction, setInteraction] = useState({ isHovered: false, isFocused: false, isFocusVisible: false });

    const toState = (state: RadioRootState): RadioButtonState => ({
        isSelected: state.checked,
        isHovered: interaction.isHovered,
        isFocused: interaction.isFocused,
        isFocusVisible: interaction.isFocusVisible,
        isDisabled: state.disabled,
        isReadOnly: state.readOnly,
        isRequired: state.required,
        isInvalid: state.valid === false,
    });

    const hoverEvent = (type: RadioButtonHoverEvent["type"], event: PointerEvent<Element>): RadioButtonHoverEvent => ({
        type,
        pointerType: event.pointerType,
        target: event.currentTarget,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
    });

    return (
        <BaseRadio.Root
            ref={ref}
            value={value}
            disabled={isDisabled}
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
                        <RadioButtonBase
                            size={size}
                            isSelected={state.checked}
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
            {...ariaRadioProps}
        />
    );
};
RadioButton.displayName = "RadioButton";

/** The render-prop state React Aria handed to the radio group's `className`, `style` and `children`. */
interface RadioGroupState {
    orientation: "horizontal" | "vertical";
    isDisabled: boolean;
    isReadOnly: boolean;
    isRequired: boolean;
    isInvalid: boolean;
}

interface RadioGroupProps extends Omit<ComponentPropsWithoutRef<"div">, "className" | "style" | "onChange" | "value" | "defaultValue"> {
    children: ReactNode;
    className?: string | ((state: RadioGroupState) => string | undefined);
    style?: CSSProperties | ((state: RadioGroupState) => CSSProperties | undefined);
    size?: "sm" | "md";
    value?: string | number | null;
    defaultValue?: string | number | null;
    onChange?: (value: string | number) => void;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    isRequired?: boolean;
    isInvalid?: boolean;
    orientation?: "horizontal" | "vertical";
    /** React Aria's DOM render escape hatch: replaces the group element, receiving its props and the state. */
    render?: (props: ComponentPropsWithRef<"div">, state: RadioGroupState) => ReactElement;
}

export const RadioGroup = ({
    children,
    className,
    style,
    render,
    size = "sm",
    value,
    defaultValue,
    onChange,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    orientation = "vertical",
    ...props
}: RadioGroupProps) => {
    const toState = (state: BaseRadioGroupState): RadioGroupState => ({
        orientation,
        isDisabled: state.disabled,
        isReadOnly: state.readOnly,
        isRequired: state.required,
        isInvalid: isInvalid ?? state.valid === false,
    });

    return (
        <RadioGroupContext.Provider value={{ size }}>
            <BaseRadioGroup
                value={value ?? undefined}
                defaultValue={defaultValue ?? undefined}
                onValueChange={onChange}
                disabled={isDisabled}
                readOnly={isReadOnly}
                required={isRequired}
                aria-invalid={isInvalid || undefined}
                // Base UI's radio group has no orientation prop; the attribute React Aria exposed is kept, while
                // the arrow-key composite moves focus on both axes.
                aria-orientation={orientation}
                className={(state) => cx("flex flex-col gap-4", typeof className === "function" ? className(toState(state)) : className)}
                style={typeof style === "function" ? (state) => style(toState(state)) : style}
                // React Aria's `render` escape hatch, given the group props (children included) and the state.
                {...(render ? { render: (elementProps: ComponentPropsWithRef<"div">, state: BaseRadioGroupState) => render({ ...elementProps, children }, toState(state)) } : {})}
                {...props}
            >
                {children}
            </BaseRadioGroup>
        </RadioGroupContext.Provider>
    );
};
