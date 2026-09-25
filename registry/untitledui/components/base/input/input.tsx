/* Adopted from untitleduico/react@8b7409c078f8 — components/base/input/input.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import { type ComponentPropsWithoutRef, type ComponentType, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref, createContext, useContext, useState } from "react";
import { Eye, EyeOff, HelpCircle, InfoCircle } from "@untitledui/icons";
import { Field } from "@base-ui/react/field";
import { Input as BaseInput } from "@base-ui/react/input";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx, sortCx } from "@/utils/cx";

/** The render state React Aria's `Input` handed to a function `className`. */
interface InputState {
    isHovered: boolean;
    isFocused: boolean;
    isFocusVisible: boolean;
    isDisabled: boolean;
    isInvalid: boolean;
}

export interface InputBaseProps extends Omit<ComponentPropsWithoutRef<"input">, "size" | "className"> {
    /** Tooltip message on hover. */
    tooltip?: string;
    /** Whether the input is invalid. */
    isInvalid?: boolean;
    /** Whether the input is disabled. */
    isDisabled?: boolean;
    /** Whether the input is required. */
    isRequired?: boolean;
    /** Whether the input is read only. */
    isReadOnly?: boolean;
    /**
     * Input size.
     * @default "sm"
     */
    size?: "sm" | "md" | "lg";
    /** Placeholder text. */
    placeholder?: string;
    /** Class name for the icon. */
    iconClassName?: string;
    /** Class name for the input. */
    inputClassName?: string;
    /** Class name for the input wrapper. */
    wrapperClassName?: string;
    /** Class name for the tooltip. */
    tooltipClassName?: string;
    /** Keyboard shortcut to display. */
    shortcut?: string | boolean;
    ref?: Ref<HTMLInputElement>;
    groupRef?: Ref<HTMLDivElement>;
    /** Icon component to display on the left side of the input. */
    icon?: ComponentType<HTMLAttributes<HTMLOrSVGElement>>;
    /** Class name for the input element, or a function of its state. */
    className?: string | ((state: InputState) => string | undefined);
}

/** The props `TextField` forwards to the control it labels (value binding and input-only DOM attributes). */
interface TextFieldControlProps {
    id?: string;
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string, eventDetails: unknown) => void;
    type?: string;
    inputMode?: ComponentPropsWithoutRef<"input">["inputMode"];
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    autoComplete?: string;
    autoFocus?: boolean;
    enterKeyHint?: ComponentPropsWithoutRef<"input">["enterKeyHint"];
    spellCheck?: boolean;
}

