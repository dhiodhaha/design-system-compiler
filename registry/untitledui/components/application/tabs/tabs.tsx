/* Adopted from untitleduico/react@8b7409c078f8 — components/application/tabs/tabs.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { ComponentPropsWithRef, CSSProperties, FC, Key, ReactNode, Ref } from "react";
import { createContext, isValidElement, useContext, useMemo, useState } from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { useRender } from "@base-ui/react/use-render";
import { Badge } from "@/components/base/badges/badges";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";

type Orientation = "horizontal" | "vertical";

// Types for different orientations
type HorizontalTypes = "button-brand" | "button-gray" | "button-border" | "button-minimal" | "underline";
type VerticalTypes = "button-brand" | "button-gray" | "button-border" | "button-minimal" | "line";
type TabTypeColors<T> = T extends "horizontal" ? HorizontalTypes : VerticalTypes;

/** The state a tab renders with, passed to a function `className` and a function child. */
export type TabRenderState = {
    /** Whether the tab is currently hovered with a mouse. (`data-hovered`) */
    isHovered: boolean;
    /** Whether the tab is currently in a pressed state. (`data-pressed`) */
    isPressed: boolean;
    /** Whether the tab is the selected one. (`data-selected`) */
    isSelected: boolean;
    /** Whether the tab is currently focused. (`data-focused`) */
    isFocused: boolean;
    /** Whether the tab is currently keyboard focused. (`data-focus-visible`) */
    isFocusVisible: boolean;
    /** Whether the tab is disabled. (`data-disabled`) */
    isDisabled: boolean;
};

/** The state a tab list renders with, passed to a function `className`. */
export type TabListRenderState = {
    /** The orientation of the tab list. (`data-orientation`) */
    orientation: Orientation;
};

/** The state a tab panel renders with, passed to a function `className`. */
export type TabPanelRenderState = {
    /** Whether the panel is currently focused. (`data-focused`) */
    isFocused: boolean;
    /** Whether the panel is currently keyboard focused. (`data-focus-visible`) */
    isFocusVisible: boolean;
    /** Whether the panel's content is inert (the panel is not the selected one). (`data-inert`) */
    isInert: boolean;
    /** Whether the panel is entering, as it is animated in. (`data-entering`) */
    isEntering: boolean;
    /** Whether the panel is exiting, as it is animated out. (`data-exiting`) */
    isExiting: boolean;
};

// Styles for different types of tab
const getTabStyles = ({ isFocusVisible, isSelected, isHovered }: TabRenderState) => ({
    "button-brand": cx(
        "outline-focus-ring *:data-icon:text-fg-quaternary",
        isFocusVisible && "outline-2 -outline-offset-2",
        (isSelected || isHovered) && "bg-brand-primary_alt text-brand-secondary *:data-icon:text-fg-brand-secondary_hover",
    ),
    "button-gray": cx(
        "outline-focus-ring *:data-icon:text-fg-quaternary",
        isHovered && "bg-primary_hover text-secondary *:data-icon:text-fg-secondary_hover",
        isFocusVisible && "outline-2 -outline-offset-2",
        isSelected && "bg-primary_hover text-secondary *:data-icon:text-fg-secondary_hover",
    ),
    "button-border": cx(
        "outline-focus-ring *:data-icon:text-fg-quaternary",
        isFocusVisible && "outline-2 -outline-offset-2",
        (isSelected || isHovered) && "bg-primary_alt text-secondary shadow-sm *:data-icon:text-fg-secondary_hover",
    ),
    "button-minimal": cx(
        "rounded-lg outline-focus-ring *:data-icon:text-fg-quaternary",
        isFocusVisible && "outline-2 -outline-offset-2",
        (isSelected || isHovered) && "bg-primary_alt text-secondary shadow-xs ring-1 ring-primary ring-inset *:data-icon:text-fg-secondary_hover",
    ),
    underline: cx(
        "rounded-none border-b-2 border-transparent outline-focus-ring *:data-icon:text-fg-quaternary",
        isFocusVisible && "outline-2 -outline-offset-2",
        (isSelected || isHovered) && "border-fg-brand-primary_alt text-brand-secondary *:data-icon:text-fg-brand-secondary_hover",
    ),
    line: cx(
        "rounded-none border-l-2 border-transparent outline-focus-ring *:data-icon:text-fg-quaternary",
        isFocusVisible && "outline-2 -outline-offset-2",
        (isSelected || isHovered) && "border-fg-brand-primary_alt text-brand-secondary *:data-icon:text-fg-brand-secondary_hover",
    ),
});

