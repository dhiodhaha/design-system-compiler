/* Adopted from untitleduico/react@8b7409c078f8 — components/base/dropdown/dropdown.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `MenuTrigger` + `Popover` + `Menu` stack is
 * replaced by `@base-ui/react@1.8.0` — `Menu` (Root > Trigger + Portal > Positioner > Popup > Item/Group/
 * GroupLabel/Separator/RadioGroup/RadioItem/CheckboxItem/SubmenuRoot > SubmenuTrigger) and `ContextMenu` for
 * `trigger="contextMenu"`. The exported namespace, every prop name and every default are unchanged; the state
 * the Tailwind classes hang off is read from Base UI's attributes (`data-highlighted`, `data-checked`,
 * `data-open`, `data-ending-style`, `data-side`) instead of React Aria render-props. The unit record is
 * .design-compiler/base-ui-migration/units/dropdown-family.json. */
"use client";

import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { FC, HTMLAttributes, ReactElement, ReactNode, Ref } from "react";
import { Children, createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, DotsVertical } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import { Avatar } from "../avatar/avatar";
import { CheckboxBase } from "../checkbox/checkbox";
import { RadioButtonBase } from "../radio-buttons/radio-buttons";
import { ToggleBase } from "../toggle/toggle";

/* ---------------------------------------------------------------------------------------------- *
 * Vocabulary kept from the React Aria implementation (consumers import these types from here).
 * ---------------------------------------------------------------------------------------------- */

/** A collection key — React Aria's `Key`. */
export type Key = string | number;

/** React Aria's `Selection` (`"all"` or a set of keys), kept so existing call sites keep compiling. */
export type Selection = "all" | Set<Key>;

/** React Aria's `selectedKeys`/`defaultSelectedKeys` accept any iterable, as they did before the migration. */
export type SelectedKeys = "all" | Iterable<Key>;

/** React Aria's `SelectionMode`. */
export type SelectionMode = "none" | "single" | "multiple";

/**
 * React Aria's `Placement` vocabulary. Base UI positions with a `side` + `align` pair, so these strings are
 * translated (see `getSideAndAlign`): `bottom right` is side `bottom`, align `end`.
 */
export type DropdownPlacement =
    | "top"
    | "top left"
    | "top right"
    | "top start"
    | "top end"
    | "bottom"
    | "bottom left"
    | "bottom right"
    | "bottom start"
    | "bottom end"
    | "left"
    | "left top"
    | "left bottom"
    | "right"
    | "right top"
    | "right bottom"
    | "start"
    | "start top"
    | "start bottom"
    | "end"
    | "end top"
    | "end bottom";

type BaseUiSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
type BaseUiAlign = "start" | "center" | "end";

/** React Aria side tokens → Base UI sides (`start`/`end` stay logical, so they remain RTL-aware). */
const BASE_UI_SIDES: Record<string, BaseUiSide> = {
    top: "top",
    bottom: "bottom",
    left: "left",
    right: "right",
    start: "inline-start",
    end: "inline-end",
};

/** React Aria alignment tokens → Base UI alignments (`top`/`left` are the alignment axis' start edge). */
const BASE_UI_ALIGNMENTS: Record<string, BaseUiAlign> = {
    top: "start",
    left: "start",
    start: "start",
    bottom: "end",
    right: "end",
    end: "end",
    center: "center",
};

/** The slide animation that belongs to each side, matching React Aria's `placement-*` variants. */
const SLIDE_IN_BY_SIDE: Record<BaseUiSide, string> = {
    top: "slide-in-from-bottom-0.5",
    bottom: "slide-in-from-top-0.5",
    left: "slide-in-from-right-0.5",
    right: "slide-in-from-left-0.5",
    "inline-start": "slide-in-from-right-0.5",
    "inline-end": "slide-in-from-left-0.5",
};

const SLIDE_OUT_BY_SIDE: Record<BaseUiSide, string> = {
    top: "slide-out-to-bottom-0.5",
    bottom: "slide-out-to-top-0.5",
    left: "slide-out-to-left-0.5",
    right: "slide-out-to-right-0.5",
    "inline-start": "slide-out-to-right-0.5",
    "inline-end": "slide-out-to-left-0.5",
};

const getSideAndAlign = (placement: DropdownPlacement | undefined) => {
    const [side, align] = (placement ?? "").trim().split(/\s+/);

    return { side: BASE_UI_SIDES[side] ?? "bottom", align: align ? (BASE_UI_ALIGNMENTS[align] ?? "center") : "end" } as const;
};

