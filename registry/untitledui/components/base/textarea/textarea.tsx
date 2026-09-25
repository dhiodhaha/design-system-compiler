/* Adopted from untitleduico/react@8b7409c078f8 — components/base/textarea/textarea.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import React from "react";
import { Field } from "@base-ui/react/field";
import { TextField, type TextFieldProps } from "@/components/base/input/input";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { cx } from "@/utils/cx";

// Creates a data URL for an SVG resize handle with a given color.
const getResizeHandleBg = (color: string) => {
    return `url(data:image/svg+xml;base64,${btoa(`<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2L2 10" stroke="${color}" stroke-linecap="round"/><path d="M11 7L7 11" stroke="${color}" stroke-linecap="round"/></svg>`)}`;
};

/** The render state React Aria's `TextArea` handed to a function `className`. */
interface TextAreaState {
    isHovered: boolean;
    isFocused: boolean;
    isFocusVisible: boolean;
    isDisabled: boolean;
    isInvalid: boolean;
}

interface TextAreaBaseProps extends Omit<ComponentPropsWithoutRef<"textarea">, "className"> {
    ref?: Ref<HTMLTextAreaElement>;
    size?: "sm" | "md";
    /** Class name for the textarea element, or a function of its state. */
    className?: string | ((state: TextAreaState) => string | undefined);
    isDisabled?: boolean;
    isInvalid?: boolean;
    isRequired?: boolean;
    isReadOnly?: boolean;
}

export const TextAreaBase = ({ className, size = "md", isDisabled, isInvalid, isRequired, isReadOnly, ref, ...props }: TextAreaBaseProps) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [isFocusVisible, setIsFocusVisible] = React.useState(false);

    // `Field.Control` renders an `<input>` by default, so its props are typed for the input element; the
    // render prop below swaps in the `<textarea>` these props (and this ref) actually belong to.
    const controlProps = props as Field.Control.Props;

    return (
        <Field.Control
            render={<textarea />}
            {...controlProps}
            ref={ref as React.Ref<HTMLInputElement>}
            disabled={isDisabled || undefined}
            required={isRequired || undefined}
            readOnly={isReadOnly || undefined}
            aria-invalid={isInvalid || undefined}
            onPointerEnter={(event) => {
                setIsHovered(true);
                controlProps.onPointerEnter?.(event);
            }}
            onPointerLeave={(event) => {
                setIsHovered(false);
                controlProps.onPointerLeave?.(event);
            }}
            onFocus={(event) => {
                setIsFocusVisible(event.currentTarget.matches(":focus-visible"));
                controlProps.onFocus?.(event);
            }}
            onBlur={(event) => {
                setIsFocusVisible(false);
                controlProps.onBlur?.(event);
            }}
            style={
                {
                    "--resize-handle-bg": getResizeHandleBg("#D5D7DA"),
                    "--resize-handle-bg-dark": getResizeHandleBg("#373A41"),
                } as React.CSSProperties
            }
            className={(state) =>
                cx(
                    "w-full scroll-py-3 rounded-lg bg-primary text-primary shadow-xs ring-1 ring-primary transition duration-100 ease-linear ring-inset placeholder:text-placeholder autofill:rounded-lg autofill:text-primary focus:outline-hidden",

                    size === "sm" && "p-3 text-sm",
                    size === "md" && "px-3.5 py-3 text-md",

                    // Resize handle
                    "[&::-webkit-resizer]:bg-(image:--resize-handle-bg) [&::-webkit-resizer]:bg-contain dark:[&::-webkit-resizer]:bg-(image:--resize-handle-bg-dark)",

                    state.focused && !state.disabled && "ring-2 ring-brand",
                    state.disabled && "cursor-not-allowed opacity-50",
                    (isInvalid ?? state.valid === false) && "ring-error_subtle",
                    (isInvalid ?? state.valid === false) && state.focused && "ring-2 ring-error",

                    typeof className === "function"
                        ? className({
                              isHovered,
                              isFocused: state.focused,
                              isFocusVisible,
                              isDisabled: state.disabled,
                              isInvalid: isInvalid ?? state.valid === false,
                          })
                        : className,
                )
            }
        />
    );
};

TextAreaBase.displayName = "TextAreaBase";

interface TextAreaProps extends TextFieldProps {
    /** Label text for the textarea */
    label?: string;
    /** Helper text displayed below the textarea */
    hint?: ReactNode;
    /** Tooltip message displayed after the label. */
    tooltip?: string;
    /** Textarea size. */
    size?: TextAreaBaseProps["size"];
    /** Class name for the textarea wrapper */
    textAreaClassName?: TextAreaBaseProps["className"];
    /** Ref for the textarea wrapper */
    ref?: Ref<HTMLDivElement>;
    /** Ref for the textarea */
    textAreaRef?: TextAreaBaseProps["ref"];
    /** Whether to hide required indicator from label. */
    hideRequiredIndicator?: boolean;
    /** Placeholder text. */
    placeholder?: string;
    /** Visible height of textarea in rows . */
    rows?: number;
    /** Visible width of textarea in columns. */
    cols?: number;
}

export const TextArea = ({
    label,
    hint,
    tooltip,
    textAreaRef,
    hideRequiredIndicator,
    textAreaClassName,
    placeholder,
    className,
    rows,
    cols,
    size = "md",
    ...props
}: TextAreaProps) => {
    return (
        <TextField {...props} className={className}>
            {({ isInvalid, isRequired, isDisabled, isReadOnly }) => (
                <>
                    {label && (
                        <Label isRequired={hideRequiredIndicator ? !hideRequiredIndicator : isRequired} tooltip={tooltip}>
                            {label}
                        </Label>
                    )}

                    <TextAreaBase
                        placeholder={placeholder}
                        className={textAreaClassName}
                        ref={textAreaRef}
                        rows={rows}
                        cols={cols}
                        size={size}
                        isDisabled={isDisabled}
                        isInvalid={isInvalid}
                        isRequired={isRequired}
                        isReadOnly={isReadOnly}
                    />

                    {hint && (
                        <HintText isInvalid={isInvalid} size={size}>
                            {hint}
                        </HintText>
                    )}
                </>
            )}
        </TextField>
    );
};

TextArea.displayName = "TextArea";