export const InputBase = ({
    ref,
    tooltip,
    shortcut,
    groupRef,
    size = "md",
    isInvalid,
    isDisabled,
    isRequired,
    isReadOnly,
    icon: Icon,
    placeholder,
    wrapperClassName,
    tooltipClassName,
    inputClassName,
    iconClassName,
    type,
    className,
    ...inputProps
}: InputBaseProps) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isFocusWithin, setIsFocusWithin] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isFocusVisible, setIsFocusVisible] = useState(false);

    // If the input is inside a `TextFieldContext`, use its context to simplify applying styles
    const context = useContext(TextFieldContext);

    // Inside a `TextField` the field owns the state; explicit props still win, exactly as React Aria's
    // field context merged into `Group` and `Input`.
    const isDisabledResolved = isDisabled ?? context?.isDisabled;
    const isInvalidResolved = isInvalid ?? context?.isInvalid;
    const isRequiredResolved = isRequired ?? context?.isRequired;
    const isReadOnlyResolved = isReadOnly ?? context?.isReadOnly;

    // Check if the input has a leading icon or tooltip
    const hasTrailingIcon = tooltip || isInvalidResolved;
    const hasLeadingIcon = Icon;

    const inputSize = context?.size || size;
    const typeResolved = type ?? context?.controlProps?.type ?? "text";

    const inputState: InputState = {
        isHovered,
        isFocused: isFocusWithin,
        isFocusVisible,
        isDisabled: !!isDisabledResolved,
        isInvalid: !!isInvalidResolved,
    };

    const sizes = sortCx({
        sm: {
            root: cx("px-3 py-2 text-sm", hasLeadingIcon && "pl-9", hasTrailingIcon && "pr-9"),
            iconLeading: "left-3 size-4 stroke-[2.25px]",
            iconTrailing: "right-3",
            shortcut: "pr-1.5",
        },
        md: {
            root: cx("px-3 py-2 text-md", hasLeadingIcon && "pl-10", hasTrailingIcon && "pr-9"),
            iconLeading: "left-3 size-5",
            iconTrailing: "right-3",
            shortcut: "pr-2",
        },
        lg: {
            root: cx("px-3.5 py-2.5 text-md", hasLeadingIcon && "pl-10.5", hasTrailingIcon && "pr-9.5"),
            iconLeading: "left-3.5 size-5",
            iconTrailing: "right-3.5",
            shortcut: "pr-2.5",
        },
    });

    return (
        <div
            // A React Aria field renders its wrapper with `role="presentation"`; a standalone one is a group.
            role={context ? "presentation" : "group"}
            data-disabled={isDisabledResolved || undefined}
            data-invalid={isInvalidResolved || undefined}
            onFocus={() => setIsFocusWithin(true)}
            onBlur={() => setIsFocusWithin(false)}
            ref={groupRef}
            className={cx(
                "group/input relative flex w-full flex-row place-content-center place-items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary transition-shadow duration-100 ease-linear ring-inset",

                isFocusWithin && !isDisabledResolved && "ring-2 ring-brand",

                // Disabled state styles
                isDisabledResolved && "cursor-not-allowed opacity-50",
                "group-data-disabled:cursor-not-allowed group-data-disabled:opacity-50",

                // Invalid state styles
                isInvalidResolved && "ring-error_subtle",
                "group-data-invalid:ring-error_subtle",

                // Invalid state with focus-within styles
                isInvalidResolved && isFocusWithin && "ring-2 ring-error",
                isFocusWithin && "group-data-invalid:ring-2 group-data-invalid:ring-error",

                context?.wrapperClassName,
                wrapperClassName,
            )}
        >
            {/* Leading icon and Payment icon */}
            {Icon && (
                <Icon className={cx("pointer-events-none absolute text-fg-quaternary", sizes[inputSize].iconLeading, context?.iconClassName, iconClassName)} />
            )}

            {/* Input field */}
            <BaseInput
                {...context?.controlProps}
                {...inputProps}
                ref={ref}
                required={isRequiredResolved || undefined}
                disabled={isDisabledResolved || undefined}
                readOnly={isReadOnlyResolved || undefined}
                aria-invalid={isInvalidResolved || undefined}
                aria-label={context?.ariaLabel}
                type={typeResolved === "password" && isPasswordVisible ? "text" : typeResolved}
                placeholder={placeholder}
                onPointerEnter={() => setIsHovered(true)}
                onPointerLeave={() => setIsHovered(false)}
                onFocus={(event) => {
                    setIsFocusVisible(event.currentTarget.matches(":focus-visible"));
                    inputProps.onFocus?.(event);
                }}
                onBlur={(event) => {
                    setIsFocusVisible(false);
                    inputProps.onBlur?.(event);
                }}
                className={(state) =>
                    cx(
                        "m-0 w-full bg-transparent text-primary ring-0 outline-hidden placeholder:text-placeholder autofill:rounded-lg autofill:text-primary disabled:cursor-not-allowed",
                        sizes[inputSize].root,
                        context?.inputClassName,
                        inputClassName,
                        typeof className === "function"
                            ? className({ ...inputState, isFocused: state.focused, isDisabled: state.disabled, isInvalid: state.valid === false })
                            : className,
                    )
                }
            />

            {/* Tooltip and help icon */}
            {tooltip && typeResolved !== "password" && (
                <Tooltip title={tooltip} placement="top">
                    <TooltipTrigger
                        className={cx(
                            "absolute cursor-pointer text-fg-quaternary transition duration-100 ease-linear group-data-invalid/input:hidden hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover",
                            sizes[inputSize].iconTrailing,
                            context?.tooltipClassName,
                            tooltipClassName,
                        )}
                    >
                        <HelpCircle className="size-4 stroke-[2.25px]" />
                    </TooltipTrigger>
                </Tooltip>
            )}

            {/* Invalid icon */}
            {typeResolved !== "password" && (
                <InfoCircle
                    className={cx(
                        "pointer-events-none absolute hidden size-4 stroke-[2.25px] text-fg-error-secondary group-data-invalid/input:block",
                        sizes[inputSize].iconTrailing,
                        context?.tooltipClassName,
                        tooltipClassName,
                    )}
                />
            )}

            {/* Password visibility toggle */}
            {typeResolved === "password" && (
                <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    className={cx(
                        "absolute flex cursor-pointer items-center justify-center text-fg-quaternary transition duration-100 ease-linear hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover focus:outline-hidden",
                        sizes[inputSize].iconTrailing,
                    )}
                >
                    {isPasswordVisible ? <EyeOff className="size-4 stroke-[2.25px]" /> : <Eye className="size-4 stroke-[2.25px]" />}
                </button>
            )}

            {/* Shortcut */}
            {shortcut && (
                <div
                    className={cx(
                        "pointer-events-none absolute inset-y-0.5 right-0.5 z-10 hidden items-center rounded-r-[inherit] bg-linear-to-r from-transparent to-bg-primary to-40% pl-8 md:flex",
                        sizes[inputSize].shortcut,
                    )}
                >
                    <span
                        aria-hidden="true"
                        className="pointer-events-none rounded px-1 py-px text-xs font-medium text-quaternary ring-1 ring-secondary select-none ring-inset"
                    >
                        {typeof shortcut === "string" ? shortcut : "⌘K"}
                    </span>
                </div>
            )}
        </div>
    );
};