/** React Aria's `shouldFlip={false}` equivalent. */
const NO_FLIP = { side: "none", align: "shift", fallbackAxisSide: "none" } as const;

/** The props Base UI hands to a `render` callback. */
type RenderProps = HTMLAttributes<any> & { ref?: Ref<any> };

/* ---------------------------------------------------------------------------------------------- *
 * Selection plumbing. React Aria keeps `selectionMode`/`selectedKeys`/`onSelectionChange` on the
 * menu (and per section) and derives one item state from it; Base UI splits that into a
 * `RadioGroup` + `RadioItem`s (single) and independent `CheckboxItem`s (multiple). This context is
 * the adapter between the two, so `Dropdown.Section`/`Dropdown.Item` keep their React Aria props.
 * ---------------------------------------------------------------------------------------------- */

interface SelectionOwner {
    selectionMode: SelectionMode;
    /** The single selected key when `selectionMode` is `"single"`. */
    selectedValue: string | null;
    isSelected: (key: string) => boolean;
    /** Applies a new selected state for one key, honouring `disallowEmptySelection`. */
    setSelected: (key: string, selected: boolean) => void;
    /** Items register while mounted so `selectedKeys="all"` can be resolved to concrete keys. */
    registerKey: (key: string, mounted: boolean) => void;
    /** React Aria's `disabledKeys`. */
    disabledKeys?: Set<string>;
    /** React Aria's `onAction` (called with the activated item key). */
    onAction?: (key: Key) => void;
    /** React Aria's `onSelectionChange`, so a nested section can forward to the menu that owns it. */
    onSelectionChange?: (keys: Selection) => void;
}

const SelectionContext = createContext<SelectionOwner | null>(null);

/**
 * `Dropdown.Root` owns the trigger element's id so the menu it renders can label itself with it, exactly as
 * React Aria labelled its menu with the trigger (`aria-labelledby`).
 */
const TriggerIdContext = createContext<string | undefined>(undefined);

/** Set by `Dropdown.Submenu`: the item it wraps is a submenu trigger, not a selectable item. */
const SubmenuContext = createContext<{ delay?: number; closeDelay?: number } | null>(null);

type NormalizedSelection = Set<string> | "all";

const normalizeKeys = (selection: SelectedKeys | undefined): NormalizedSelection => {
    if (selection === "all") {
        return "all";
    }

    return new Set(Array.from(selection ?? []).map(String));
};

const useSelectionOwner = ({
    selectionMode = "none",
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    disallowEmptySelection = false,
}: {
    selectionMode?: SelectionMode;
    selectedKeys?: SelectedKeys;
    defaultSelectedKeys?: SelectedKeys;
    onSelectionChange?: (keys: Selection) => void;
    disallowEmptySelection?: boolean;
}): SelectionOwner => {
    const isControlled = selectedKeys !== undefined;
    const [uncontrolledKeys, setUncontrolledKeys] = useState<NormalizedSelection>(() => normalizeKeys(defaultSelectedKeys));
    const keys = isControlled ? normalizeKeys(selectedKeys) : uncontrolledKeys;

    const registeredKeys = useRef(new Set<string>());
    const onSelectionChangeRef = useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;

    const commit = useCallback(
        (next: NormalizedSelection) => {
            if (!isControlled) {
                setUncontrolledKeys(next);
            }

            onSelectionChangeRef.current?.(next);
        },
        [isControlled],
    );

    const setSelected = useCallback(
        (key: string, selected: boolean) => {
            if (selectionMode === "single") {
                if (selected) {
                    commit(new Set([key]));
                } else if (!disallowEmptySelection) {
                    commit(new Set());
                }
                return;
            }

            if (keys === "all") {
                const all = new Set(registeredKeys.current);
                if (selected) {
                    all.add(key);
                } else {
                    all.delete(key);
                }
                commit(all);
                return;
            }

            const next = new Set(keys);
            if (selected) {
                next.add(key);
            } else {
                next.delete(key);
            }
            commit(next);
        },
        [selectionMode, disallowEmptySelection, keys, commit],
    );

    const isSelected = useCallback((key: string) => keys === "all" || keys.has(key), [keys]);
    const registerKey = useCallback((key: string, mounted: boolean) => {
        if (mounted) {
            registeredKeys.current.add(key);
        } else {
            registeredKeys.current.delete(key);
        }
    }, []);

    // `undefined` means "no radio is selected"; `null` keeps Base UI's radio group controlled.
    const selectedValue = keys === "all" ? null : ((keys.values().next().value as string | undefined) ?? null);

    return useMemo(
        () => ({ selectionMode, selectedValue, isSelected, setSelected, registerKey, onSelectionChange: onSelectionChangeRef.current }),
        [selectionMode, selectedValue, isSelected, setSelected, registerKey],
    );
};

