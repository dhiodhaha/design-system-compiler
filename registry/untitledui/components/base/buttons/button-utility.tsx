/* Adopted from untitleduico/react@8b7409c078f8 — components/base/buttons/button-utility.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { ComponentPropsWithRef, FC, ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { useRender } from "@base-ui/react/use-render";
import type { TooltipPlacement } from "@/components/base/tooltip/tooltip";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";
import type { PressEvents } from "./button";
import { usePressEvents } from "./button";

export const styles = {
    secondary:
        "bg-primary text-fg-quaternary shadow-xs-skeuomorphic ring-1 ring-primary ring-inset hover:bg-primary_hover hover:text-fg-quaternary_hover disabled:shadow-xs data-disabled:shadow-xs",
    tertiary: "text-fg-quaternary hover:bg-primary_hover hover:text-fg-quaternary_hover",
};

/**
 * Common props shared between button and anchor variants
 */
export interface CommonProps {
    /** Disables the button and shows a disabled state */
    isDisabled?: boolean;
    /** The size variant of the button */
    size?: "xs" | "sm";
    /** The color variant of the button */
    color?: "secondary" | "tertiary";
    /** The icon to display in the button */
    icon?: FC<{ className?: string }> | ReactNode;
    /** The tooltip to display when hovering over the button */
    tooltip?: string;
    /** The placement of the tooltip */
    tooltipPlacement?: TooltipPlacement;

    className?: string;
}

/** Props both variants spread onto the element they render. */
interface ElementProps extends PressEvents {
    /** The React Aria slot the rendered element fills. Renders no attribute when `null`. */
    slot?: string | null;
    /**
     * Allows you to replace the component's HTML element with a different tag, or
     * compose it with another component — the same contract as the React Aria
     * `render` prop. Accepts a `ReactElement` or a function returning one.
     */
    render?: useRender.RenderProp;
}

/**
 * Props for the button variant (non-link)
 */
export interface ButtonProps extends CommonProps, Omit<ComponentPropsWithRef<"button">, "children" | "className" | "color" | "disabled" | "slot">, ElementProps {}

/**
 * Props for the link variant (anchor tag)
 */
interface LinkProps extends CommonProps, Omit<ComponentPropsWithRef<"a">, "children" | "className" | "color" | "href" | "slot">, ElementProps {
    /** The link target. Required as a key to select the link variant, but may be `undefined` (e.g. a disabled nav button). */
    href: string | undefined;
}

/** Union type of button and link props */
export type Props = ButtonProps | LinkProps;

export const ButtonUtility: {
    (props: LinkProps): ReactElement<LinkProps>;
    (props: ButtonProps): ReactElement<ButtonProps>;
} = ({ tooltip, className, isDisabled, icon: Icon, size = "sm", color = "secondary", tooltipPlacement = "top", ...props }) => {
    // An `href` key selects the link variant; the element it renders depends on whether the link
    // can actually be followed — a disabled link degrades to a non-interactive `span[role=link]`.
    const isLinkVariant = "href" in props;
    const linkHref = isLinkVariant ? props.href : undefined;

    const { ref, render, ...rest } = props;

    const tagName = !isLinkVariant || !linkHref ? "button" : isDisabled ? "span" : "a";

    // React Aria's press props are consumed here and the consumer's own pointer/keyboard handlers are
    // chained behind the press logic.
    const elementProps = usePressEvents({ ...rest, isDisabled });

    const content = useRender({
        defaultTagName: tagName,
        render,
        state: { isDisabled: Boolean(isDisabled) },
        stateAttributesMapping: { isDisabled: (value) => (value ? { "data-disabled": "" } : null) },
        props: {
            "aria-label": tooltip,
            ...elementProps,
            // The ref of the element actually rendered (button, anchor or fallback span).
            ref,
            ...(tagName === "button"
                ? { type: elementProps.type ?? "button", disabled: isDisabled }
                : tagName === "a"
                  ? { href: linkHref }
                  : { href: undefined, role: "link", "aria-disabled": true }),
            className: cx(
                "group relative inline-flex h-max cursor-pointer items-center justify-center rounded-md p-1.5 outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50",
                styles[color],

                // Icon styles
                "*:data-icon:pointer-events-none *:data-icon:shrink-0 *:data-icon:text-current *:data-icon:transition-inherit-all",
                size === "xs" ? "*:data-icon:size-4" : "*:data-icon:size-5",

                className,
            ),
            children: (
                <>
                    {isReactComponent(Icon) && <Icon data-icon />}
                    {isValidElement(Icon) && Icon}
                </>
            ),
        },
    }) as ReactElement<any>;

    if (tooltip) {
        return (
            <Tooltip title={tooltip} placement={tooltipPlacement} isDisabled={isDisabled} offset={size === "xs" ? 4 : 6}>
                {content}
            </Tooltip>
        );
    }

    return content;
};