const sizes = {
    sm: {
        base: "text-sm font-semibold gap-1 *:data-icon:size-4",
        "button-brand": "py-2 px-2.5",
        "button-gray": "py-2 px-2.5",
        "button-border": "py-2 px-2.5",
        "button-minimal": "py-2 px-2.5",
        underline: "px-0.5 pb-2.5 pt-0",
        line: "pl-2.5 pr-3 py-0.5",
    },
    md: {
        base: "text-md font-semibold gap-1.5 *:data-icon:size-5",
        "button-brand": "py-2.5 px-2.5",
        "button-gray": "py-2.5 px-2.5",
        "button-border": "py-2.5 px-2.5",
        "button-minimal": "py-2.5 px-2.5",
        underline: "px-0.5 pb-2.5 pt-0",
        line: "pr-3.5 pl-3 py-1",
    },
};

// Styles for different types of horizontal tabs
const getHorizontalStyles = ({ size, fullWidth }: { size?: "sm" | "md"; fullWidth?: boolean }) => ({
    "button-brand": "gap-1",
    "button-gray": "gap-1",
    "button-border": cx("gap-1 rounded-[10px] bg-secondary_alt p-1 ring-1 ring-secondary ring-inset", size === "md" && "rounded-xl p-1.5"),
    "button-minimal": "gap-0.5 rounded-lg bg-secondary_alt ring-1 ring-inset ring-secondary",
    underline: cx("gap-3", fullWidth && "w-full gap-4"),
    line: "gap-2",
});

interface TabListComponentProps<T extends object, K extends Orientation> extends Omit<ComponentPropsWithRef<"div">, "children" | "className" | "style" | "onChange" | "color"> {
    /** The size of the tab list. */
    size?: keyof typeof sizes;
    /** The type of the tab list. */
    type?: TabTypeColors<K>;
    /** The orientation of the tab list. */
    orientation?: K;
    /** The items of the tab list. When provided, tabs are rendered automatically via the render function in children. */
    items?: T[];
    /** Whether the tab list is full width. */
    fullWidth?: boolean;
    /** Whether to automatically change the active tab on arrow key focus. Defaults to the `Tabs` keyboard activation. */
    activateOnFocus?: boolean;
    /**
     * Whether to loop keyboard focus back to the first tab when the end of the list is reached.
     * @default false
     */
    loopFocus?: boolean;
    /** The tabs of the tab list. */
    children?: ReactNode | ((item: T, index: number) => ReactNode);
    /** The class name, or a function of the tab list's state. */
    className?: string | ((state: TabListRenderState) => string | undefined);
    /** The inline styles, or a function of the tab list's state. */
    style?: CSSProperties | ((state: TabListRenderState) => CSSProperties | undefined);
    ref?: Ref<HTMLDivElement>;
}

/**
 * What the tab list hands down to each tab: the shared sizing/type of the list. The tab list's
 * orientation is read from the tabs it belongs to, which is why it is not part of this.
 */
const TabListContext = createContext<Omit<TabListComponentProps<TabComponentProps, Orientation>, "items">>({
    size: "sm",
    type: "button-brand",
});

/** What the tabs hand down to the tab list: the orientation and the keyboard activation mode. */
const TabsKeyboardContext = createContext<{ orientation: Orientation; activateOnFocus: boolean; selectedKey: Key | null } | null>(null);