/** A radio group in Base UI always needs a controlled value: re-picking the checked radio clears it. */
const useRadioGroupProps = (owner: SelectionOwner) => ({
    value: owner.selectedValue,
    onValueChange: (next: string) => (owner.isSelected(next) ? owner.setSelected(next, false) : owner.setSelected(next, true)),
});

/* ---------------------------------------------------------------------------------------------- *
 * Item state: the React Aria render-prop shape consumers may still pass to `className`/`children`.
 * ---------------------------------------------------------------------------------------------- */

export interface DropdownItemState {
    isSelected: boolean;
    isDisabled: boolean;
    /** Keyboard/pointer highlight — React Aria's `isFocused`. */
    isFocused: boolean;
    /** Whether the item currently has visible keyboard focus. */
    isFocusVisible: boolean;
    /** React Aria reported a press here; Base UI exposes no item press state (always false). */
    isPressed: boolean;
    hasSubmenu: boolean;
    isOpen: boolean;
    selectionMode: SelectionMode;
}

type ClassNameValue<State> = string | ((state: State) => string | undefined);

const resolveClassName = <State,>(className: ClassNameValue<State> | undefined, state: State) =>
    typeof className === "function" ? className(state) : className;

type PartState = { disabled?: boolean; highlighted?: boolean; open?: boolean; checked?: boolean };

/* ---------------------------------------------------------------------------------------------- *
 * Item
 * ---------------------------------------------------------------------------------------------- */

interface DropdownItemProps {
    /** The key of the item — used for selection and as the element id, as in React Aria. */
    id?: Key;
    /** The label of the item to be displayed. */
    label?: string;
    /** An addon to be displayed on the right side of the item. */
    addon?: string;
    /** If true, the item will not have any styles. */
    unstyled?: boolean;
    /** An icon to be displayed on the left side of the item. */
    icon?: FC<{ className?: string }>;
    /** Avatar URL to be displayed on the left side of the item. */
    avatarUrl?: string;
    /** The selection indicator to be displayed on the item. */
    selectionIndicator?: "checkmark" | "checkbox" | "radio" | "toggle" | "none";
    /** Whether the item is disabled. */
    isDisabled?: boolean;
    /** Base UI's spelling of `isDisabled`; accepted for new call sites. */
    disabled?: boolean;
    /** A string representation of the item's contents, used for features like typeahead. */
    textValue?: string;
    /** Handler that is called when the item is activated. */
    onAction?: () => void;
    /** The link target — renders an anchor item, as React Aria's `MenuItem` did. */
    href?: string;
    /** Whether the menu should close when the item is selected. */
    shouldCloseOnSelect?: boolean;
    /** Base UI's spelling of `shouldCloseOnSelect`. */
    closeOnClick?: boolean;
    /** Handler that is called when the item is activated (React Aria's `onPress`). */
    onPress?: React.MouseEventHandler<any>;
    /** Handler that is called when the item is clicked. */
    onClick?: React.MouseEventHandler<any>;
    className?: ClassNameValue<DropdownItemState>;
    children?: ReactNode | ((state: DropdownItemState) => ReactNode);
    "aria-label"?: string;
    style?: React.CSSProperties;
    /** Any additional `data-` attributes are forwarded to the item element. */
    [dataAttribute: `data-${string}`]: unknown;
}

