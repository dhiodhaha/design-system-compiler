/* Adopted from untitleduico/react@8b7409c078f8 — components/base/tags/tags.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { CSSProperties, ImgHTMLAttributes, KeyboardEvent, Key, PropsWithChildren, ReactNode, Ref, RefAttributes, RefObject } from "react";
import { Children, Fragment, createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { User01 } from "@untitledui/icons";
import { useRender } from "@base-ui/react/use-render";
import { Dot } from "@/components/foundations/dot-icon";
import { cx } from "@/utils/cx";
import { TagCheckbox } from "./base-components/tag-checkbox";
import { TagCloseX } from "./base-components/tag-close-x";

export const TagAvatar = ({ src, alt, contrastBorder = true, className }: ImgHTMLAttributes<HTMLImageElement> & { contrastBorder?: boolean }) => {
    const [isFailed, setIsFailed] = useState(false);

    return (
        <div
            className={cx(
                "relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-tertiary",
                contrastBorder && "outline-[0.5px] -outline-offset-[0.5px] outline-black/16",
                className,
            )}
        >
            {src && !isFailed ? (
                <img data-avatar-img className="size-full object-cover" src={src} alt={alt} onError={() => setIsFailed(true)} />
            ) : (
                <User01 className="size-3 stroke-[2.25px] text-fg-quaternary" />
            )}
        </div>
    );
};

export interface TagItem {
    id: string;
    label: string;
    count?: number;
    avatarSrc?: string;
    avatarContrastBorder?: boolean;
    dot?: boolean;
    dotClassName?: string;
    isDisabled?: boolean;
    onClose?: (id: string) => void;
}

type SelectionMode = "none" | "single" | "multiple";

/** The state a tag renders with, passed to a function `className` and a function child. */
export type TagRenderProps = {
    /** Whether the tag is selected. (`data-selected`) */
    isSelected: boolean;
    /** Whether the tag is focused. (`data-focused`) */
    isFocused: boolean;
    /** Whether the tag is keyboard focused. (`data-focus-visible`) */
    isFocusVisible: boolean;
    /** Whether the tag is hovered with a mouse. (`data-hovered`) */
    isHovered: boolean;
    /** Whether the tag is currently pressed. (`data-pressed`) */
    isPressed: boolean;
    /** Whether the tag is disabled. (`data-disabled`) */
    isDisabled: boolean;
    /** Whether the tag can be removed by the group's `onRemove`. (`data-allows-removing`) */
    allowsRemoving: boolean;
    /** The group's selection mode. (`data-selection-mode`) */
    selectionMode: SelectionMode;
};

/** The state the tag list renders with, passed to a function `className`/`style` and `renderEmptyState`. */
export type TagListRenderProps = {
    /** Whether the tag list has no tags. */
    isEmpty: boolean;
    /** Whether focus is within the tag list. */
    isFocused: boolean;
    /** Whether focus within the tag list is keyboard focus. */
    isFocusVisible: boolean;
};

interface TagGroupContextValue {
    selectionMode: SelectionMode;
    size: "sm" | "md" | "lg";
    label: string;
    isDisabled: (key: Key) => boolean;
    isSelected: (key: Key) => boolean;
    toggleSelection: (key: Key) => void;
    onRemove?: (keys: Set<Key>) => void;
    /** The list element the group's tags live in; navigation reads its rows. */
    gridRef: RefObject<HTMLDivElement | null>;
    focusTag: (from: Key | null, direction: 1 | -1 | "first" | "last") => void;
    focusedKey: Key | null;
    setFocusedKey: (key: Key | null) => void;
}

const TagGroupContext = createContext<TagGroupContextValue>({
    selectionMode: "none",
    size: "sm",
    label: "",
    isDisabled: () => false,
    isSelected: () => false,
    toggleSelection: () => {},
    gridRef: { current: null },
    focusTag: () => {},
    focusedKey: null,
    setFocusedKey: () => {},
});

