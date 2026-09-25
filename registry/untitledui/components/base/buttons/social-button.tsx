/* Adopted from untitleduico/react@8b7409c078f8 — components/base/buttons/social-button.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import { useRender } from "@base-ui/react/use-render";
import { cx, sortCx } from "@/utils/cx";
import { AppleLogo, DribbleLogo, FacebookLogo, FigmaLogo, FigmaLogoOutlined, GoogleLogo, TwitterLogo } from "./social-logos";
import type { PressEvents } from "./button";
import { usePressEvents } from "./button";

export const styles = sortCx({
    common: {
        root: "group disabled:stroke-fg-disabled disabled:text-fg-disabled disabled:*:text-fg-disabled disabled:cursor-not-allowed data-disabled:stroke-fg-disabled data-disabled:text-fg-disabled data-disabled:*:text-fg-disabled data-disabled:cursor-not-allowed relative inline-flex h-max cursor-pointer items-center justify-center font-semibold whitespace-nowrap outline-focus-ring transition duration-100 ease-linear before:absolute focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
        icon: "pointer-events-none shrink-0 transition-inherit-all",
    },

    sizes: {
        md: {
            root: "gap-2 rounded-lg px-3.5 py-2.5 text-sm before:rounded-[7px] data-icon-only:p-3",
            icon: "size-4",
        },
        lg: {
            root: "gap-2.5 rounded-lg px-4 py-2.5 text-md before:rounded-[7px] data-icon-only:p-3",
            icon: "size-5",
        },
    },

    colors: {
        gray: {
            root: "bg-primary text-secondary shadow-xs-skeuomorphic ring-1 ring-primary ring-inset hover:bg-primary_hover hover:text-secondary_hover",
            icon: "text-fg-quaternary group-hover:text-fg-quaternary_hover",
        },
        black: {
            root: "bg-black text-white shadow-xs-skeuomorphic ring-1 ring-transparent ring-inset before:absolute before:inset-px before:border before:border-white/12 before:mask-b-from-0%",
            icon: "",
        },

        facebook: {
            root: "bg-[#1877F2] text-white shadow-xs-skeuomorphic ring-1 ring-transparent ring-inset before:absolute before:inset-px before:border before:border-white/12 before:mask-b-from-0% hover:bg-[#0C63D4]",
            icon: "",
        },

        dribble: {
            root: "bg-[#EA4C89] text-white shadow-xs-skeuomorphic ring-1 ring-transparent ring-inset before:absolute before:inset-px before:border before:border-white/12 before:mask-b-from-0% hover:bg-[#E62872]",
            icon: "",
        },
    },
});

interface CommonProps {
    social: "google" | "facebook" | "apple" | "twitter" | "figma" | "dribble";
    /** Disables the button and shows a disabled state */
    isDisabled?: boolean;
    /**
     * Disables the button and shows a disabled state.
     * @deprecated Use `isDisabled` instead, for consistency with `Button`.
     */
    disabled?: boolean;
    theme?: "brand" | "color" | "gray";
    size?: keyof typeof styles.sizes;

    children?: ReactNode;
    className?: string;
}

/** The component state, mapped onto the `data-*` attributes consumer CSS keys off. */
interface SocialButtonState {
    /** Whether the button is disabled. (`data-disabled`) */
    isDisabled: boolean;
    /** Whether the button renders a logo without text. (`data-icon-only`) */
    iconOnly: boolean;
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
    render?: useRender.RenderProp<SocialButtonState>;
}

interface ButtonProps extends CommonProps, Omit<ComponentPropsWithRef<"button">, "children" | "className" | "color" | "disabled" | "slot">, ElementProps {}

interface LinkProps extends CommonProps, Omit<ComponentPropsWithRef<"a">, "children" | "className" | "color" | "href" | "slot">, ElementProps {
    /** The link target. Required as a key to select the link variant, but may be `undefined` (e.g. a disabled nav button). */
    href: string | undefined;
}

export type SocialButtonProps = ButtonProps | LinkProps;

export const SocialButton: {
    (props: LinkProps): ReactElement<LinkProps>;
    (props: ButtonProps): ReactElement<ButtonProps>;
} = ({ size = "lg", theme = "brand", social, className, children, isDisabled, disabled, ...props }) => {
    // `disabled` is the deprecated alias of `isDisabled`.
    const isButtonDisabled = isDisabled ?? disabled;

    const isIconOnly = !children;

    const socialToColor = {
        google: "gray",
        facebook: "facebook",
        apple: "black",
        twitter: "black",
        figma: "black",
        dribble: "dribble",
    } as const;

    const colorStyles = theme === "brand" ? styles.colors[socialToColor[social]] : styles.colors.gray;

    const logos = {
        google: GoogleLogo,
        facebook: FacebookLogo,
        apple: AppleLogo,
        twitter: TwitterLogo,
        figma: theme === "gray" ? FigmaLogoOutlined : FigmaLogo,
        dribble: DribbleLogo,
    };

    const Logo = logos[social];

    const commonChildren = (
        <>
            <Logo
                className={cx(
                    styles.common.icon,
                    styles.sizes[size].icon,
                    theme === "gray"
                        ? colorStyles.icon
                        : theme === "brand" && (social === "facebook" || social === "apple" || social === "twitter")
                          ? "text-white"
                          : theme === "color" && (social === "apple" || social === "twitter")
                            ? "text-alpha-black"
                            : "",
                )}
                colorful={
                    (theme === "brand" && (social === "google" || social === "figma")) ||
                    (theme === "color" && (social === "google" || social === "facebook" || social === "figma" || social === "dribble")) ||
                    undefined
                }
            />

            {children}
        </>
    );

    // An `href` key selects the link variant; a link that cannot be followed (no target, or
    // disabled) renders a real `<button>` respectively a non-interactive `span[role=link]`.
    const isLinkVariant = "href" in props;
    const linkHref = isLinkVariant ? props.href : undefined;

    const { ref, render, ...rest } = props;

    const tagName = !isLinkVariant || !linkHref ? "button" : isButtonDisabled ? "span" : "a";

    // React Aria's press props are consumed here and the consumer's own pointer/keyboard handlers are
    // chained behind the press logic.
    const elementProps = usePressEvents({ ...rest, isDisabled: isButtonDisabled });

    return useRender({
        defaultTagName: tagName,
        render,
        state: { isDisabled: Boolean(isButtonDisabled), iconOnly: isIconOnly },
        stateAttributesMapping: {
            isDisabled: (value) => (value ? { "data-disabled": "" } : null),
            iconOnly: (value) => (value ? { "data-icon-only": "" } : null),
        },
        props: {
            ...elementProps,
            // The ref of the element actually rendered (button, anchor or fallback span).
            ref,
            ...(tagName === "button"
                ? { type: elementProps.type ?? "button", disabled: isButtonDisabled }
                : tagName === "a"
                  ? { href: linkHref }
                  : { href: undefined, role: "link", "aria-disabled": true }),
            className: cx(styles.common.root, styles.sizes[size].root, colorStyles.root, className),
            children: commonChildren,
        },
    }) as ReactElement<any>;
};