const DropdownItem = ({
    id,
    label,
    children,
    addon,
    icon: Icon,
    avatarUrl,
    unstyled,
    selectionIndicator = "checkmark",
    isDisabled,
    disabled,
    textValue,
    onAction,
    href,
    shouldCloseOnSelect,
    closeOnClick,
    onPress,
    onClick,
    className,
    ...props
}: DropdownItemProps) => {
    const selection = useContext(SelectionContext);
    const submenu = useContext(SubmenuContext);
    const isSubmenuTrigger = submenu !== null;

    const key = id !== undefined && id !== null ? String(id) : (textValue ?? label);
    // The collection's selection mode still describes a submenu trigger's selection state (React Aria marked
    // such an item selected and kept its indicator), even though Base UI renders it as a submenu trigger.
    const selectionMode: SelectionMode = selection?.selectionMode ?? "none";
    const isSelected = key !== undefined ? (selection?.isSelected(key) ?? false) : false;
    const isDisabledResolved = isDisabled ?? disabled ?? (key !== undefined && (selection?.disabledKeys?.has(key) ?? false));

    useEffect(() => {
        if (key === undefined) {
            return;
        }

        selection?.registerKey(key, true);

        return () => selection?.registerKey(key, false);
    }, [key, selection]);

    const resolveState = (partState: PartState): DropdownItemState => ({
        isSelected,
        isDisabled: partState.disabled ?? false,
        isFocused: partState.highlighted ?? false,
        // Base UI moves real DOM focus onto the item, so the visible keyboard focus is `:focus-visible`.
        isFocusVisible: false,
        isPressed: false,
        hasSubmenu: isSubmenuTrigger,
        isOpen: partState.open ?? false,
        selectionMode,
    });

    const renderSelectionIndicator = (state: DropdownItemState, indicatorClassName?: string) => {
        if (selectionIndicator === "checkmark") {
            return (
                <Check
                    aria-hidden="true"
                    className={cx("size-4 shrink-0 stroke-[2.25px] text-fg-brand-primary", !state.isSelected && "invisible", indicatorClassName)}
                />
            );
        }
        if (selectionIndicator === "checkbox") {
            return (
                <CheckboxBase
                    isSelected={state.isSelected && !state.hasSubmenu}
                    isIndeterminate={state.isSelected && state.hasSubmenu}
                    size="sm"
                    className={cx("shrink-0", indicatorClassName)}
                />
            );
        }
        if (selectionIndicator === "radio") {
            return <RadioButtonBase isSelected={state.isSelected} className={cx("shrink-0", indicatorClassName)} />;
        }
        if (selectionIndicator === "toggle") {
            return <ToggleBase slim size="sm" isSelected={state.isSelected} className={cx("shrink-0", indicatorClassName)} />;
        }

        return null;
    };

    const renderContent = (state: DropdownItemState) => {
        if (unstyled) {
            return typeof children === "function" ? children(state) : children;
        }

        return (
            <div
                className={cx(
                    "relative flex items-center rounded-md px-2.5 py-2 outline-focus-ring transition duration-100 ease-linear",
                    // Base UI highlights on hover (highlightItemOnHover) and on keyboard navigation, and focuses
                    // the item element itself — the classes belong to this box, so they hang off the item ancestor.
                    !state.isDisabled && "in-data-highlighted:bg-primary_hover",
                    "in-focus-visible:outline-2 in-focus-visible:-outline-offset-2",
                    state.hasSubmenu && "pr-1.5",
                )}
            >
                {state.selectionMode !== "none" && !avatarUrl && !Icon && renderSelectionIndicator(state, "mr-2")}

                {avatarUrl && (
                    <div className="mr-2 flex size-4 items-center justify-center">
                        <Avatar aria-hidden="true" size="xs" src={avatarUrl} alt={label} className="size-5" />
                    </div>
                )}

                {Icon && <Icon aria-hidden="true" className="mr-2 size-4 shrink-0 stroke-[2.25px] text-fg-quaternary" />}

                <span className={cx("grow truncate text-sm font-semibold text-secondary", "in-data-highlighted:text-secondary_hover")}>
                    {label || (typeof children === "function" ? children(state) : children)}
                </span>

                {addon && <span className="ml-1 shrink-0 pr-1 text-xs font-medium text-quaternary">{addon}</span>}

                {state.selectionMode !== "none" && (avatarUrl || Icon) && renderSelectionIndicator(state, "ml-1")}

                {state.hasSubmenu && (
                    <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 stroke-[2.25px] text-fg-quaternary" />
                )}
            </div>
        );
    };

    const activate = (event: React.MouseEvent<any>) => {
        onClick?.(event);
        onPress?.(event);
        onAction?.();
        if (key !== undefined) {
            selection?.onAction?.(key);
        }
    };

    const itemProps = {
        ...props,
        // React Aria's `textValue` is Base UI's typeahead `label`.
        label: textValue ?? label,
        disabled: isDisabledResolved,
        // React Aria marked disabled items with `aria-disabled`; Base UI only emits `data-disabled`.
        "aria-disabled": isDisabledResolved ? ("true" as const) : undefined,
        onClick: activate,
        render: (partProps: RenderProps, partState: PartState) => {
            const state = resolveState(partState);

            return (
                <div
                    {...partProps}
                    className={cx(
                        unstyled ? undefined : "group block cursor-pointer px-1.5 py-px outline-hidden",
                        unstyled ? undefined : "data-disabled:cursor-not-allowed data-disabled:opacity-50",
                        resolveClassName(className, state),
                    )}
                >
                    {renderContent(state)}
                </div>
            );
        },
    };

    // Base UI splits React Aria's single `MenuItem` into one part per behaviour; the consumer-facing props
    // decide which one renders, so `isDisabled`/`href`/selection sections keep working unchanged.
    if (isSubmenuTrigger) {
        return <BaseMenu.SubmenuTrigger {...itemProps} id={key} delay={submenu?.delay} closeDelay={submenu?.closeDelay} />;
    }

    if (href !== undefined) {
        const { disabled: _disabled, ...linkProps } = itemProps;

        return <BaseMenu.LinkItem {...linkProps} id={id !== undefined ? key : undefined} href={href} />;
    }

    if (selectionMode === "single" && key !== undefined) {
        return (
            <BaseMenu.RadioItem
                {...itemProps}
                value={key}
                // React Aria closes the menu when a single-select item is chosen; Base UI's RadioItem does not.
                closeOnClick={closeOnClick ?? shouldCloseOnSelect ?? true}
            />
        );
    }

    if (selectionMode === "multiple" && key !== undefined) {
        return (
            <BaseMenu.CheckboxItem
                {...itemProps}
                checked={isSelected}
                onCheckedChange={(checked) => selection?.setSelected(key, checked)}
                closeOnClick={closeOnClick ?? shouldCloseOnSelect ?? false}
            />
        );
    }

    return <BaseMenu.Item {...itemProps} id={id !== undefined ? key : undefined} closeOnClick={closeOnClick ?? shouldCloseOnSelect ?? true} />;
};

