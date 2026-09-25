/* Adopted from untitleduico/react@8b7409c078f8 — components/application/app-navigation/base-components/nav-account-card.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `DialogTrigger`/`Popover`/`Dialog` and its
 * `useFocusManager` are replaced by `@base-ui/react@1.8.0` Popover (`Root > Trigger > Portal > Positioner > Popup`,
 * anchored to the card as React Aria's `triggerRef` was) with the account menu's own dialog element inside the
 * popup. Every export, prop name and default is unchanged; the unit record is
 * .design-compiler/base-ui-migration/units/overlay-family.json. */
"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import type { FC, HTMLAttributes } from "react";
import { useEffect, useRef } from "react";
import { BookOpen01, ChevronSelectorVertical, LogOut01, Plus, Settings01, User01 } from "@untitledui/icons";
import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { Button } from "@/components/base/buttons/button";
import { RadioButtonBase } from "@/components/base/radio-buttons/radio-buttons";
import type { TooltipPlacement } from "@/components/base/tooltip/tooltip";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/utils/cx";

export type NavAccountType = {
    /** Unique identifier for the nav item. */
    id: string;
    /** Name of the account holder. */
    name: string;
    /** Email address of the account holder. */
    email: string;
    /** Avatar image URL. */
    avatar: string;
    /** Online status of the account holder. This is used to display the online status indicator. */
    status: "online" | "offline";
};

const placeholderAccounts: NavAccountType[] = [
    {
        id: "caitlyn",
        name: "Caitlyn King",
        email: "caitlyn@untitledui.com",
        avatar: "https://www.untitledui.com/images/avatars/caitlyn-king?fm=webp&q=80",
        status: "online",
    },
    {
        id: "sienna",
        name: "Sienna Hewitt",
        email: "sienna@untitledui.com",
        avatar: "https://www.untitledui.com/images/avatars/transparent/sienna-hewitt?bg=%23E0E0E0",
        status: "online",
    },
];

/** React Aria's placement vocabulary (as the payload's `Tooltip` re-exposes it) → Base UI's `side`/`align` pair. */
const PLACEMENT_SIDES: Record<string, "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end"> = {
    top: "top",
    bottom: "bottom",
    left: "left",
    right: "right",
    start: "inline-start",
    end: "inline-end",
};

/** React Aria's alignment tokens → Base UI alignments (`top`/`left` are the alignment axis' start). */
const PLACEMENT_ALIGNMENTS: Record<string, "start" | "center" | "end"> = {
    top: "start",
    left: "start",
    start: "start",
    bottom: "end",
    right: "end",
    end: "end",
    center: "center",
};

/** The tabbable descendants of the menu, in DOM order — the sequence React Aria's `useFocusManager` walked. */
const TABBABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusMenuItem = (container: HTMLElement, direction: 1 | -1) => {
    const tabbables = [...container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)].filter(
        // A `tabindex="-1"` element is not part of the sequence, and a hidden one cannot take focus.
        (element) => element.tabIndex >= 0 && element.getClientRects().length > 0,
    );

    if (tabbables.length === 0) {
        return;
    }

    const currentIndex = tabbables.indexOf(document.activeElement as HTMLElement);
    // React Aria wrapped in both directions; from the dialog itself the sequence starts at the nearest end.
    const nextIndex =
        currentIndex === -1
            ? direction === 1
                ? 0
                : tabbables.length - 1
            : (currentIndex + direction + tabbables.length) % tabbables.length;

    tabbables[nextIndex]?.focus();
};

/** Props for the account menu: the dialog element's attributes plus the account list it renders. */
interface NavAccountMenuProps extends Omit<HTMLAttributes<HTMLElement>, "className"> {
    /** The accessibility role for the dialog. */
    role?: "dialog" | "alertdialog";
    /** Additional CSS classes to apply to the dialog. */
    className?: string;
    /** Accounts to display in the switcher. */
    accounts?: NavAccountType[];
    /** The account that is currently selected. */
    selectedAccountId?: string;
}

