/* Adopted from untitleduico/react@8b7409c078f8 — components/base/form/form.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { ComponentPropsWithRef } from "react";
import { Form as AriaForm } from "react-aria-components";

export const Form = (props: ComponentPropsWithRef<typeof AriaForm>) => {
    return <AriaForm {...props} />;
};

Form.displayName = "Form";
