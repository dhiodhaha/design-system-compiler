/* Adopted from untitleduico/react@8b7409c078f8 — components/base/avatar/base-components/avatar-count.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import { cx } from "@/utils/cx";

interface AvatarCountProps {
    count: number;
    className?: string;
}

export const AvatarCount = ({ count, className }: AvatarCountProps) => (
    <div className={cx("absolute right-0 bottom-0 p-px", className)}>
        <div className="flex size-3.5 items-center justify-center rounded-full bg-fg-error-primary text-center text-[10px] leading-[13px] font-bold text-white">
            {count}
        </div>
    </div>
);