export const NavAccountMenu = ({ className, role = "dialog", selectedAccountId = "olivia", ...dialogProps }: NavAccountMenuProps) => {
    const dialogRef = useRef<HTMLElement>(null);

    // React Aria's `useFocusManager().focusNext/focusPrevious({ tabbable: true, wrap: true })` on the dialog element.
    useEffect(() => {
        const element = dialogRef.current;
        if (!element) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "ArrowDown") {
                focusMenuItem(element, 1);
            } else if (event.key === "ArrowUp") {
                focusMenuItem(element, -1);
            }
        };

        element.addEventListener("keydown", onKeyDown);

        return () => element.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <section
            {...dialogProps}
            ref={dialogRef}
            role={role}
            className={cx("w-66 rounded-xl bg-secondary_alt shadow-lg ring ring-secondary_alt outline-hidden", className)}
        >
            <div className="rounded-xl bg-primary ring-1 ring-secondary">
                <div className="flex flex-col gap-0.5 py-1.5">
                    <NavAccountCardMenuItem label="View profile" icon={User01} shortcut="⌘K->P" />
                    <NavAccountCardMenuItem label="Account settings" icon={Settings01} shortcut="⌘S" />
                    <NavAccountCardMenuItem label="Documentation" icon={BookOpen01} />
                </div>
                <div className="flex flex-col gap-0.5 border-t border-secondary py-1.5">
                    <div className="px-3 pt-1.5 pb-1 text-xs font-semibold text-tertiary">Switch account</div>

                    <div className="flex flex-col gap-0.5 px-1.5">
                        {placeholderAccounts.map((account) => (
                            <button
                                key={account.id}
                                className={cx(
                                    "relative w-full cursor-pointer rounded-md px-2 py-1.5 text-left outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover focus:z-10 focus-visible:outline-2 focus-visible:outline-offset-2",
                                    account.id === selectedAccountId && "bg-primary_hover",
                                )}
                            >
                                <AvatarLabelGroup status="online" size="md" src={account.avatar} title={account.name} subtitle={account.email} />

                                <RadioButtonBase isSelected={account.id === selectedAccountId} className="absolute top-2 right-2" />
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-2 px-2 pt-0.5 pb-2">
                    <Button iconLeading={Plus} color="secondary" size="sm">
                        Add account
                    </Button>
                </div>
            </div>

            <div className="pt-1 pb-1.5">
                <NavAccountCardMenuItem label="Sign out" icon={LogOut01} shortcut="⌥⇧Q" />
            </div>
        </section>
    );
};

const NavAccountCardMenuItem = ({
    icon: Icon,
    label,
    shortcut,
    ...buttonProps
}: {
    icon?: FC<{ className?: string }>;
    label: string;
    shortcut?: string;
} & HTMLAttributes<HTMLButtonElement>) => {
    return (
        <button {...buttonProps} className={cx("group/item w-full cursor-pointer px-1.5 focus:outline-hidden", buttonProps.className)}>
            <div
                className={cx(
                    "flex w-full items-center justify-between gap-3 rounded-md p-2 group-hover/item:bg-primary_hover",
                    // Focus styles.
                    "outline-focus-ring group-focus-visible/item:outline-2 group-focus-visible/item:outline-offset-2",
                )}
            >
                <div className="flex gap-2 text-sm font-semibold text-secondary group-hover/item:text-secondary_hover">
                    {Icon && <Icon className="size-5 text-fg-quaternary group-hover/item:text-fg-quaternary_hover" />} {label}
                </div>

                {shortcut && (
                    <kbd className="flex rounded px-1 py-px font-body text-xs font-medium text-tertiary ring-1 ring-secondary ring-inset">{shortcut}</kbd>
                )}
            </div>
        </button>
    );
};

export const NavAccountCard = ({
    popoverPlacement,
    selectedAccountId = "caitlyn",
    items = placeholderAccounts,
    avatarRounded,
}: {
    popoverPlacement?: TooltipPlacement;
    selectedAccountId?: string;
    items?: NavAccountType[];
    avatarRounded?: boolean;
}) => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const isDesktop = useBreakpoint("lg");

    const selectedAccount = items.find((account) => account.id === selectedAccountId);

    if (!selectedAccount) {
        console.warn(`Account with ID ${selectedAccountId} not found in <NavAccountCard />`);
        return null;
    }

    const [sideToken, alignToken] = (popoverPlacement ?? (isDesktop ? "right bottom" : "top right")).split(/\s+/);
    const side = PLACEMENT_SIDES[sideToken] ?? "bottom";
    const align = alignToken ? (PLACEMENT_ALIGNMENTS[alignToken] ?? "center") : "center";

    return (
        <div ref={triggerRef} className="relative flex items-center gap-3 rounded-xl p-3 ring-1 ring-secondary ring-inset">
            <AvatarLabelGroup
                size="md"
                src={selectedAccount.avatar}
                title={selectedAccount.name}
                subtitle={selectedAccount.email}
                status={selectedAccount.status}
                rounded={avatarRounded}
            />

            <BasePopover.Root>
                <BasePopover.Trigger className="absolute top-2 right-2 flex cursor-pointer items-center justify-center rounded-md p-1.5 text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 active:bg-primary_hover active:text-fg-quaternary_hover">
                    <ChevronSelectorVertical className="size-4 shrink-0 stroke-[2.25px]" />
                </BasePopover.Trigger>

                <BasePopover.Portal>
                    {/* React Aria anchored this popover to the whole card rather than to the trigger button. */}
                    <BasePopover.Positioner side={side} align={align} sideOffset={8} anchor={triggerRef}>
                        <BasePopover.Popup
                            // The account menu renders the dialog element itself; the popup container keeps no role.
                            role={undefined}
                            className={cx(
                                "origin-(--transform-origin) will-change-transform",
                                "data-open:duration-150 data-open:ease-out data-open:animate-in data-open:fade-in",
                                "data-ending-style:duration-100 data-ending-style:ease-in data-ending-style:animate-out data-ending-style:fade-out",
                                "data-[side=right]:data-open:slide-in-from-left-0.5 data-[side=top]:data-open:slide-in-from-bottom-0.5 data-[side=bottom]:data-open:slide-in-from-top-0.5",
                                "data-[side=right]:data-ending-style:slide-out-to-left-0.5 data-[side=top]:data-ending-style:slide-out-to-bottom-0.5 data-[side=bottom]:data-ending-style:slide-out-to-top-0.5",
                            )}
                        >
                            <NavAccountMenu selectedAccountId={selectedAccountId} accounts={items} />
                        </BasePopover.Popup>
                    </BasePopover.Positioner>
                </BasePopover.Portal>
            </BasePopover.Root>
        </div>
    );
};
