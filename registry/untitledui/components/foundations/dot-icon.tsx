/* Adopted from untitleduico/react@8b7409c078f8 — components/foundations/dot-icon.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { HTMLAttributes } from "react";

const sizes = {
    sm: {
        wh: 8,
        c: 4,
        r: 2.5,
    },
    md: {
        wh: 10,
        c: 5,
        r: 4,
    },
};

export const Dot = ({ size = "md", ...props }: HTMLAttributes<HTMLOrSVGElement> & { size?: "sm" | "md" }) => {
    return (
        <svg width={sizes[size].wh} height={sizes[size].wh} viewBox={`0 0 ${sizes[size].wh} ${sizes[size].wh}`} fill="none" {...props}>
            <circle cx={sizes[size].c} cy={sizes[size].c} r={sizes[size].r} fill="currentColor" stroke="currentColor" />
        </svg>
    );
};
