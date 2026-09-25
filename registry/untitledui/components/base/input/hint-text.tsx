/* Adopted from untitleduico/react@8b7409c078f8 — components/base/input/hint-text.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { Field } from "@base-ui/react/field";
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { NOOP } from "@base-ui/react/internals/noop";
import { cx } from "@/utils/cx";

interface HintTextProps extends Omit<ComponentPropsWithoutRef<"span">, "className" | "children"> {
    /** Indicates that the hint text is an error message. */
    isInvalid?: boolean;
    ref?: Ref<HTMLElement>;
    size?: "sm" | "md";
    children: ReactNode;
    className?: string;
}

export const HintText = ({ isInvalid, className, size = "md", ref, ...props }: HintTextProps) => {
    const hintClassName = cx(
        "text-sm text-tertiary",

        // Size
        size === "sm" && "text-xs",
        "in-data-[input-size=sm]:text-xs",

        // Invalid state
        isInvalid && "text-error-primary",
        "group-data-invalid:text-error-primary",

        className,
    );

    // Inside a `Field.Root` the hint is the field's description: `Field.Description` publishes the id that
    // the control points at with `aria-describedby`, so the message stays programmatically associated.
    // It renders as a `<span>` so the hint keeps the element and layout it has always had. Outside a field
    // (native selects, pin inputs, ...) a plain `<span>` is all the hint has ever been. `NOOP` is Base UI's
    // own "no field above" sentinel (the default context's setter).
    const isFieldDescription = useFieldRootContext(true).setValidityData !== NOOP;

    // `Ref<HTMLElement>` is the payload's own element-agnostic ref type; the hint renders a `<span>`, so
    // the ref rides on the render element and stays typed against the element that actually receives it.
    if (isFieldDescription) {
        return <Field.Description render={<span ref={ref as Ref<HTMLSpanElement>} />} {...props} className={hintClassName} />;
    }

    return <span {...props} ref={ref as Ref<HTMLSpanElement>} className={hintClassName} />;
};

HintText.displayName = "HintText";