export interface TagGroupProps extends Omit<React.ComponentPropsWithRef<"div">, "className" | "color" | "onChange" | "children">, RefAttributes<HTMLDivElement> {
    /** The accessible name of the tag group. */
    label: string;
    /** The size of the tags in the group. */
    size?: "sm" | "md" | "lg";
    /** The type of selection that is allowed in the tag group. */
    selectionMode?: SelectionMode;
    /** The currently selected keys in the collection (controlled). */
    selectedKeys?: Iterable<Key>;
    /** The initial selected keys in the collection (uncontrolled). */
    defaultSelectedKeys?: Iterable<Key>;
    /** Handler that is called when the selection changes. */
    onSelectionChange?: (keys: Set<Key>) => void;
    /** The keys for the elements in the collection that should be disabled. */
    disabledKeys?: Iterable<Key>;
    /** Whether the collection allows empty selection. */
    disallowEmptySelection?: boolean;
    /** Handler that is called when a tag is removed by the user (the close button or Delete/Backspace). */
    onRemove?: (keys: Set<Key>) => void;
    className?: string;
    children?: ReactNode;
    /**
     * Allows you to replace the group's HTML element with a different tag, or compose it with
     * another component — the same contract as every Base UI part. Accepts a `ReactElement` or
     * a function returning one.
     */
    render?: useRender.RenderProp<Record<string, unknown>>;
}

export const TagGroup = ({
    label,
    selectionMode = "none",
    size = "sm",
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    disabledKeys,
    disallowEmptySelection,
    onRemove,
    className,
    children,
    render,
    ...otherProps
}: TagGroupProps) => {
    const [uncontrolledSelectedKeys, setUncontrolledSelectedKeys] = useState<Set<Key>>(() => new Set(defaultSelectedKeys ?? []));
    const isSelectionControlled = selectedKeys !== undefined;

    const selectedKeysValue = useMemo(
        () => (isSelectionControlled ? new Set<Key>(selectedKeys) : uncontrolledSelectedKeys),
        [isSelectionControlled, selectedKeys, uncontrolledSelectedKeys],
    );
    const disabledKeysValue = useMemo(() => new Set<Key>(disabledKeys ?? []), [disabledKeys]);

    const { ref, ...domProps } = otherProps;

    const gridRef = useRef<HTMLDivElement | null>(null);
    const [focusedKey, setFocusedKey] = useState<Key | null>(null);

    const updateSelection = useCallback(
        (keys: Set<Key>) => {
            if (!isSelectionControlled) {
                setUncontrolledSelectedKeys(keys);
            }
            onSelectionChange?.(keys);
        },
        [isSelectionControlled, onSelectionChange],
    );

    const isDisabled = useCallback((key: Key) => disabledKeysValue.has(key), [disabledKeysValue]);

    const toggleSelection = useCallback(
        (key: Key) => {
            if (selectionMode === "none" || disabledKeysValue.has(key)) {
                return;
            }

            if (selectionMode === "single") {
                if (selectedKeysValue.has(key)) {
                    if (!disallowEmptySelection) {
                        updateSelection(new Set());
                    }
                } else {
                    updateSelection(new Set([key]));
                }
                return;
            }

            const nextKeys = new Set(selectedKeysValue);
            if (nextKeys.has(key)) {
                if (disallowEmptySelection && nextKeys.size === 1) {
                    return;
                }
                nextKeys.delete(key);
            } else {
                nextKeys.add(key);
            }
            updateSelection(nextKeys);
        },
        [selectionMode, disabledKeysValue, selectedKeysValue, disallowEmptySelection, updateSelection],
    );

    /** Roving focus across the group's tags, in document order, wrapping at both ends. */
    const focusTag = useCallback((from: Key | null, direction: 1 | -1 | "first" | "last") => {
        // The rows are read from the list itself, the way the payload's own tag input walks them: document
        // order is the navigation order, and a disabled tag is skipped rather than focused.
        const rows = [...(gridRef.current?.querySelectorAll<HTMLElement>('[role="row"]') ?? [])].filter((row) => row.getAttribute("aria-disabled") !== "true");
        if (rows.length === 0) {
            return;
        }

        const currentIndex = from == null ? -1 : rows.findIndex((row) => row.dataset.tagKey === String(from));
        const nextIndex =
            direction === "first"
                ? 0
                : direction === "last"
                  ? rows.length - 1
                  : currentIndex === -1
                    ? direction === 1
                        ? 0
                        : rows.length - 1
                    : (currentIndex + direction + rows.length) % rows.length;

        rows[nextIndex]?.focus();
    }, []);

    const context = useMemo<TagGroupContextValue>(
        () => ({
            selectionMode,
            size,
            label,
            isDisabled,
            isSelected: (key: Key) => selectedKeysValue.has(key),
            toggleSelection,
            onRemove,
            gridRef,
            focusTag,
            focusedKey,
            setFocusedKey,
        }),
        [selectionMode, size, label, isDisabled, selectedKeysValue, toggleSelection, onRemove, focusTag, focusedKey],
    );

    return (
        <TagGroupContext.Provider value={context}>
            {useRender({
                defaultTagName: "div",
                render,
                state: { selectionMode, size },
                props: {
                    ...domProps,
                    ref,
                    // The group's label names the tag list it contains (the list is the grid that owns
                    // the tags); it is repeated here so the group itself carries the same name it did
                    // when React Aria put its labelling props on both elements.
                    "aria-label": domProps["aria-label"] ?? label,
                    className,
                    children,
                },
            })}
        </TagGroupContext.Provider>
    );
};