export const TabList = <T extends Orientation,>({
    size = "sm",
    type = "button-brand",
    orientation: orientationProp,
    fullWidth,
    items,
    activateOnFocus,
    loopFocus = false,
    className,
    style,
    children,
    ...otherProps
}: TabListComponentProps<TabComponentProps, T>) => {
    const tabs = useContext(TabsKeyboardContext);

    const orientation = orientationProp ?? tabs?.orientation ?? "horizontal";
    const listState: TabListRenderState = { orientation };

    return (
        <TabListContext.Provider value={{ size, type, orientation, fullWidth }}>
            <BaseTabs.List
                {...otherProps}
                activateOnFocus={activateOnFocus ?? tabs?.activateOnFocus ?? false}
                loopFocus={loopFocus}
                className={(state) =>
                    cx(
                        "group flex",

                        getHorizontalStyles({
                            size,
                            fullWidth,
                        })[type as HorizontalTypes],

                        orientation === "vertical" && "w-max flex-col",

                        // Only horizontal tabs with underline type have bottom border
                        orientation === "horizontal" &&
                            type === "underline" &&
                            "relative before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border-secondary",

                        typeof className === "function" ? className({ ...listState, orientation: state.orientation }) : className,
                    )
                }
                style={typeof style === "function" ? (state) => style({ orientation: state.orientation }) : style}
            >
                {renderTabListChildren(children, items)}
            </BaseTabs.List>
        </TabListContext.Provider>
    );
};

/**
 * A function child renders one tab per item — React Aria's collection did the same for a tab list's
 * `items`. React Aria took each tab's key from the item it rendered; the same key keeps React's list stable.
 */
const renderTabListChildren = (children: TabListComponentProps<TabComponentProps, Orientation>["children"], items?: object[]): ReactNode => {
    if (typeof children !== "function") {
        return children;
    }

    return items?.map((item, index) => {
        const id = (item as { id?: Key }).id;
        return <Tab key={id === undefined ? index : String(id)} {...(item as TabComponentProps)} />;
    });
};

export const TabPanel = ({ id, value, keepMounted, shouldForceMount, className, ...props }: TabPanelProps) => {
    const [isFocused, setFocused] = useState(false);
    const [isFocusVisible, setFocusVisible] = useState(false);

    return (
        <BaseTabs.Panel
            {...props}
            value={value ?? id}
            keepMounted={keepMounted ?? shouldForceMount}
            onFocus={(event: React.FocusEvent<HTMLDivElement>) => {
                setFocused(true);
                setFocusVisible(event.target.matches(":focus-visible"));
                props.onFocus?.(event);
            }}
            onBlur={(event: React.FocusEvent<HTMLDivElement>) => {
                setFocused(false);
                setFocusVisible(false);
                props.onBlur?.(event);
            }}
            className={(state) => {
                const panelState: TabPanelRenderState = {
                    isFocused,
                    isFocusVisible,
                    isInert: state.hidden,
                    isEntering: state.transitionStatus === "starting",
                    isExiting: state.transitionStatus === "ending",
                };

                return cx(
                    "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                    typeof className === "function" ? className(panelState) : className,
                );
            }}
        />
    );
};

export interface TabPanelProps extends Omit<ComponentPropsWithRef<"div">, "id" | "className" | "color"> {
    /** The key of the tab this panel belongs to. */
    id?: Key;
    /** Base UI's spelling of the panel's key. */
    value?: Key;
    /** Whether to keep the panel mounted when it is not selected. */
    keepMounted?: boolean;
    /** React Aria's spelling of `keepMounted`. */
    shouldForceMount?: boolean;
    /** The class name, or a function of the panel's state. */
    className?: string | ((state: TabPanelRenderState) => string | undefined);
}

