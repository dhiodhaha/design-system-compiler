/* Adopted from untitleduico/react@8b7409c078f8 — utils/cx.ts
 * MIT licensed upstream source, adopted with the smallest necessary project-local
 * transformations. Local deltas, if any, are listed in .design-compiler/references/untitledui/adoption-*.json.
 * Do not hand-edit: re-run compiler/adopt/adopt.mjs to re-adopt. */
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            text: ["display-xs", "display-sm", "display-md", "display-lg", "display-xl", "display-2xl"],
        },
    },
});

/**
 * This function is a wrapper around the twMerge function.
 * It is used to merge the classes inside style objects.
 */
export const cx = twMerge;

/**
 * This function does nothing besides helping us to be able to
 * sort the classes inside style objects which is not supported
 * by the Tailwind IntelliSense by default.
 */
export function sortCx<T extends Record<string, string | number | Record<string, string | number | Record<string, string | number>>>>(classes: T): T {
    return classes;
}