export interface TagListProps<T = unknown> extends Omit<React.ComponentPropsWithRef<"div">, "children" | "className" | "style"> {
    /** The items to render, paired with a render-function `children`. */
    items?: Iterable<T>;
    /** The tags, or a function that renders one tag per item. */
    children?: ReactNode | ((item: T, index: number) => ReactNode);
    /** The class name, or a function of the list's state. */
    className?: string | ((state: TagListRenderProps) => string | undefined);
    /** The inline styles, or a function of the list's state. */
    style?: CSSProperties | ((state: TagListRenderProps) => CSSProperties | undefined);
    /** Rendered when the list has no tags. */
    renderEmptyState?: (state: TagListRenderProps) => ReactNode;
    /**
     * Allows you to replace the list's HTML element with a different tag, or compose it with
     * another component — the same contract as every Base UI part.
     */
    render?: useRender.RenderProp<TagListRenderProps>;
}

export const TagList = <T,>({ items, children, className, style, renderEmptyState, render, ...otherProps }: TagListProps<T>) => {
    const group = useContext(TagGroupContext);
    const [isFocusWithin, setFocusWithin] = useState(false);

    // The list keeps a ref of its own (the group navigates through the rows it contains) and forwards the
    // consumer's; `useRender` merges a single ref, so the two are merged here.
    const { ref: forwardedRef } = otherProps;
    const setGridRef = (element: HTMLDivElement | null) => {
        group.gridRef.current = element;
        if (typeof forwardedRef === "function") {
            forwardedRef(element);
        } else if (forwardedRef) {
            (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = element;
        }
    };
    const [isFocusVisible, setFocusVisible] = useState(false);

    // The list's own children announce the tag count before anything has mounted, so the empty state and
    // the `grid`/`group` role are correct on the first render (and during SSR) without a registry.
    const tagCount = items ? [...items].length : Children.count(children);
    const isEmpty = tagCount === 0;

    const listState: TagListRenderProps = { isEmpty, isFocused: isFocusWithin, isFocusVisible };

    // Removing the last tag leaves focus on a detached element; the container takes it instead (React
    // Aria's "if the last tag is removed, focus the container").
    const previouslyEmpty = useRef(isEmpty);
    useEffect(() => {
        if (group.gridRef.current && !previouslyEmpty.current && isEmpty && isFocusWithin) {
            group.gridRef.current.focus();
        }
        previouslyEmpty.current = isEmpty;
    }, [isEmpty, isFocusWithin]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        switch (event.key) {
            case "ArrowRight":
                event.preventDefault();
                group.focusTag(group.focusedKey, 1);
                break;
            case "ArrowLeft":
                event.preventDefault();
                group.focusTag(group.focusedKey, -1);
                break;
            case "Home":
                event.preventDefault();
                group.focusTag(group.focusedKey, "first");
                break;
            case "End":
                event.preventDefault();
                group.focusTag(group.focusedKey, "last");
                break;
        }

        otherProps.onKeyDown?.(event);
    };

    // A render function hands back one tag per item; React Aria's collection keyed them, so each rendered
    // tag is wrapped in a keyed fragment here instead of warning about a missing key.
    const renderedTags = items
        ? [...items].map((item, index) => (typeof children === "function" ? <Fragment key={String((item as { id?: Key })?.id ?? index)}>{children(item, index)}</Fragment> : null))
        : children;

    return useRender({
        defaultTagName: "div",
        render,
        state: listState,
        props: {
            ...otherProps,
            ref: setGridRef,
            // A tag group is a grid of rows (React Aria's selection grid); with no tags there is nothing to
            // navigate, so it degrades to a plain group.
            role: isEmpty ? "group" : "grid",
            tabIndex: otherProps.tabIndex ?? 0,
            "aria-label": group.label,
            // Added tags are announced while the user is in the list, and only then.
            "aria-atomic": false,
            "aria-relevant": "additions",
            "aria-live": isFocusWithin ? "polite" : "off",
            onKeyDown,
            onFocus: (event: React.FocusEvent<HTMLDivElement>) => {
                setFocusWithin(true);
                setFocusVisible(event.target.matches(":focus-visible"));
                otherProps.onFocus?.(event);
            },
            onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setFocusWithin(false);
                    setFocusVisible(false);
                }
                otherProps.onBlur?.(event);
            },
            className: typeof className === "function" ? className(listState) : className,
            style: typeof style === "function" ? style(listState) : style,
            children: isEmpty && renderEmptyState ? renderEmptyState(listState) : renderedTags,
        },
    });
};

