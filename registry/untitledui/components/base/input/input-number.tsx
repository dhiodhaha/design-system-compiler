/* Adopted from untitleduico/react@8b7409c078f8 — components/base/input/input-number.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { CSSProperties, ReactNode, Ref } from "react";
import { createContext, useContext, useState } from "react";
import { ChevronDown, ChevronUp, Minus, Plus } from "@untitledui/icons";
import { Field } from "@base-ui/react/field";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { cx } from "@/utils/cx";
import { Button } from "../buttons/button";
import { HintText } from "./hint-text";
import { Label } from "./label";

const NumberFieldContext = createContext<{
    size?: "sm" | "md" | "lg";
    wrapperClassName?: string;
    iconClassName?: string;
    tooltipClassName?: string;
    inputClassName?: string;
}>({});

const styles = {
    sm: "px-3 py-2 text-sm",
    md: "px-3 py-2 text-md",
    lg: "px-3.5 py-2.5 text-md",
};

/** The number field's render state, passed to a function `className` on the field wrapper. */
export interface InputNumberState {
    /** Whether the field is disabled. */
    isDisabled: boolean;
    /** Whether the field is invalid. */
    isInvalid: boolean;
    /** Whether the field is required. */
    isRequired: boolean;
    /** Whether the field is read only. */
    isReadOnly: boolean;
}

export interface InputNumberBaseProps extends Omit<React.ComponentPropsWithRef<"div">, "children" | "className" | "style" | "value" | "defaultValue" | "onChange" | "color" | "ref" | "slot"> {
    /**
     * Input size.
     * @default "sm"
     */
    size?: "sm" | "md" | "lg";
    /** Placeholder text. */
    placeholder?: string;
    /** Class name for the input. */
    inputClassName?: string;
    /** Class name for the input wrapper. */
    wrapperClassName?: string;
    ref?: Ref<HTMLInputElement>;
    groupRef?: Ref<HTMLDivElement>;
    /** Orientation of buttons. */
    orientation?: "horizontal" | "vertical";
    /** The current value (controlled). */
    value?: number | null;
    /** The default value (uncontrolled). */
    defaultValue?: number;
    /** Handler that is called when the value changes. */
    onChange?: (value: number | null) => void;
    /** Handler that is called when the value settles — after typing and blurring, or on pointer release. */
    onChangeEnd?: (value: number | null) => void;
    /** The smallest value allowed. */
    minValue?: number;
    /** The largest value allowed. */
    maxValue?: number;
    /**
     * The amount that the value changes on each increment or decrement.
     * @default 1
     */
    step?: number;
    /** The value's number formatting. */
    formatOptions?: Intl.NumberFormatOptions;
    /** The locale used to format the value. */
    locale?: Intl.LocalesArgument;
    /** Whether the field is disabled. */
    isDisabled?: boolean;
    /** Whether the field is read only. */
    isReadOnly?: boolean;
    /** Whether the field is required. */
    isRequired?: boolean;
    /** Whether the value is invalid. */
    isInvalid?: boolean;
    /** Whether the value can be changed with the mouse wheel. React Aria's `isWheelDisabled` inverted. */
    isWheelDisabled?: boolean;
    /** The `aria-label` of the increment button. */
    incrementAriaLabel?: string;
    /** The `aria-label` of the decrement button. */
    decrementAriaLabel?: string;
    /** The name of the field, submitted with the form data. */
    name?: string;
    /** The id of the input element. */
    id?: string;
    /** Whether the input is focused on mount. */
    autoFocus?: boolean;
    /** The input's autocomplete hint. */
    autoComplete?: string;
    /** The enter key's action on the input's virtual keyboard. */
    enterKeyHint?: React.ComponentPropsWithRef<"input">["enterKeyHint"];
    /** The class name for the group, or a function of its state. */
    className?: string | ((state: InputNumberState) => string | undefined);
    /** The inline styles for the group, or a function of its state. */
    style?: CSSProperties | ((state: InputNumberState) => CSSProperties | undefined);
    /** The slot the field fills. Renders the native `slot` attribute. */
    slot?: string | null;
}

