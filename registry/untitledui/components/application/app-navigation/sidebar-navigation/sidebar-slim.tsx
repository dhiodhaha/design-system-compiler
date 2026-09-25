/* Adopted from untitleduico/react@8b7409c078f8 — components/application/app-navigation/sidebar-navigation/sidebar-slim.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { FC } from "react";
import { useState } from "react";
import { DotsVertical, LifeBuoy01, Settings01 } from "@untitledui/icons";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { AnimatePresence, motion } from "motion/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { UntitledLogoMinimal } from "@/components/foundations/logo/untitledui-logo-minimal";
import { cx } from "@/utils/cx";
import { MobileNavigationHeader } from "../base-components/mobile-header";
import { NavAccountCard, NavAccountMenu } from "../base-components/nav-account-card";
import { NavButton } from "../base-components/nav-button";
import { NavItemBase } from "../base-components/nav-item";
import { NavList } from "../base-components/nav-list";
import type { NavItemType } from "../config";

interface SidebarNavigationSlimProps {
    /** URL of the currently active item. */
    activeUrl?: string;
    /** List of items to display. */
    items: (NavItemType & { icon: FC<{ className?: string }> })[];
    /** List of footer items to display. */
    footerItems?: (NavItemType & { icon: FC<{ className?: string }> })[];
    /** Whether to hide the border. */
    hideBorder?: boolean;
    /** Whether to hide the right side border. */
    hideRightBorder?: boolean;
}