const styles = {
    sm: {
        root: {
            base: "px-2 py-0.75 text-xs font-medium",
            withCheckbox: "pl-1.25",
            withAvatar: "pl-1",
            withDot: "pl-1.5",
            withCount: "pr-1",
            withClose: "pr-1",
        },
        content: "gap-1",
        count: "px-1 text-xs font-medium",
    },
    md: {
        root: {
            base: "px-2.25 py-0.5 text-sm font-medium",
            withCheckbox: "pl-1",
            withAvatar: "pl-1.25",
            withDot: "pl-1.75",
            withCount: "pr-0.75",
            withClose: "pr-1",
        },
        content: "gap-1.25",
        count: "px-1.25 text-xs font-medium",
    },
    lg: {
        root: {
            base: "px-2.5 py-1 text-sm font-medium",
            withCheckbox: "pl-1.25",
            withAvatar: "pl-1.75",
            withDot: "pl-2.25",
            withCount: "pr-1",
            withClose: "pr-1",
        },
        content: "gap-1.5",
        count: "px-1.5 text-sm font-medium",
    },
};

export interface TagProps extends Omit<React.ComponentPropsWithRef<"div">, "id" | "children" | "className">, Omit<TagItem, "label" | "id"> {
    /** The key that identifies the tag within its group. */
    id?: Key;
    /** A string representation of the tag's content, for assistive technology. */
    textValue?: string;
    /** Whether the tag is disabled. */
    isDisabled?: boolean;
    /** Handler that is called when the tag is activated. */
    onAction?: () => void;
    /**
     * Handler that is called when the tag is pressed. React Aria's press-event object is not
     * reproduced: the handler is called with the native event that activated the tag.
     */
    onPress?: (event: React.MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => void;
    /** The tag's content, or a function of its state. */
    children?: ReactNode | ((state: TagRenderProps) => ReactNode);
    /** The class name, or a function of the tag's state. */
    className?: string | ((state: TagRenderProps) => string | undefined);
    ref?: Ref<HTMLDivElement>;
    /**
     * Allows you to replace the tag's HTML element with a different tag, or compose it with
     * another component — the same contract as every Base UI part.
     */
    render?: useRender.RenderProp<TagRenderProps>;
}

export const Tag = ({
    id,
    avatarSrc,
    avatarContrastBorder = true,
    dot,
    dotClassName,
    isDisabled: isDisabledProp,
    count,
    className,
    children,
    onClose,
    textValue,
    onAction,
    onPress,
    ...otherProps
}: PropsWithChildren<TagProps>) => {
    const group = useContext(TagGroupContext);
    const { ref, render, ...domProps } = otherProps;
    const rowId = useId();

    const key = id ?? rowId;
    const isDisabled = Boolean(isDisabledProp) || group.isDisabled(key);
    const isSelected = group.isSelected(key);
    const allowsRemoving = Boolean(group.onRemove);

    const [isHovered, setHovered] = useState(false);
    const [isPressed, setPressed] = useState(false);
    const [isFocused, setFocused] = useState(false);
    const [isFocusVisible, setFocusVisible] = useState(false);

    const state: TagRenderProps = {
        isSelected,
        isFocused,
        isFocusVisible,
        isHovered,
        isPressed,
        isDisabled,
        allowsRemoving,
        selectionMode: group.selectionMode,
    };

    // The row is focusable while nothing in the group is focused and again once it is the focused one
    // (React Aria's roving tab index), which keeps a single tab stop for the whole group.
    const tabIndex = isDisabled ? -1 : group.focusedKey == null || group.focusedKey === key ? 0 : -1;

    const activate = (event: React.MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
        if (onPress) {
            onPress(event);
            return;
        }
        if (onAction) {
            onAction();
            return;
        }
        group.toggleSelection(key);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) {
            return;
        }

        switch (event.key) {
            case "Delete":
            case "Backspace":
                if (group.onRemove) {
                    event.preventDefault();
                    group.onRemove(isSelected ? new Set() : new Set([key]));
                }
                break;
            case " ":
            case "Enter":
                if (group.selectionMode !== "none" || onAction || onPress) {
                    event.preventDefault();
                    activate(event);
                }
                break;
        }

        domProps.onKeyDown?.(event);
    };

