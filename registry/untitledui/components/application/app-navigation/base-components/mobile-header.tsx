/* Adopted from untitleduico/react@8b7409c078f8 — components/application/app-navigation/base-components/mobile-header.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `DialogTrigger`/`ModalOverlay`/`Modal`/`Dialog` are
 * replaced by `@base-ui/react@1.8.0` Dialog. React Aria attached the trigger to the pressable inside the header and
 * labelled the dialog with it; Base UI's `Dialog.Trigger` is that button directly and the labelling is explicit.
 * Every export, prop name and default is unchanged; the unit record is
 * .design-compiler/base-ui-migration/units/overlay-family.json. */
"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X as CloseIcon, Menu02 } from "@untitledui/icons";
import type { PropsWithChildren } from "react";
import { useId } from "react";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { cx } from "@/utils/cx";

export const MobileNavigationHeader = ({ children }: PropsWithChildren) => {
    // React Aria labelled the dialog with the element that opened it; Base UI has no such fallback, so the linkage
    // is made here (the trigger keeps its accessible name from `aria-label`).
    const triggerId = useId();

    return (
        <BaseDialog.Root>
            <header className="flex h-14 items-center justify-between border-b border-secondary bg-primary p-3 pl-4 lg:hidden">
                <UntitledLogo className="h-6" />

                <BaseDialog.Trigger
                    id={triggerId}
                    aria-label="Expand navigation menu"
                    className="group flex items-center justify-center rounded-lg bg-primary p-2 text-fg-secondary outline-focus-ring hover:bg-primary_hover hover:text-fg-secondary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <Menu02 className="size-6 transition duration-200 ease-in-out group-aria-expanded:opacity-0" />
                    <CloseIcon className="absolute size-6 opacity-0 transition duration-200 ease-in-out group-aria-expanded:opacity-100" />
                </BaseDialog.Trigger>
            </header>

            <BaseDialog.Portal>
                <BaseDialog.Backdrop
                    className={cx(
                        "fixed inset-0 z-50 cursor-pointer bg-overlay/70 pr-16 backdrop-blur-md lg:hidden",
                        // Animations: Base UI animates in while the popup is open and out while it carries `data-ending-style`.
                        "data-open:duration-300 data-open:ease-in-out data-open:animate-in data-open:fade-in",
                        "data-ending-style:duration-200 data-ending-style:ease-in-out data-ending-style:animate-out data-ending-style:fade-out",
                    )}
                >
                    <BaseDialog.Close
                        aria-label="Close navigation menu"
                        className="fixed top-2.5 right-3 flex cursor-pointer items-center justify-center rounded-lg p-2 text-fg-white/70 outline-focus-ring hover:bg-white/10 hover:text-fg-white focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <CloseIcon className="size-6" />
                    </BaseDialog.Close>

                    <BaseDialog.Popup role={undefined} className="w-full max-w-74 cursor-auto will-change-transform">
                        <div role="dialog" aria-labelledby={triggerId} className="h-dvh outline-hidden focus:outline-hidden">
                            {children}
                        </div>
                    </BaseDialog.Popup>
                </BaseDialog.Backdrop>
            </BaseDialog.Portal>
        </BaseDialog.Root>
    );
};