export const InputNumberBase = ({
    ref,
    groupRef,
    size = "md",
    isInvalid,
    isDisabled,
    isReadOnly,
    isRequired,
    placeholder,
    wrapperClassName,
    inputClassName,
    orientation = "vertical",
    value,
    defaultValue,
    onChange,
    onChangeEnd,
    minValue,
    maxValue,
    step,
    formatOptions,
    locale,
    isWheelDisabled,
    incrementAriaLabel = "Increase",
    decrementAriaLabel = "Decrease",
    name,
    id,
    autoFocus,
    autoComplete,
    enterKeyHint,
    className,
    style,
    slot,
    ...inputProps
}: Omit<InputNumberBaseProps, "label" | "hint">) => {
    // If the input is inside a `TextFieldContext`, use its context to simplify applying styles
    const context = useContext(NumberFieldContext);

    const inputSize = context?.size || size;
    // The group's focus ring covers the steppers too, which the field's own focus state does not.
    const [isFocusWithin, setFocusWithin] = useState(false);

    const groupState = (state: { disabled: boolean; valid: boolean | null }): InputNumberState => ({
        isDisabled: state.disabled,
        isInvalid: isInvalid ?? state.valid === false,
        isRequired: !!isRequired,
        isReadOnly: !!isReadOnly,
    });

    return (
        <BaseNumberField.Root
            value={value}
            defaultValue={defaultValue}
            onValueChange={(next) => onChange?.(next)}
            onValueCommitted={(next) => onChangeEnd?.(next)}
            min={minValue}
            max={maxValue}
            step={step}
            format={formatOptions}
            locale={locale}
            disabled={isDisabled}
            readOnly={isReadOnly}
            required={isRequired}
            // React Aria changed the value on wheel by default and had `isWheelDisabled` to turn it off.
            allowWheelScrub={isWheelDisabled === undefined ? true : !isWheelDisabled}
            name={name}
            id={id}
            slot={slot ?? undefined}
            // The root is a flex item of the field wrapper (which aligns its children to the start), so it
            // fills the row itself — the group inside it is `w-full` and would otherwise collapse to the
            // input's width.
            className="w-full"
        >
            <BaseNumberField.Group
                ref={groupRef}
                onFocus={() => setFocusWithin(true)}
                onBlur={() => setFocusWithin(false)}
                className={(state) =>
                    cx(
                        "relative flex w-full flex-row items-stretch rounded-lg bg-primary shadow-xs outline-1 -outline-offset-1 outline-primary transition-all duration-100 ease-linear",

                        isFocusWithin && !state.disabled && "outline-2 -outline-offset-2 outline-brand",

                        // Disabled state styles
                        state.disabled && "cursor-not-allowed opacity-50 in-data-input-wrapper:opacity-100",
                        "group-data-disabled:cursor-not-allowed group-data-disabled:opacity-50 in-data-input-wrapper:group-data-disabled:opacity-100",

                        // Invalid state styles
                        groupState(state).isInvalid && "outline-error_subtle",
                        "group-data-invalid:outline-error_subtle",

                        // Invalid state with focus-within styles
                        groupState(state).isInvalid && isFocusWithin && "outline-2 -outline-offset-2 outline-error",
                        isFocusWithin && "group-data-invalid:outline-2 group-data-invalid:-outline-offset-2 group-data-invalid:outline-error",

                        context?.wrapperClassName,
                        wrapperClassName,
                    )
                }
            >
                {orientation === "horizontal" && (
                    <BaseNumberField.Decrement
                        aria-label={decrementAriaLabel}
                        render={<Button size={size} iconLeading={Minus} slot="decrement" color="tertiary" className="static h-full rounded-r-none" />}
                    />
                )}

                {/* Input field */}
                <BaseNumberField.Input
                    {...inputProps}
                    ref={ref}
                    disabled={isDisabled}
                    readOnly={isReadOnly}
                    required={isRequired}
                    aria-invalid={isInvalid || undefined}
                    autoFocus={autoFocus}
                    autoComplete={autoComplete}
                    enterKeyHint={enterKeyHint}
                    placeholder={placeholder}
                    style={typeof style === "function" ? (state) => style(groupState(state)) : style}
                    className={(state) =>
                        cx(
                            "m-0 w-full bg-transparent text-primary ring-0 outline-hidden placeholder:text-placeholder autofill:rounded-lg autofill:text-primary disabled:cursor-not-allowed",
                            orientation === "horizontal" && "text-center",
                            styles[inputSize],
                            context?.inputClassName,
                            inputClassName,
                            // The consumer's class name lands on the input, where the adopted component always put it.
                            typeof className === "function" ? className(groupState(state)) : className,
                        )
                    }
                />

                {orientation === "horizontal" && (
                    <BaseNumberField.Increment
                        aria-label={incrementAriaLabel}
                        render={<Button size={size} iconLeading={Plus} slot="increment" color="tertiary" className="static h-full rounded-l-none" />}
                    />
                )}

                {orientation === "vertical" && (
                    <div className={cx("flex w-7 shrink-0 flex-col border-l border-primary", size === "lg" && "w-7.5")}>
                        <BaseNumberField.Increment
                            aria-label={incrementAriaLabel}
                            className="flex flex-1 cursor-pointer items-center justify-center text-fg-quaternary outline-brand transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ChevronUp className={cx("size-3 stroke-3", size === "lg" && "size-3.5 stroke-[2.57px]")} />
                        </BaseNumberField.Increment>
                        <BaseNumberField.Decrement
                            aria-label={decrementAriaLabel}
                            className="flex flex-1 cursor-pointer items-center justify-center border-t border-primary text-fg-quaternary outline-brand transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ChevronDown className={cx("size-3 stroke-3", size === "lg" && "size-3.5 stroke-[2.57px]")} />
                        </BaseNumberField.Decrement>
                    </div>
                )}
            </BaseNumberField.Group>
        </BaseNumberField.Root>
    );
};