/* ---------------------------------------------------------------------------------------------- *
 * Menu
 * ---------------------------------------------------------------------------------------------- */

export interface DropdownMenuState {
    /** Whether the menu has no items. */
    isEmpty: boolean;
}

interface DropdownMenuProps {
    /** Which selection behaviour the items in this menu use. */
    selectionMode?: SelectionMode;
    /** The currently selected keys (controlled). */
    selectedKeys?: SelectedKeys;
    /** The initial selected keys (uncontrolled). */
    defaultSelectedKeys?: SelectedKeys;
    /** Handler that is called when the selection changes. */
    onSelectionChange?: (keys: Selection) => void;
    /** Whether the selection is required to be non-empty. */
    disallowEmptySelection?: boolean;
    /** Keys of the items that should ignore user interaction. */
    disabledKeys?: Iterable<Key>;
    /** Handler that is called with the key of the item that was activated. */
    onAction?: (key: Key) => void;
    className?: ClassNameValue<DropdownMenuState>;
    children?: ReactNode;
    /** Any additional `data-` attributes are forwarded to the menu element. */
    [dataAttribute: `data-${string}`]: unknown;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    id?: string;
}

const DropdownMenu = ({
    selectionMode,
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    disallowEmptySelection,
    disabledKeys,
    onAction,
    className,
    children,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...props
}: DropdownMenuProps) => {
    const owner = useSelectionOwner({ selectionMode, selectedKeys, defaultSelectedKeys, onSelectionChange, disallowEmptySelection });
    const triggerId = useContext(TriggerIdContext);

    const radioGroup = useRadioGroupProps(owner);
    const disabledKeySet = useMemo(() => (disabledKeys ? new Set(Array.from(disabledKeys).map(String)) : undefined), [disabledKeys]);

    const value = useMemo<SelectionOwner>(() => ({ ...owner, disabledKeys: disabledKeySet, onAction }), [owner, disabledKeySet, onAction]);

    const content = <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;

    // The menu box carries `role="menu"` itself: Base UI puts the role on the popup, which also holds the
    // content a consumer renders beside the menu (search fields, footers), and that content is not allowed
    // inside a menu role. Nested one level in is exactly the DOM React Aria produced.
    return (
        <div
            {...props}
            role="menu"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy ?? triggerId}
            className={cx("h-min overflow-y-auto py-1 outline-hidden select-none", resolveClassName(className, { isEmpty: !children }))}
        >
            {/* A menu-wide single selection needs Base UI's radio group around the items; a section that
                declares its own selection mode renders its own group (Base UI resolves the nearest one). */}
            {owner.selectionMode === "single" ? (
                <BaseMenu.RadioGroup {...radioGroup}>{content}</BaseMenu.RadioGroup>
            ) : (
                content
            )}
        </div>
    );
};