    const leadingContent = avatarSrc ? (
        <TagAvatar src={avatarSrc} alt="Avatar" contrastBorder={avatarContrastBorder} />
    ) : dot ? (
        <Dot className={cx("text-fg-success-secondary", dotClassName)} size="sm" />
    ) : null;

    const content = typeof children === "function" ? children(state) : children;

    const row = useRender({
        defaultTagName: "div",
        render,
        state,
        stateAttributesMapping: {
            isSelected: (value) => (value ? { "data-selected": "" } : null),
            isDisabled: (value) => (value ? { "data-disabled": "" } : null),
            isFocused: (value) => (value ? { "data-focused": "" } : null),
            isFocusVisible: (value) => (value ? { "data-focus-visible": "" } : null),
            isHovered: (value) => (value ? { "data-hovered": "" } : null),
            isPressed: (value) => (value ? { "data-pressed": "" } : null),
            allowsRemoving: (value) => (value ? { "data-allows-removing": "" } : null),
            selectionMode: (value) => (value === "none" ? null : { "data-selection-mode": String(value) }),
        },
        props: {
            ...domProps,
            ref,
            id: rowId,
            "data-tag-key": String(key),
            role: "row",
            tabIndex,
            "aria-disabled": isDisabled || undefined,
            "aria-selected": group.selectionMode === "none" ? undefined : isSelected,
            onKeyDown,
            onClick: (event: React.MouseEvent<HTMLDivElement>) => {
                if (!isDisabled && (group.selectionMode !== "none" || onAction || onPress)) {
                    activate(event);
                }
                domProps.onClick?.(event);
            },
            onFocus: (event: React.FocusEvent<HTMLDivElement>) => {
                setFocused(true);
                setFocusVisible(event.target.matches(":focus-visible"));
                group.setFocusedKey(key);
                domProps.onFocus?.(event);
            },
            onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
                setFocused(false);
                setFocusVisible(false);
                domProps.onBlur?.(event);
            },
            onPointerEnter: (event: React.PointerEvent<HTMLDivElement>) => {
                setHovered(true);
                domProps.onPointerEnter?.(event);
            },
            onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => {
                setHovered(false);
                setPressed(false);
                domProps.onPointerLeave?.(event);
            },
            onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
                if (!isDisabled) {
                    setPressed(true);
                }
                domProps.onPointerDown?.(event);
            },
            onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
                setPressed(false);
                domProps.onPointerUp?.(event);
            },
            className: cx(
                "flex cursor-default items-center gap-0.75 rounded-md bg-primary text-secondary ring-1 ring-primary outline-focus-ring transition duration-50 ease-linear ring-inset focus-visible:outline-2 focus-visible:outline-offset-2",
                styles[group.size].root.base,

                // With avatar
                avatarSrc && styles[group.size].root.withAvatar,
                // With X button
                (onClose || allowsRemoving) && styles[group.size].root.withClose,
                // With dot
                dot && styles[group.size].root.withDot,
                // With count
                typeof count === "number" && styles[group.size].root.withCount,
                // With checkbox
                group.selectionMode !== "none" && styles[group.size].root.withCheckbox,
                // Disabled
                isDisabled && "cursor-not-allowed",

                typeof className === "function" ? className(state) : className,
            ),
            children: (
                <div
                    role="gridcell"
                    style={{ display: "contents" }}
                    // React Aria fed `textValue` to its collection so assistive technology could name
                    // content that is not plain text; the visible text names the cell instead whenever
                    // it can, and the string is the fallback.
                    aria-label={domProps["aria-label"] ?? (typeof children === "string" ? undefined : textValue)}
                >
                    <div className={cx("flex items-center gap-1", styles[group.size].content)}>
                        {group.selectionMode !== "none" && <TagCheckbox size={group.size} isSelected={isSelected} isDisabled={isDisabled} />}

                        {leadingContent}

                        {content}

                        {typeof count === "number" && (
                            <span className={cx("flex items-center justify-center rounded-[3px] bg-tertiary text-center", styles[group.size].count)}>
                                {count}
                            </span>
                        )}
                    </div>

                    {(onClose || allowsRemoving) && (
                        <TagCloseX
                            size={group.size}
                            excludeFromTabOrder
                            isDisabled={isDisabled}
                            onPress={() => key != null && (onClose ? onClose(key.toString()) : group.onRemove?.(new Set([key])))}
                        />
                    )}
                </div>
            ),
        },
    });

    return row;
};
