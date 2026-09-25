/* Adopted from untitleduico/react@8b7409c078f8 — components/shared-assets/section-divider.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { HTMLAttributes } from "react";
import { cx } from "@/utils/cx";

export const SectionDivider = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div {...props} className={cx("mx-auto max-w-container px-4 md:px-8", props.className)}>
            <hr className="h-px w-full border-none bg-border-secondary" />
        </div>
    );
};