/* ---------------------------------------------------------------------------------------------- *
 * Section / Section header
 * ---------------------------------------------------------------------------------------------- */

interface DropdownSectionProps {
    /** Which selection behaviour the items in this section use (defaults to the menu's). */
    selectionMode?: SelectionMode;
    selectedKeys?: SelectedKeys;
    defaultSelectedKeys?: SelectedKeys;
    onSelectionChange?: (keys: Selection) => void;
    disallowEmptySelection?: boolean;
    className?: string;
    children?: ReactNode;
    "aria-label"?: string;
}

const DropdownSection = ({ selectionMode, className, children, ...props }: DropdownSectionProps) => {
    // React Aria only gives a section its own selection manager when it declares `selectionMode`; otherwise
    // the section shares the menu's selection entirely (`DropdownSelectionSection` owns the rest).
    if (selectionMode === undefined) {
        return (
            <BaseMenu.Group {...props} className={className}>
                {children}
            </BaseMenu.Group>
        );
    }

    return (
        <DropdownSelectionSection {...props} selectionMode={selectionMode} className={className}>
            {children}
        </DropdownSelectionSection>
    );
};

const DropdownSelectionSection = ({
    selectionMode,
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    disallowEmptySelection,
    className,
    children,
    ...props
}: DropdownSectionProps & { selectionMode: SelectionMode }) => {
    const parent = useContext(SelectionContext);
    const owner = useSelectionOwner({
        selectionMode,
        selectedKeys,
        defaultSelectedKeys,
        onSelectionChange: onSelectionChange ?? parent?.onSelectionChange,
        disallowEmptySelection,
    });
    const radioGroup = useRadioGroupProps(owner);

    const value = useMemo<SelectionOwner>(
        () => ({ ...owner, onAction: parent?.onAction, disabledKeys: parent?.disabledKeys }),
        [owner, parent?.onAction, parent?.disabledKeys],
    );

    return (
        <SelectionContext.Provider value={value}>
            {owner.selectionMode === "single" ? (
                <BaseMenu.RadioGroup {...props} {...radioGroup} className={className}>
                    {children}
                </BaseMenu.RadioGroup>
            ) : (
                <BaseMenu.Group {...props} className={className}>
                    {children}
                </BaseMenu.Group>
            )}
        </SelectionContext.Provider>
    );
};

interface DropdownSectionHeaderProps {
    className?: string;
    children?: ReactNode;
    id?: string;
}

const DropdownSectionHeader = ({ className, children, ...props }: DropdownSectionHeaderProps) => (
    <BaseMenu.GroupLabel {...props} className={className}>
        {children}
    </BaseMenu.GroupLabel>
);

/* ---------------------------------------------------------------------------------------------- *
 * Popover
 * ---------------------------------------------------------------------------------------------- */

export interface DropdownPopoverState {
    isEntering: boolean;
    isExiting: boolean;
}

interface DropdownPopoverProps {
    /** The React Aria placement of the popover relative to its trigger. */
    placement?: DropdownPlacement;
    /** The main axis offset of the popover. */
    offset?: number;
    /** The cross axis offset of the popover. */
    crossOffset?: number;
    /** The padding between the popover and the viewport edges. */
    containerPadding?: number;
    /** Whether the popover should flip when it does not fit. */
    shouldFlip?: boolean;
    className?: ClassNameValue<DropdownPopoverState>;
    children?: ReactNode;
    /** The container element in which the overlay portal is placed. */
    UNSTABLE_portalContainer?: HTMLElement | null;
    /** Any additional `data-` attributes are forwarded to the popup element. */
    [dataAttribute: `data-${string}`]: unknown;
}

