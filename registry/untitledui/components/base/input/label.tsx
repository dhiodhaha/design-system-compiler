/* Adopted from untitleduico/react@8b7409c078f8 — components/base/input/label.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { HelpCircle } from "@untitledui/icons";
import { Field } from "@base-ui/react/field";
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { NOOP } from "@base-ui/react/internals/noop";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

interface LabelProps extends Omit<ComponentPropsWithoutRef<"label">, "className" | "children"> {
    children: ReactNode;
    isInvalid?: boolean;
    isRequired?: boolean;
    tooltip?: string;
    tooltipDescription?: string;
    className?: string;
    ref?: Ref<HTMLLabelElement>;
}

export const Label = ({ isInvalid, isRequired, tooltip, tooltipDescription, className, ...props }: LabelProps) => {
    // `Field.Label` reads the field it labels from `Field.Root` and renders outside one without an owner:
    // it is the part that hands the control its `aria-labelledby` (and the label its `htmlFor`). The
    // payload also renders `Label` on its own (native selects, pin inputs, ...), where a `<label>` keeps
    // the element, the `htmlFor`/`id` pass-through and the native label behaviour the call site already
    // relies on. `NOOP` is Base UI's own "no field above" sentinel (the default context's setter).
    const isFieldLabel = useFieldRootContext(true).setValidityData !== NOOP;

    const content = (
        <>
            {props.children}

            <span
                className={cx(
                    "hidden text-brand-tertiary",
                    isRequired && "block",
                    typeof isRequired === "undefined" && "group-has-required:block",

                    isInvalid && "text-error-primary",
                    typeof isInvalid === "undefined" && "group-data-invalid:text-error-primary",
                )}
            >
                *
            </span>

            {tooltip && (
                <Tooltip title={tooltip} description={tooltipDescription} placement="top">
                    <TooltipTrigger
                        // `TooltipTrigger` inherits the disabled state from the parent form field
                        // but we don't that. We want the tooltip be enabled even if the parent
                        // field is disabled.
                        isDisabled={false}
                        className="cursor-pointer text-fg-quaternary transition duration-200 hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover"
                    >
                        <HelpCircle className="size-4" />
                    </TooltipTrigger>
                </Tooltip>
            )}
        </>
    );

    const labelClassName = cx("flex cursor-default items-center gap-0.5 text-sm font-medium text-secondary", className);

    // `data-label="true"` is load-bearing: it drives the conditional hiding/showing of the label element
    // via CSS, either with the `label` custom variant or a `data-label` ancestor selector:
    // <Input label="Visible only on mobile" className="lg:**:data-label:hidden" />
    // or
    // <Input label="Visible only on mobile" className="lg:label:hidden" />
    if (isFieldLabel) {
        return (
            <Field.Label data-label="true" {...props} className={labelClassName}>
                {content}
            </Field.Label>
        );
    }

    return (
        <label data-label="true" {...props} className={labelClassName}>
            {content}
        </label>
    );
};

Label.displayName = "Label";