interface TabComponentProps extends Omit<ComponentPropsWithRef<"button">, "id" | "value" | "children" | "className" | "style" | "onClick" | "color"> {
    /** The key of the tab. */
    id?: Key;
    /** Base UI's spelling of the tab's key. */
    value?: Key;
    /** The label of the tab. */
    label?: ReactNode;
    /** The children of the tab. */
    children?: ReactNode | ((state: TabRenderState) => ReactNode);
    /** Icon component or element to show before the text */
    icon?: FC<{ className?: string }> | ReactNode;
    /** The badge displayed next to the label. */
    badge?: number | string;
    /** Whether the tab is disabled. */
    isDisabled?: boolean;
    /** The class name, or a function of the tab's state. */
    className?: string | ((state: TabRenderState) => string | undefined);
    /** The inline styles, or a function of the tab's state. */
    style?: CSSProperties | ((state: TabRenderState) => CSSProperties | undefined);
    ref?: Ref<HTMLButtonElement>;
    /**
     * Allows you to replace the tab's HTML element with a different tag, or compose it with another
     * component — the same contract as every Base UI part. The render callback receives Base UI's own
     * tab state; a function `className`/child receives the state described by `TabRenderState`.
     */
    render?: useRender.RenderProp<BaseTabs.Tab.State>;
}

export const Tab = ({ label, children, badge, icon: Icon, className, id, value, isDisabled, render, ...otherProps }: TabComponentProps) => {
    const { size = "sm", type = "button-brand", fullWidth } = useContext(TabListContext);
    const tabs = useContext(TabsKeyboardContext);

    const showPillColorBadge = type === "underline" || type === "line" || type === "button-brand";

    const key = value ?? id;
    const [isHovered, setHovered] = useState(false);
    const [isPressed, setPressed] = useState(false);
    const [isFocused, setFocused] = useState(false);
    const [isFocusVisible, setFocusVisible] = useState(false);

    const tabState: TabRenderState = {
        isHovered,
        isPressed,
        isSelected: tabs?.selectedKey != null && tabs.selectedKey === key,
        isFocused,
        isFocusVisible,
        isDisabled: !!isDisabled,
    };

    const href = (otherProps as { href?: string }).href;

    return (
        <BaseTabs.Tab
            {...otherProps}
            value={key}
            disabled={isDisabled}
            nativeButton={href ? false : undefined}
            render={href ? <a href={href} /> : render}
            onPointerEnter={(event: React.PointerEvent<HTMLButtonElement>) => {
                setHovered(true);
                otherProps.onPointerEnter?.(event);
            }}
            onPointerLeave={(event: React.PointerEvent<HTMLButtonElement>) => {
                setHovered(false);
                setPressed(false);
                otherProps.onPointerLeave?.(event);
            }}
            onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => {
                if (!isDisabled) {
                    setPressed(true);
                }
                otherProps.onPointerDown?.(event);
            }}
            onPointerUp={(event: React.PointerEvent<HTMLButtonElement>) => {
                setPressed(false);
                otherProps.onPointerUp?.(event);
            }}
            onFocus={(event: React.FocusEvent<HTMLButtonElement>) => {
                setFocused(true);
                setFocusVisible(event.target.matches(":focus-visible"));
                otherProps.onFocus?.(event);
            }}
            onBlur={(event: React.FocusEvent<HTMLButtonElement>) => {
                setFocused(false);
                setFocusVisible(false);
                otherProps.onBlur?.(event);
            }}
            className={(state) =>
                cx(
                    "z-10 flex h-max cursor-pointer items-center justify-center gap-2 rounded-md whitespace-nowrap text-quaternary transition duration-100 ease-linear",
                    "group-data-[orientation=vertical]:justify-start",
                    fullWidth && "w-full flex-1",
                    sizes[size].base,
                    sizes[size][type],
                    getTabStyles(tabState)[type],
                    typeof className === "function" ? className(tabState) : className,
                )
            }
            style={typeof otherProps.style === "function" ? (state) => (otherProps.style as (state: TabRenderState) => CSSProperties | undefined)(tabState) : otherProps.style}
            // React Aria exposed these as data attributes and Tailwind's `selected:`/`hovered:` variants
            // compile to attribute selectors; they keep working alongside Base UI's own state attributes.
            data-selected={tabState.isSelected ? "" : undefined}
            data-hovered={isHovered ? "" : undefined}
            data-pressed={isPressed ? "" : undefined}
            data-focused={isFocused ? "" : undefined}
            data-focus-visible={isFocusVisible ? "" : undefined}
        >
            <>
                {/* Icon */}
                {isValidElement(Icon) && Icon}
                {isReactComponent(Icon) && <Icon data-icon className="transition-inherit-all" />}

                <span className={cx("flex items-center gap-1.5", type !== "line" && "px-0.5")}>
                    {typeof children === "function" ? children(tabState) : children || label}

                    {/* Badge */}
                    {badge && (
                        <Badge
                            size="sm"
                            type={showPillColorBadge ? "pill-color" : "modern"}
                            color={showPillColorBadge && (tabState.isHovered || tabState.isSelected) ? "brand" : "gray"}
                            className={cx("hidden transition-inherit-all md:flex", size === "sm" && "-my-px")}
                        >
                            {badge}
                        </Badge>
                    )}
                </span>
            </>
        </BaseTabs.Tab>
    );
};