const DropdownPopover = ({
    placement = "bottom right",
    offset,
    crossOffset,
    containerPadding,
    shouldFlip,
    className,
    children,
    UNSTABLE_portalContainer,
    ...props
}: DropdownPopoverProps) => {
    const { side, align } = getSideAndAlign(placement);

    return (
        <BaseMenu.Portal container={UNSTABLE_portalContainer}>
            <BaseMenu.Positioner
                side={side}
                align={align}
                sideOffset={offset}
                alignOffset={crossOffset}
                collisionPadding={containerPadding}
                collisionAvoidance={shouldFlip === false ? NO_FLIP : undefined}
            >
                <BaseMenu.Popup
                    {...props}
                    // The role lives on the menu box (`Dropdown.Menu`), which is the only child that holds
                    // menu items — the popup also holds the content rendered around the menu.
                    role={undefined}
                    aria-labelledby={undefined}
                    className={(state) =>
                        cx(
                            "w-62 origin-(--transform-origin) overflow-auto rounded-lg bg-primary shadow-lg ring-1 ring-secondary_alt will-change-transform",
                            // React Aria held data-entering/data-exiting for the whole phase; Base UI keeps
                            // data-open for the open phase and data-ending-style until it unmounts.
                            state.open && "duration-150 ease-out animate-in fade-in",
                            state.open && SLIDE_IN_BY_SIDE[side],
                            state.transitionStatus === "ending" && "duration-100 ease-in animate-out fade-out",
                            state.transitionStatus === "ending" && SLIDE_OUT_BY_SIDE[side],
                            resolveClassName(className, {
                                isEntering: state.transitionStatus === "starting",
                                isExiting: state.transitionStatus === "ending",
                            }),
                        )
                    }
                >
                    {children}
                </BaseMenu.Popup>
            </BaseMenu.Positioner>
        </BaseMenu.Portal>
    );
};

/* ---------------------------------------------------------------------------------------------- *
 * Separator
 * ---------------------------------------------------------------------------------------------- */

interface DropdownSeparatorProps {
    className?: string;
}

const DropdownSeparator = ({ className, ...props }: DropdownSeparatorProps) => (
    <BaseMenu.Separator {...props} className={cx("my-1 h-px w-full bg-border-secondary", className)} />
);

/* ---------------------------------------------------------------------------------------------- *
 * Dots button
 * ---------------------------------------------------------------------------------------------- */

interface DropdownDotsButtonState {
    isPressed: boolean;
    isHovered: boolean;
    isFocusVisible: boolean;
}

interface DropdownDotsButtonProps extends Omit<React.ComponentPropsWithoutRef<"button">, "className"> {
    className?: ClassNameValue<DropdownDotsButtonState>;
}

const DropdownDotsButton = ({ className, children, type = "button", ...props }: DropdownDotsButtonProps) => {
    const [state, setState] = useState<DropdownDotsButtonState>({ isPressed: false, isHovered: false, isFocusVisible: false });
    const update = (patch: Partial<DropdownDotsButtonState>) => setState((previous) => ({ ...previous, ...patch }));

    return (
        <button
            {...props}
            type={type}
            aria-label="Open menu"
            // React Aria exposed isPressed/isHovered/isFocusVisible through a render-prop className; the same
            // states are tracked here so a consumer's className function keeps working.
            onPointerEnter={(event) => {
                update({ isHovered: true });
                props.onPointerEnter?.(event);
            }}
            onPointerLeave={(event) => {
                update({ isHovered: false, isPressed: false });
                props.onPointerLeave?.(event);
            }}
            onPointerDown={(event) => {
                update({ isPressed: true });
                props.onPointerDown?.(event);
            }}
            onPointerUp={(event) => {
                update({ isPressed: false });
                props.onPointerUp?.(event);
            }}
            onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                    update({ isPressed: true });
                }
                props.onKeyDown?.(event);
            }}
            onKeyUp={(event) => {
                update({ isPressed: false });
                props.onKeyUp?.(event);
            }}
            onFocus={(event) => {
                update({ isFocusVisible: event.currentTarget.matches(":focus-visible") });
                props.onFocus?.(event);
            }}
            onBlur={(event) => {
                update({ isFocusVisible: false, isPressed: false });
                props.onBlur?.(event);
            }}
            className={cx(
                "cursor-pointer rounded-md text-fg-quaternary outline-focus-ring transition duration-100 ease-linear",
                (state.isHovered || state.isPressed) && "text-fg-quaternary_hover",
                (state.isPressed || state.isFocusVisible) && "outline-2 outline-offset-2",
                resolveClassName(className, state),
            )}
        >
            {children ?? <DotsVertical className="size-5 transition-inherit-all" />}
        </button>
    );
};

/* ---------------------------------------------------------------------------------------------- *
 * Root
 * ---------------------------------------------------------------------------------------------- */