InputBase.displayName = "InputBase";

/** The render state React Aria's `TextField` handed to `className`, `style` and `children`. */
interface TextFieldState {
    isDisabled: boolean;
    isInvalid: boolean;
    isReadOnly: boolean;
    isRequired: boolean;
}

interface TextFieldSharedProps extends Partial<Pick<InputBaseProps, "size" | "wrapperClassName" | "inputClassName" | "iconClassName" | "tooltipClassName">> {}

interface TextFieldContextProps extends TextFieldSharedProps {
    isDisabled?: boolean;
    isInvalid?: boolean;
    isRequired?: boolean;
    isReadOnly?: boolean;
    /** Input-only props `TextField` forwards to the control it labels. */
    controlProps?: TextFieldControlProps;
    /** `aria-label` for the control (the field wrapper itself is a plain `div`). */
    ariaLabel?: string;
}

const TextFieldContext = createContext<TextFieldContextProps>({});

export interface TextFieldProps extends TextFieldSharedProps, Omit<ComponentPropsWithoutRef<"div">, "children" | "className" | "style" | "onChange"> {
    children?: ReactNode | ((state: TextFieldState) => ReactNode);
    className?: string | ((state: TextFieldState) => string | undefined);
    style?: CSSProperties | ((state: TextFieldState) => CSSProperties | undefined);
    ref?: Ref<HTMLDivElement>;
    /** Whether the field is disabled. */
    isDisabled?: boolean;
    /** Whether the value is invalid. */
    isInvalid?: boolean;
    /** Whether the field is required. */
    isRequired?: boolean;
    /** Whether the field is read only. */
    isReadOnly?: boolean;
    /** Custom validation for the field's value. */
    validate?: (value: string) => string | string[] | null | void | Promise<string | string[] | null | void>;
    /** The current value (controlled). */
    value?: string;
    /** The default value (uncontrolled). */
    defaultValue?: string;
    /** Called when the value changes. */
    onChange?: (value: string) => void;
    /** The name of the control, which is submitted with the form data. */
    name?: string;
    /** Placeholder text for the control. */
    placeholder?: string;
    /** The type of the control. */
    type?: string;
    inputMode?: ComponentPropsWithoutRef<"input">["inputMode"];
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    autoComplete?: string;
    autoFocus?: boolean;
    enterKeyHint?: ComponentPropsWithoutRef<"input">["enterKeyHint"];
    spellCheck?: boolean;
    /** Identifies the control element. */
    id?: string;
}