interface InputProps extends InputNumberBaseProps {
    /** Label text for the input */
    label?: string;
    /** Helper text displayed below the input */
    hint?: ReactNode;
    hideRequiredIndicator?: boolean;
    /**
     * Carried over from the adopted source, where the props were copied from a date field: it has no
     * meaning for a number field and is accepted (and ignored) for API compatibility.
     */
    granularity?: "day" | "hour" | "minute" | "second";
}

export const InputNumber = ({
    size = "md",
    placeholder,
    label,
    hint,
    hideRequiredIndicator,
    className,
    ref,
    groupRef,
    inputClassName,
    wrapperClassName,
    orientation = "vertical",
    isDisabled,
    isInvalid,
    isRequired,
    isReadOnly,
    // Accepted for API compatibility: a number field has no granularity.
    granularity: _granularity,
    ...props
}: InputProps) => {
    const toState = (isInvalidValue: boolean): InputNumberState => ({
        isDisabled: !!isDisabled,
        isInvalid: isInvalid ?? isInvalidValue,
        isRequired: !!isRequired,
        isReadOnly: !!isReadOnly,
    });

    return (
        <Field.Root
            disabled={isDisabled}
            invalid={isInvalid}
            className={(state) =>
                cx("group flex h-max w-full flex-col items-start justify-start gap-1.5", typeof className === "function" ? className(toState(state.valid === false)) : className)
            }
        >
            {label && (
                <Label isRequired={hideRequiredIndicator ? !hideRequiredIndicator : isRequired} isInvalid={isInvalid}>
                    {label}
                </Label>
            )}

            <InputNumberBase
                {...{
                    ref,
                    groupRef,
                    size,
                    placeholder,
                    inputClassName,
                    wrapperClassName,
                    orientation,
                    isDisabled,
                    isReadOnly,
                    isRequired,
                    isInvalid,
                }}
                {...props}
            />

            {hint && (
                <HintText isInvalid={isInvalid} className={cx(size === "sm" && "text-xs")}>
                    {hint}
                </HintText>
            )}
        </Field.Root>
    );
};