export const SidebarNavigationSlim = ({ activeUrl, items, footerItems = [], hideBorder, hideRightBorder }: SidebarNavigationSlimProps) => {
    const activeItem = [...items, ...footerItems].find((item) => item.href === activeUrl || item.items?.some((subItem) => subItem.href === activeUrl));
    const [currentItem, setCurrentItem] = useState(activeItem ?? items[1] ?? items[0]);
    const [isHovering, setIsHovering] = useState(false);

    const isSecondarySidebarVisible = isHovering && Boolean(currentItem?.items?.length);

    const MAIN_SIDEBAR_WIDTH = 68;
    const SECONDARY_SIDEBAR_WIDTH = 256;

    const mainSidebar = (
        <aside
            style={{
                width: MAIN_SIDEBAR_WIDTH,
            }}
            className={cx(
                "group flex h-full max-h-full max-w-full overflow-y-auto py-1 pl-1 transition duration-100 ease-linear",
                isSecondarySidebarVisible && "bg-primary",
            )}
        >
            <div
                className={cx(
                    "flex w-auto flex-col justify-between rounded-xl bg-primary pt-5 ring-1 ring-secondary transition duration-300 ring-inset",
                    hideBorder && !isSecondarySidebarVisible && "ring-transparent",
                )}
            >
                <div className="flex justify-center px-3">
                    <UntitledLogoMinimal className="size-6" />
                </div>

                <ul className="mt-5 flex flex-col gap-0.5 px-3.5">
                    {items.map((item) => (
                        <li key={item.label}>
                            <NavButton
                                current={currentItem?.href === item.href}
                                href={item.href}
                                label={item.label || ""}
                                icon={item.icon}
                                onClick={() => setCurrentItem(item)}
                            />
                        </li>
                    ))}
                </ul>
                <div className="mt-auto flex flex-col items-center gap-3 px-3 py-4">
                    {footerItems.length > 0 && (
                        <ul className="flex flex-col gap-0.5">
                            {footerItems.map((item) => (
                                <li key={item.label}>
                                    <NavButton
                                        current={currentItem?.href === item.href}
                                        label={item.label || ""}
                                        href={item.href}
                                        icon={item.icon}
                                        onClick={() => setCurrentItem(item)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}

                    <BasePopover.Root>
                        <BasePopover.Trigger className="group relative inline-flex rounded-full focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring active:outline-2 active:outline-offset-2 active:outline-focus-ring">
                            <Avatar
                                border
                                status="online"
                                src="https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80"
                                size="md"
                                alt="Olivia Rhye"
                            />
                        </BasePopover.Trigger>
                        <BasePopover.Portal>
                            <BasePopover.Positioner side="right" align="end" sideOffset={8} alignOffset={6}>
                                <BasePopover.Popup
                                    // The account menu renders the dialog element itself; the popup container keeps no role.
                                    role={undefined}
                                    className={cx(
                                        "will-change-transform",
                                        // Animations: Base UI animates in while the popup is open and out while it carries `data-ending-style`.
                                        "data-open:duration-300 data-open:ease-out data-open:animate-in data-open:fade-in",
                                        "data-ending-style:duration-150 data-ending-style:ease-in data-ending-style:animate-out data-ending-style:fade-out",
                                        "data-[side=right]:data-open:slide-in-from-left-2 data-[side=top]:data-open:slide-in-from-bottom-2 data-[side=bottom]:data-open:slide-in-from-top-2",
                                        "data-[side=right]:data-ending-style:slide-out-to-left-2 data-[side=top]:data-ending-style:slide-out-to-bottom-2 data-[side=bottom]:data-ending-style:slide-out-to-top-2",
                                    )}
                                >
                                    <NavAccountMenu />
                                </BasePopover.Popup>
                            </BasePopover.Positioner>
                        </BasePopover.Portal>
                    </BasePopover.Root>
                </div>
            </div>
        </aside>
    );

    const secondarySidebar = currentItem && (
        <AnimatePresence initial={false}>
            {isSecondarySidebarVisible && (
                <motion.div
                    initial={{ width: 0, borderColor: "var(--color-border-secondary)" }}
                    animate={{ width: SECONDARY_SIDEBAR_WIDTH, borderColor: "var(--color-border-secondary)" }}
                    exit={{ width: 0, borderColor: "rgba(0,0,0,0)", transition: { borderColor: { type: "tween", delay: 0.05 } } }}
                    transition={{ type: "spring", damping: 26, stiffness: 220, bounce: 0 }}
                    className={cx(
                        "relative h-full overflow-x-hidden overflow-y-auto bg-primary",
                        !(hideBorder || hideRightBorder) && "box-content border-r-[1.5px]",
                    )}
                >
                    <div style={{ width: SECONDARY_SIDEBAR_WIDTH }} className="flex h-full flex-col px-4 pt-6">
                        <h3 className="text-sm font-semibold text-brand-secondary">{currentItem.label}</h3>
                        <ul className="py-2">
                            {currentItem.items?.map((item) => (
                                <li key={item.label} className="py-px">
                                    <NavItemBase current={activeUrl === item.href} href={item.href} icon={item.icon} badge={item.badge} type="link">
                                        {item.label}
                                    </NavItemBase>
                                </li>
                            ))}
                        </ul>
                        <div className="sticky bottom-0 mt-auto flex justify-between bg-primary pb-5">
                            <div>
                                <p className="text-sm font-semibold text-primary">Olivia Rhye</p>
                                <p className="text-sm text-tertiary">olivia@untitledui.com</p>
                            </div>
                            <div className="absolute -top-1 right-0">
                                <ButtonUtility size="xs" color="tertiary" tooltip="Log out" icon={DotsVertical} />
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            {/* Desktop sidebar navigation */}
            <div
                className="z-50 hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex"
                onPointerEnter={() => setIsHovering(true)}
                onPointerLeave={() => setIsHovering(false)}
            >
                {mainSidebar}
                {secondarySidebar}
            </div>

            {/* Placeholder to take up physical space because the real sidebar has `fixed` position. */}
            <div
                style={{
                    paddingLeft: MAIN_SIDEBAR_WIDTH,
                }}
                className="invisible hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"
            />

            {/* Mobile header navigation */}
            <MobileNavigationHeader>
                <aside className="group flex h-full max-h-full w-full max-w-full flex-col justify-between overflow-y-auto bg-primary pt-4">
                    <div className="px-4">
                        <UntitledLogo className="h-6" />
                    </div>

                    <NavList items={items} />

                    <div className="mt-auto flex flex-col gap-3 p-4">
                        <div className="flex flex-col">
                            <NavItemBase current={activeUrl === "/support"} type="link" href="/support" icon={LifeBuoy01}>
                                Support
                            </NavItemBase>
                            <NavItemBase current={activeUrl === "/settings"} type="link" href="/settings" icon={Settings01}>
                                Settings
                            </NavItemBase>
                        </div>

                        <NavAccountCard />
                    </div>
                </aside>
            </MobileNavigationHeader>
        </>
    );
};