export const TextField = ({
    className,
    style,
    size = "md",
    inputClassName,
    wrapperClassName,
    iconClassName,
    tooltipClassName,
    children,
    isDisabled,
    isInvalid,
    isRequired,
    isReadOnly,
    validate,
    value,
    defaultValue,
    onChange,
    name,
    placeholder,
    type,
    inputMode,
    maxLength,
    minLength,
    pattern,
    autoComplete,
    autoFocus,
    enterKeyHint,
    spellCheck,
    id,
    ...props
}: TextFieldProps) => {
    const { "aria-label": ariaLabel, ...rootProps } = props;

    const controlProps: TextFieldControlProps = {
        id,
        value,
        defaultValue,
        onValueChange: onChange ? (nextValue: string) => onChange(nextValue) : undefined,
        type,
        inputMode,
        maxLength,
        minLength,
        pattern,
        autoComplete,
        autoFocus,
        enterKeyHint,
        spellCheck,
    };

    // React Aria's field render props; the explicit props win over what `Field.Validity` reports, exactly as
    // React Aria's `isInvalid` prop overrode its validation state.
    const toState = (isInvalidValue: boolean): TextFieldState => ({
        isDisabled: !!isDisabled,
        isInvalid: isInvalid ?? isInvalidValue,
        isReadOnly: !!isReadOnly,
        isRequired: !!isRequired,
    });

    return (
        <TextFieldContext.Provider
            value={{
                inputClassName,
                wrapperClassName,
                iconClassName,
                tooltipClassName,
                size,
                isDisabled,
                isInvalid,
                isRequired,
                isReadOnly,
                controlProps,
                ariaLabel,
            }}
        >
            <Field.Root
                {...rootProps}
                data-input-wrapper
                data-input-size={size}
                name={name}
                disabled={isDisabled}
                invalid={isInvalid}
                validate={validate as Field.Root.Props["validate"]}
                className={(state) =>
                    cx(
                        "group flex h-max w-full flex-col items-start justify-start gap-1.5",
                        typeof className === "function" ? className(toState(state.valid === false)) : className,
                    )
                }
                style={typeof style === "function" ? undefined : style}
            >
                {typeof children === "function" ? (
                    <Field.Validity>{(validity) => children(toState(validity.validity.valid === false))}</Field.Validity>
                ) : (
                    children
                )}
            </Field.Root>
        </TextFieldContext.Provider>
    );
};

TextField.displayName = "TextField";

export interface InputProps
    extends
        Omit<TextFieldProps, "ref">,
        Pick<
            InputBaseProps,
            | "ref"
            | "placeholder"
            | "icon"
            | "shortcut"
            | "tooltip"
            | "groupRef"
            | "size"
            | "wrapperClassName"
            | "inputClassName"
            | "iconClassName"
            | "tooltipClassName"
        > {
    /** Label text for the input */
    label?: string;
    /** Helper text displayed below the input */
    hint?: ReactNode;
    /** Whether to hide required indicator from label */
    hideRequiredIndicator?: boolean;
}

export const Input = ({
    size = "md",
    placeholder,
    icon: Icon,
    label,
    hint,
    shortcut,
    hideRequiredIndicator,
    className,
    ref,
    groupRef,
    tooltip,
    iconClassName,
    inputClassName,
    wrapperClassName,
    tooltipClassName,
    type = "text",
    ...props
}: InputProps) => {
    return (
        <TextField aria-label={!label ? placeholder : undefined} {...props} size={size} className={className} type={type}>
            {({ isRequired, isInvalid }) => (
                <>
                    {label && (
                        <Label isRequired={hideRequiredIndicator ? !hideRequiredIndicator : isRequired} isInvalid={isInvalid}>
                            {label}
                        </Label>
                    )}

                    <InputBase
                        {...{
                            ref,
                            groupRef,
                            size,
                            placeholder,
                            icon: Icon,
                            shortcut,
                            iconClassName,
                            inputClassName,
                            wrapperClassName,
                            tooltipClassName,
                            tooltip,
                            type,
                        }}
                    />

                    {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
                </>
            )}
        </TextField>
    );
};

Input.displayName = "Input";
