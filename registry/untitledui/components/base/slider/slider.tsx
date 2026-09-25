/* Adopted from untitleduico/react@8b7409c078f8 — components/base/slider/slider.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { CSSProperties, ReactNode, Ref } from "react";
import { useMemo, useState } from "react";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { cx, sortCx } from "@/utils/cx";

const styles = sortCx({
    default: "hidden",
    bottom: "absolute top-2 left-1/2 -translate-x-1/2 translate-y-full text-md font-medium text-primary",
    "top-floating":
        "absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-secondary shadow-lg ring-1 ring-secondary_alt",
});

// Format thumb values as percentages by default.
const defaultFormatOptions: Intl.NumberFormatOptions = {
    style: "percent",
    maximumFractionDigits: 0,
};

/** The slider's render state, passed to a function `className`/`style`. */
export interface SliderRenderProps {
    /** The orientation of the slider. */
    orientation: "horizontal" | "vertical";
    /** Whether the slider is disabled. */
    isDisabled: boolean;
}

export interface SliderProps extends Omit<React.ComponentPropsWithRef<"div">, "children" | "className" | "style" | "value" | "defaultValue" | "onChange" | "color"> {
    /** Where the value label is rendered. */
    labelPosition?: keyof typeof styles;
    /** Formats the value label. */
    labelFormatter?: (value: number) => string;
    /** The slider's label. */
    label?: ReactNode;
    /**
     * The slider's minimum value.
     * @default 0
     */
    minValue?: number;
    /**
     * The slider's maximum value.
     * @default 100
     */
    maxValue?: number;
    /**
     * The step amount.
     * @default 1
     */
    step?: number;
    /** The current value (controlled). An array renders one thumb per entry. */
    value?: number | number[];
    /** The default value (uncontrolled). An array renders one thumb per entry. */
    defaultValue?: number | number[];
    /** Handler that is called when the value changes. */
    onChange?: (value: number | number[]) => void;
    /** Handler that is called when the user stops interacting with the slider (React Aria's `onChangeEnd`). */
    onChangeEnd?: (value: number | number[]) => void;
    /** The value's number formatting. */
    formatOptions?: Intl.NumberFormatOptions;
    /** The locale used to format the value. */
    locale?: Intl.LocalesArgument;
    /**
     * The orientation of the slider.
     * @default "horizontal"
     */
    orientation?: "horizontal" | "vertical";
    /** Whether the slider is disabled. */
    isDisabled?: boolean;
    /** The name of the slider, submitted with the form data. */
    name?: string;
    /** The class name, or a function of the slider's state. */
    className?: string | ((state: SliderRenderProps) => string | undefined);
    /** The inline styles, or a function of the slider's state. */
    style?: CSSProperties | ((state: SliderRenderProps) => CSSProperties | undefined);
    /** The ref of the slider's root element. */
    ref?: Ref<HTMLDivElement>;
}

export const Slider = ({
    labelPosition = "default",
    minValue = 0,
    maxValue = 100,
    labelFormatter,
    formatOptions,
    label,
    value,
    defaultValue,
    onChange,
    onChangeEnd,
    step,
    orientation = "horizontal",
    isDisabled,
    name,
    locale,
    id,
    className,
    style,
    ref,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rest
}: SliderProps) => {
    const format = formatOptions ?? defaultFormatOptions;

    // The rendered value is mirrored here: Base UI owns the value, but the fill, the thumb count and the
    // value label are the payload's own markup and need the numbers during render (React Aria's slider
    // state used to hand them over).
    const [uncontrolledValue, setUncontrolledValue] = useState<number | number[]>(() => defaultValue ?? minValue);
    const isControlled = value !== undefined;
    const renderedValue = isControlled ? value : uncontrolledValue;
    const values = Array.isArray(renderedValue) ? renderedValue : [renderedValue];
    const isRange = Array.isArray(renderedValue);

    const formatter = useMemo(() => new Intl.NumberFormat(locale, format), [locale, format]);

    const toRenderedShape = (next: number | readonly number[]): number | number[] => {
        const nextValues = typeof next === "number" ? [next] : [...next];
        return isRange ? nextValues : nextValues[0];
    };

    const valueToPercent = (thumbValue: number) => ((thumbValue - minValue) / (maxValue - minValue)) * 100;
    const left = values.length === 1 ? 0 : valueToPercent(values[0]);
    const width = values.length === 1 ? valueToPercent(values[0]) : valueToPercent(values[1]) - left;

    return (
        <BaseSlider.Root
            {...rest}
            ref={ref}
            id={id}
            name={name}
            min={minValue}
            max={maxValue}
            step={step}
            value={isControlled ? value : undefined}
            defaultValue={isControlled ? undefined : defaultValue}
            disabled={isDisabled}
            orientation={orientation}
            format={format}
            locale={locale}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            onValueChange={(next) => {
                const nextValue = toRenderedShape(next);
                if (!isControlled) {
                    setUncontrolledValue(nextValue);
                }
                onChange?.(nextValue);
            }}
            onValueCommitted={(next) => onChangeEnd?.(toRenderedShape(next))}
            className={(state) => {
                const sliderState: SliderRenderProps = { orientation: state.orientation, isDisabled: !!state.disabled };
                return cx(typeof className === "function" ? className(sliderState) : className);
            }}
            style={typeof style === "function" ? (state) => style({ orientation: state.orientation, isDisabled: !!state.disabled }) : style}
        >
            {label != null && <BaseSlider.Label>{label}</BaseSlider.Label>}

            <BaseSlider.Control>
                <BaseSlider.Track className="relative h-6 w-full">
                    <span className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-quaternary" />
                    <span
                        className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-brand-solid"
                        style={{
                            left: `${left}%`,
                            width: `${width}%`,
                        }}
                    />
                    {values.map((thumbValue, index) => (
                        <BaseSlider.Thumb
                            key={index}
                            index={index}
                            className={cx(
                                "top-1/2 box-border size-6 cursor-grab rounded-full bg-slider-handle-bg shadow-md ring-2 ring-slider-handle-border ring-inset",
                                // Focus and drag are native/attribute states here: the focusable element is the
                                // nested range input and Base UI marks a dragging thumb with `data-dragging`.
                                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring",
                                "data-dragging:cursor-grabbing",
                                // The nested range input is the control a measurement sees; Base UI stretches it
                                // to the thumb, and it keeps the browser's intrinsic size (and no margin) here,
                                // which is the box React Aria's clipped input had.
                                "[&>input]:m-0! [&>input]:h-auto! [&>input]:w-auto!",
                            )}
                        >
                            <BaseSlider.Value className={cx("whitespace-nowrap", styles[labelPosition])}>
                                {() => (labelFormatter ? labelFormatter(thumbValue) : formatter.format(thumbValue / 100))}
                            </BaseSlider.Value>
                        </BaseSlider.Thumb>
                    ))}
                </BaseSlider.Track>
            </BaseSlider.Control>
        </BaseSlider.Root>
    );
};