export interface TabsProps extends Omit<ComponentPropsWithRef<"div">, "children" | "className" | "style" | "value" | "defaultValue" | "onChange" | "color"> {
    /** The key of the currently selected tab (controlled). */
    selectedKey?: Key | null;
    /** The key of the initially selected tab (uncontrolled). */
    defaultSelectedKey?: Key | null;
    /** Handler that is called when the selected tab changes. */
    onSelectionChange?: (key: Key) => void;
    /** The selected tab's key (controlled) — Base UI's spelling of `selectedKey`. */
    value?: Key | null;
    /** The initially selected tab's key (uncontrolled) — Base UI's spelling of `defaultSelectedKey`. */
    defaultValue?: Key | null;
    /** Handler that is called when the selected tab changes — Base UI's spelling of `onSelectionChange`. */
    onValueChange?: (value: Key, eventDetails: unknown) => void;
    /**
     * The orientation of the tabs.
     * @default "horizontal"
     */
    orientation?: Orientation;
    /**
     * Whether tabs are activated automatically on focus or manually.
     * @default "manual"
     */
    keyboardActivation?: "automatic" | "manual";
    /** The class name, or a function of the tabs' state. */
    className?: string | ((state: TabListRenderState) => string | undefined);
    /** The inline styles, or a function of the tabs' state. */
    style?: CSSProperties | ((state: TabListRenderState) => CSSProperties | undefined);
    /** The tabs and their panels. */
    children?: ReactNode;
    ref?: Ref<HTMLDivElement>;
}

export const Tabs = ({
    className,
    selectedKey,
    defaultSelectedKey,
    onSelectionChange,
    value,
    defaultValue,
    onValueChange,
    orientation = "horizontal",
    keyboardActivation = "manual",
    style,
    children,
    ...props
}: TabsProps) => {
    // The selected key is mirrored here for the same reason the tabs' own DOM state is not enough:
    // every tab's label, badge and style is computed from its selected state during render.
    const [uncontrolledKey, setUncontrolledKey] = useState<Key | null>(defaultSelectedKey ?? defaultValue ?? null);
    const isControlled = selectedKey !== undefined || value !== undefined;
    const renderedKey = isControlled ? (selectedKey !== undefined ? selectedKey : (value as Key | null)) : uncontrolledKey;

    const keyboardContext = useMemo(
        () => ({ orientation, activateOnFocus: keyboardActivation === "automatic", selectedKey: renderedKey }),
        [orientation, keyboardActivation, renderedKey],
    );

    return (
        <TabsKeyboardContext.Provider value={keyboardContext}>
            <BaseTabs.Root
                {...props}
                value={isControlled ? renderedKey : undefined}
                defaultValue={isControlled ? undefined : (defaultSelectedKey ?? defaultValue)}
                orientation={orientation}
                onValueChange={(next, eventDetails) => {
                    if (!isControlled) {
                        setUncontrolledKey(next);
                    }
                    onSelectionChange?.(next);
                    onValueChange?.(next, eventDetails);
                }}
                className={(state) => cx("flex w-full flex-col", typeof className === "function" ? className({ orientation: state.orientation }) : className)}
                style={typeof style === "function" ? (state) => style({ orientation: state.orientation }) : style}
            >
                {children}
            </BaseTabs.Root>
        </TabsKeyboardContext.Provider>
    );
};

Tabs.Panel = TabPanel;
Tabs.List = TabList;
Tabs.Item = Tab;
