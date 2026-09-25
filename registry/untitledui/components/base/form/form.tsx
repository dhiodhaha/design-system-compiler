/* Adopted from untitleduico/react@8b7409c078f8 — components/base/form/form.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { Ref } from "react";
import { Form as BaseForm } from "@base-ui/react/form";

/** Server or external validation errors, keyed by the name of the field they belong to. */
export type FormValidationErrors = Record<string, string | string[]>;

export interface FormProps extends Omit<BaseForm.Props<Record<string, any>>, "errors"> {
    /**
     * Validation errors returned externally, typically after submitting to a server or a form action.
     * Each key is the `name` of the field it belongs to.
     */
    errors?: FormValidationErrors;
    /** React Aria's name for `errors`; the same map, kept so existing call sites keep working. */
    validationErrors?: FormValidationErrors;
    /**
     * Whether to use native HTML form validation to prevent form submission when a field value is
     * missing or invalid, or mark fields as required or invalid via ARIA.
     *
     * Base UI fields always report validity through ARIA; `"native"` additionally leaves the
     * browser's own constraint validation in front of the submit, exactly as React Aria's default did.
     *
     * @default "native"
     */
    validationBehavior?: "aria" | "native";
    /** The ref of the `<form>` element. */
    ref?: Ref<HTMLFormElement>;
}

export const Form = ({ validationErrors, validationBehavior = "native", errors, ...props }: FormProps) => {
    return <BaseForm errors={errors ?? validationErrors} noValidate={validationBehavior !== "native"} {...props} />;
};

Form.displayName = "Form";