export interface DropdownRootProps {
    /** React Aria's trigger mode — `contextMenu` opens the menu on right click instead of on press. */
    trigger?: "press" | "longPress" | "hover" | "contextMenu";
    /** Whether the menu is currently open (controlled). */
    isOpen?: boolean;
    /** Whether the menu is initially open (uncontrolled). */
    defaultOpen?: boolean;
    /** Handler that is called when the open state changes. */
    onOpenChange?: (isOpen: boolean) => void;
    /** Handler that is called after the open state change finished animating. */
    onOpenChangeComplete?: (isOpen: boolean) => void;
    /** Whether the trigger is disabled. */
    isDisabled?: boolean;
    /** Hover-open delay, forwarded to the trigger when `trigger="hover"`. */
    delay?: number;
    /** Hover-close delay, forwarded to the trigger when `trigger="hover"`. */
    closeDelay?: number;
    children: ReactNode;
}

const DropdownRoot = ({
    trigger = "press",
    isOpen,
    defaultOpen,
    onOpenChange,
    onOpenChangeComplete,
    isDisabled,
    delay,
    closeDelay,
    children,
}: DropdownRootProps) => {
    // React Aria's MenuTrigger takes [trigger, overlay]; Base UI needs the trigger to be an explicit part, so
    // the first child is rendered through the trigger's `render` prop and the rest stay where they are.
    const [triggerElement, ...overlays] = Children.toArray(children);
    // Owning the trigger id keeps the menu's `aria-labelledby` pointing at its trigger, as React Aria did.
    const triggerId = useId();

    const rootProps = {
        open: isOpen,
        defaultOpen,
        onOpenChange: onOpenChange ? (nextOpen: boolean) => onOpenChange(nextOpen) : undefined,
        onOpenChangeComplete,
        disabled: isDisabled,
    };

    if (trigger === "contextMenu") {
        return (
            <BaseContextMenu.Root {...rootProps}>
                <TriggerIdContext.Provider value={triggerId}>
                    {triggerElement ? <BaseContextMenu.Trigger id={triggerId} render={triggerElement as ReactElement} /> : null}
                    {overlays}
                </TriggerIdContext.Provider>
            </BaseContextMenu.Root>
        );
    }

    return (
        <BaseMenu.Root {...rootProps}>
            <TriggerIdContext.Provider value={triggerId}>
                {triggerElement ? (
                    <BaseMenu.Trigger
                        id={triggerId}
                        render={triggerElement as ReactElement}
                        openOnHover={trigger === "hover" ? true : undefined}
                        delay={delay}
                        closeDelay={closeDelay}
                    />
                ) : null}
                {overlays}
            </TriggerIdContext.Provider>
        </BaseMenu.Root>
    );
};

/* ---------------------------------------------------------------------------------------------- *
 * Submenu
 * ---------------------------------------------------------------------------------------------- */

export interface DropdownSubmenuProps {
    /** The delay in milliseconds for the submenu to appear after hovering over the trigger. */
    delay?: number;
    /** The delay in milliseconds before the submenu closes after the pointer leaves it. */
    closeDelay?: number;
    /** Whether the submenu is currently open (controlled). */
    isOpen?: boolean;
    /** Whether the submenu is initially open (uncontrolled). */
    defaultOpen?: boolean;
    /** Handler that is called when the submenu's open state changes. */
    onOpenChange?: (isOpen: boolean) => void;
    /** The trigger item followed by the submenu's `Dropdown.Popover` — React Aria's `SubmenuTrigger` shape. */
    children: ReactNode;
}

const DropdownSubmenu = ({ delay, closeDelay, isOpen, defaultOpen, onOpenChange, children }: DropdownSubmenuProps) => {
    const [triggerElement, ...overlays] = Children.toArray(children);
    const contextValue = useMemo(() => ({ delay, closeDelay }), [delay, closeDelay]);

    return (
        <BaseMenu.SubmenuRoot
            open={isOpen}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange ? (nextOpen: boolean) => onOpenChange(nextOpen) : undefined}
        >
            <SubmenuContext.Provider value={contextValue}>{triggerElement}</SubmenuContext.Provider>
            {overlays}
        </BaseMenu.SubmenuRoot>
    );
};

/* ---------------------------------------------------------------------------------------------- */

export const Dropdown = {
    Root: DropdownRoot,
    Popover: DropdownPopover,
    Menu: DropdownMenu,
    Section: DropdownSection,
    SectionHeader: DropdownSectionHeader,
    Item: DropdownItem,
    Separator: DropdownSeparator,
    DotsButton: DropdownDotsButton,
    /** Groups a nested menu: a `Dropdown.Item` trigger followed by its `Dropdown.Popover`. */
    Submenu: DropdownSubmenu,
};
