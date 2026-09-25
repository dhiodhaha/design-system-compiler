/* Adopted from untitleduico/react@8b7409c078f8 — components/application/app-navigation/base-components/nav-item.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `Link` is replaced by a native anchor (or the
 * `span[role=link]` React Aria itself fell back to when the item had no usable target), rendered through Base UI's
 * `useRender` so the `render` prop keeps working. The press layer is the payload Button's, so `onPress` still
 * receives React Aria's press event. The unit record is
 * .design-compiler/base-ui-migration/units/overlay-family.json. */
"use client";

import { useRender } from "@base-ui/react/use-render";
import { ChevronDown, Share04 } from "@untitledui/icons";
import type { ComponentPropsWithRef, FC, HTMLAttributes, MouseEventHandler, ReactNode, Ref } from "react";
import { Badge } from "@/components/base/badges/badges";
import { type PressEvents, usePressEvents } from "@/components/base/buttons/button";
import { cx, sortCx } from "@/utils/cx";

const styles = sortCx({
    root: "group relative flex max-h-9 w-full cursor-pointer items-center rounded-md bg-primary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2",
    rootSelected: "bg-secondary hover:bg-secondary_hover",
});

/**
 * Props shared between the collapsible and link variants
 */
interface NavItemCommonProps {
    /** Icon component to display. */
    icon?: FC<HTMLAttributes<HTMLOrSVGElement>>;
    /** Badge to display. */
    badge?: ReactNode;
    /** Whether the nav item is currently active. */
    current?: boolean;
    /** Whether to truncate the label text. */
    truncate?: boolean;
    /** Handler for click events. */
    onClick?: MouseEventHandler;
    /** Content to display. */
    children?: ReactNode;
}

/**
 * Props for the collapsible variant (renders a `summary` element)
 */
export interface NavItemCollapsibleProps extends NavItemCommonProps {
    /** Type of the nav item. */
    type: "collapsible";
}

/**
 * Props for the link variants (anchor tag). Accepts the press props and link attributes the React Aria `Link`
 * accepted, including `isDisabled`, `onPress` and `render`.
 */
export interface NavItemLinkProps
    extends NavItemCommonProps,
        Omit<ComponentPropsWithRef<"a">, "children" | "className" | "href" | "onClick" | "ref">,
        PressEvents {
    /** Type of the nav item. */
    type: "link" | "collapsible-child";
    /** URL to navigate to when the nav item is clicked. */
    href?: string;
    /** Whether the nav item is disabled. */
    isDisabled?: boolean;
    /**
     * Allows you to replace the component's HTML element with a different tag, or compose it with another
     * component — the same contract as the React Aria `render` prop.
     */
    render?: useRender.RenderProp;
    ref?: Ref<HTMLAnchorElement>;
}

/** Union type of collapsible and link props */
export type NavItemBaseProps = NavItemCollapsibleProps | NavItemLinkProps;

/**
 * The link variants: an anchor while the item has a usable target, and the `span[role=link]` React Aria's `Link`
 * fell back to otherwise (disabled items included).
 */
const NavItemLink = ({
    type,
    href,
    isDisabled,
    current,
    onPress,
    onClick,
    className,
    render,
    ref,
    children,
    ...linkProps
}: NavItemLinkProps & { className?: string }) => {
    const isAnchor = Boolean(href) && !isDisabled;
    const isExternal = href?.startsWith("http");

    const elementProps = usePressEvents({ ...linkProps, isDisabled, onPress, onClick });

    return useRender({
        defaultTagName: isAnchor ? "a" : "span",
        render,
        ref,
        state: { isDisabled: Boolean(isDisabled), isCurrent: Boolean(current) },
        stateAttributesMapping: {
            isDisabled: (value) => (value ? { "data-disabled": "" } : null),
            isCurrent: (value) => (value ? { "data-current": "" } : null),
        },
        props: {
            // Defaults that consumers can override through the link props.
            target: isExternal ? "_blank" : "_self",
            rel: "noopener noreferrer",
            "aria-current": current ? "page" : undefined,
            ...elementProps,
            // Dropping `href` when disabled prevents navigation via middle-click or "open in new tab".
            href: isDisabled ? undefined : href,
            "aria-disabled": isDisabled || undefined,
            // A `span` has no native link semantics, so it carries them explicitly, as React Aria's link did.
            ...(isAnchor ? {} : { role: "link", tabIndex: elementProps.tabIndex ?? (isDisabled ? undefined : 0) }),
            className: cx(
                type === "collapsible-child" ? "py-2 pr-3 pl-10" : "group/item p-2",
                styles.root,
                current && styles.rootSelected,
                "aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
            ),
            children,
        },
    });
};

export const NavItemBase = (props: NavItemBaseProps) => {
    const { icon: Icon, badge, current, truncate = true, onClick, children, ...rest } = props;

    const iconElement = Icon && (
        <Icon
            aria-hidden="true"
            className={cx(
                "mr-2 size-5 shrink-0 text-fg-quaternary transition-inherit-all group-hover/item:text-fg-quaternary_hover",
                current && "text-fg-quaternary_hover",
            )}
        />
    );

    const badgeElement =
        badge && (typeof badge === "string" || typeof badge === "number") ? (
            <Badge className="ml-3" color="gray" type="pill-color" size="sm">
                {badge}
            </Badge>
        ) : (
            badge
        );

    const labelElement = (
        <span
            className={cx(
                "flex-1 text-sm font-semibold text-secondary transition-inherit-all group-hover/item:text-secondary_hover",
                truncate && "truncate",
                current && "text-secondary_hover",
            )}
        >
            {children}
        </span>
    );

    if (rest.type === "collapsible") {
        return (
            <summary className={cx("p-2", styles.root, current && styles.rootSelected)} onClick={onClick}>
                {iconElement}

                {labelElement}

                {badgeElement}

                <ChevronDown aria-hidden="true" className="ml-3 size-4 shrink-0 stroke-[2.5px] text-fg-quaternary in-open:-scale-y-100" />
            </summary>
        );
    }

    const { type, href, isDisabled, ...linkProps } = rest;
    const isExternal = href?.startsWith("http");

    return (
        <NavItemLink {...linkProps} type={type} href={href} isDisabled={isDisabled} current={current} onClick={onClick}>
            {type === "link" && iconElement}
            {labelElement}
            {isExternal && <Share04 className="size-4 stroke-[2.5px] text-fg-quaternary" />}
            {badgeElement}
        </NavItemLink>
    );
};
