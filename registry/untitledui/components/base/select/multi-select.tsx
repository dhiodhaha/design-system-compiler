/* Adopted from untitleduico/react@8b7409c078f8 — components/base/select/multi-select.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `DialogTrigger`/`Dialog`/`Popover`/
 * `Autocomplete`/`SearchField`/`ListBox` are replaced by `@base-ui/react@1.8.0`'s Combobox in `multiple` mode
 * (Root > Trigger | Portal > Positioner > Popup(Input + Empty + List) ) wrapped in `Field.Root`, with the search
 * input living inside the popup (Base UI's input-in-dialog composition: dialog-role popup, combobox trigger,
 * focus moved to the search input). React Aria's `Selection` (`"all" | Set<Key>`) still types the public props
 * and is bridged to Base UI's value array; filtering moves to Base UI's `items` + collator filter, which matches
 * React Aria's `useFilter({ sensitivity: "base" })` — the unit record is
 * .design-compiler/base-ui-migration/units/select-family.json. */
"use client";

import { Combobox as BaseCombobox, type ComboboxRootChangeEventDetails } from "@base-ui/react/combobox";
import { Field } from "@base-ui/react/field";
import type { FC, CSSProperties, ReactNode, RefAttributes } from "react";
import { isValidElement, useMemo, useState } from "react";
import { ChevronDown, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";
import { popoverPositionerProps } from "./popover";
import { SelectItem, SelectItemOwnerContext } from "./select-item";
import { type CommonProps, SelectContext, type SelectItemType, sizes } from "./select-shared";

/** React Aria's `Key`: the identity of an item. */
type MultiSelectKey = string | number;

/** React Aria's `Selection`: every key, or the selected subset. */
type Selection = "all" | Set<MultiSelectKey>;

const searchSizes = {
    sm: { wrapper: "py-1", root: "px-3 py-2 gap-2 *:data-icon:size-4 *:data-icon:stroke-[2.25px]", text: "text-sm" },
    md: { wrapper: "py-0.5", root: "px-3 py-2 gap-2 *:data-icon:size-5", text: "text-md" },
    lg: { wrapper: "py-0.5", root: "px-3.5 py-2.5 gap-2 *:data-icon:size-5", text: "text-md" },
};

const footerButtonSize = {
    sm: "xs" as const,
    md: "sm" as const,
    lg: "sm" as const,
};

const popoverMaxHeights = {
    sm: "max-h-68",
    md: "max-h-76",
    lg: "max-h-92",
};

interface MultiSelectFooterProps {
    /**
     * The size of the footer buttons.
     * @default "sm"
     */
    size?: "sm" | "md" | "lg";
    /** Handler that is called when the reset button is clicked. */
    onReset?: () => void;
    /** Handler that is called when the select all button is clicked. */
    onSelectAll?: () => void;
    /** Additional class name. */
    className?: string;
}

const MultiSelectFooter = ({ size = "sm", onReset, onSelectAll, className }: MultiSelectFooterProps) => {
    const btnSize = footerButtonSize[size];

    return (
        <div className={cx("flex items-center justify-between border-t border-secondary p-3", className)}>
            <Button size={btnSize} color="secondary" onClick={onReset}>
                Reset
            </Button>
            <Button size={btnSize} color="secondary" onClick={onSelectAll}>
                Select all
            </Button>
        </div>
    );
};

interface MultiSelectEmptyStateProps {
    /**
     * The title to display.
     * @default "No results found"
     */
    title?: string;
    /**
     * The description to display.
     * @default "Please try a different search term."
     */
    description?: string;
    /** Handler that is called when the clear search button is clicked. */
    onClearSearch?: () => void;
    /** Additional class name. */
    className?: string;
}

const MultiSelectEmptyState = ({
    title = "No results found",
    description = "Please try a different search term.",
    onClearSearch,
    className,
}: MultiSelectEmptyStateProps) => (
    <div className={cx("flex flex-col items-center gap-3 px-4 py-4", className)}>
        <div className="flex flex-col items-center gap-3">
            <FeaturedIcon icon={SearchLg} size="sm" color="gray" theme="modern" />
            <div className="flex flex-col items-center gap-0.5 text-center text-sm">
                <p className="font-semibold text-primary">{title}</p>
                <p className="text-tertiary">{description}</p>
            </div>
        </div>
        {onClearSearch && (
            <Button size="sm" color="link-color" onClick={onClearSearch}>
                Clear search
            </Button>
        )}
    </div>
);

interface MultiSelectProps extends RefAttributes<HTMLDivElement>, CommonProps {
    /** The items to display in the listbox. */
    items?: SelectItemType[];
    /** The children to render for each item. */
    children: ReactNode | ((item: SelectItemType) => ReactNode);
    /** The currently selected keys (controlled). */
    selectedKeys?: Selection;
    /** The initial selected keys (uncontrolled). */
    defaultSelectedKeys?: Selection;
    /** Handler that is called when the selection changes. */
    onSelectionChange?: (keys: Selection) => void;
    /** Whether the select is disabled. */
    isDisabled?: boolean;
    /** Whether the select is required. */
    isRequired?: boolean;
    /** Whether the select is in an invalid state. */
    isInvalid?: boolean;
    /** Additional class name for the popover. */
    popoverClassName?: string;
    /** Additional class name for the root element. */
    className?: string;
    /** Handler that is called when the reset button is clicked. */
    onReset?: () => void;
    /** Handler that is called when the select all button is clicked. */
    onSelectAll?: () => void;
    /**
     * Whether to show the footer with reset and select all buttons.
     * @default true
     */
    showFooter?: boolean;
    /**
     * Whether to show the search input in the popover.
     * @default true
     */
    showSearch?: boolean;
    /** The title to display when no items match the search. */
    emptyStateTitle?: string;
    /** The description to display when no items match the search. */
    emptyStateDescription?: string;
    /** Custom formatter for the selected count text in the trigger. */
    selectedCountFormatter?: (count: number) => ReactNode;
    /** Supporting text displayed next to the selected count in the trigger. */
    supportingText?: ReactNode;
    /** Leading icon rendered in the trigger, before the placeholder / selected count. Matches `Select`'s `icon`. */
    icon?: FC | ReactNode;
    /** Sets the open state of the listbox (controlled). */
    isOpen?: boolean;
    /** Sets the default open state of the listbox (uncontrolled). */
    defaultOpen?: boolean;
    /** Handler that is called when the open state changes. */
    onOpenChange?: (isOpen: boolean) => void;
    /** Identifies the field when a form is submitted. */
    name?: string;
    /** The id of the select. */
    id?: string;
    style?: CSSProperties;
}

const MultiSelectRoot = ({
    items,
    children,
    size = "md",
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    isDisabled,
    isRequired,
    isInvalid,
    placeholder = "Select",
    label,
    hint,
    tooltip,
    hideRequiredIndicator,
    popoverClassName,
    className,
    onReset,
    onSelectAll,
    showFooter = true,
    showSearch = true,
    emptyStateTitle,
    emptyStateDescription,
    selectedCountFormatter,
    supportingText,
    icon,
    isOpen,
    defaultOpen,
    onOpenChange,
    name,
    id,
    ref,
    style,
}: MultiSelectProps) => {
    const itemsById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);
    const allKeys = useMemo(() => (items ?? []).map((item) => item.id), [items]);

    // React Aria's `Selection` is either "all" or a key set; Base UI selects with an array of item values, so the
    // two representations are converted at this boundary.
    const selectedKeySet = useMemo(
        () => (selectedKeys === undefined ? undefined : selectedKeys === "all" ? new Set(allKeys) : new Set(selectedKeys)),
        [selectedKeys, allKeys],
    );

    const [uncontrolledKeys, setUncontrolledKeys] = useState<Set<MultiSelectKey>>(() =>
        defaultSelectedKeys === undefined ? new Set() : defaultSelectedKeys === "all" ? new Set(allKeys) : new Set(defaultSelectedKeys),
    );

    const activeKeySet = selectedKeySet ?? uncontrolledKeys;
    const selectedValue = useMemo(
        () => Array.from(activeKeySet).map((key) => itemsById.get(key) ?? { id: key }),
        [activeKeySet, itemsById],
    );

    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
    const open = isOpen ?? uncontrolledOpen;

    const [searchValue, setSearchValue] = useState("");

    const selectedCount = selectedValue.length;
    const hasSelection = selectedCount > 0;

    // Capitalized alias so a function-component icon can be rendered as JSX (mirrors Select).
    const Icon = icon;

    const handleValueChange = (nextValue: SelectItemType[]) => {
        const nextKeys = new Set(nextValue.map((item) => item.id));
        if (selectedKeys === undefined) {
            setUncontrolledKeys(nextKeys);
        }
        // React Aria collapsed a full selection into `"all"`; keep that shape for consumers.
        onSelectionChange?.(nextKeys.size === allKeys.length && allKeys.every((key) => nextKeys.has(key)) ? "all" : nextKeys);
    };

    const handleOpenChange = (nextOpen: boolean, details?: ComboboxRootChangeEventDetails) => {
        // React Aria's multi-select consumed the first Escape twice over: its search field cleared a non-empty
        // query, and the multiple listbox then cleared the selection (its default `escapeKeyBehavior`), so the
        // popup only closed once there was nothing left to clear.
        if (!nextOpen && details?.reason === "escape-key") {
            if (searchValue !== "") {
                setSearchValue("");
                return;
            }
            if (activeKeySet.size > 0) {
                if (selectedKeys === undefined) {
                    setUncontrolledKeys(new Set());
                }
                onSelectionChange?.(new Set());
                return;
            }
        }

        if (isOpen === undefined) {
            setUncontrolledOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };

    return (
        <Field.Root
            disabled={isDisabled}
            invalid={isInvalid}
            ref={ref}
            render={<div style={style} data-open={open || undefined} className={cx("flex flex-col gap-1.5", className)} />}
        >
            <SelectContext.Provider value={{ size }}>
                <SelectItemOwnerContext.Provider value="combobox">
                <BaseCombobox.Root
                    multiple
                    items={items}
                    value={selectedValue}
                    onValueChange={handleValueChange}
                    // Base UI matches values by identity; React Aria matched keys, so equality follows the key.
                    isItemEqualToValue={(itemValue, valueToCompare) => itemValue === valueToCompare || itemValue?.id === valueToCompare?.id}
                    itemToStringLabel={(itemValue) => itemValue?.label ?? String(itemValue?.id ?? "")}
                    itemToStringValue={(itemValue) => String(itemValue?.id ?? "")}
                    inputValue={searchValue}
                    onInputValueChange={setSearchValue}
                    open={open}
                    onOpenChange={handleOpenChange}
                    modal={false}
                    disabled={isDisabled}
                    required={isRequired}
                    name={name}
                    id={id}
                >
                    {label && (
                        <Label isRequired={hideRequiredIndicator ? false : isRequired} isInvalid={isInvalid} tooltip={tooltip}>
                            {label}
                        </Label>
                    )}

                    <BaseCombobox.Trigger
                        className={cx(
                            "relative flex w-full cursor-pointer items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary outline-hidden transition duration-100 ease-linear ring-inset",

                            // React Aria's `isFocusVisible || isPressed` ring. The trigger is a native button, so
                            // focus-visible stays a native selector; Base UI reports the open/pressed states.
                            "focus-visible:ring-2 focus-visible:ring-brand",
                            "data-pressed:ring-2 data-pressed:ring-brand",
                            "data-disabled:cursor-not-allowed data-disabled:opacity-50",
                        )}
                    >
                        <span
                            className={cx(
                                "flex w-full items-center truncate text-left",
                                sizes[size].root,
                                "*:data-icon:shrink-0 *:data-icon:text-fg-quaternary",
                            )}
                        >
                            {isReactComponent(Icon) ? <Icon data-icon aria-hidden="true" /> : isValidElement(Icon) ? Icon : null}

                            {hasSelection ? (
                                <span className={cx("flex items-center", sizes[size].textContainer)}>
                                    <span className={cx("font-medium text-primary", sizes[size].text)}>
                                        {selectedCountFormatter ? selectedCountFormatter(selectedCount) : `${selectedCount} selected`}
                                    </span>
                                    {supportingText && <span className={cx("text-tertiary", sizes[size].text)}>{supportingText}</span>}
                                </span>
                            ) : (
                                <span className={cx("text-placeholder", sizes[size].text)}>{placeholder}</span>
                            )}

                            <ChevronDown
                                aria-hidden="true"
                                className={cx("ml-auto shrink-0 text-fg-quaternary", size === "lg" ? "size-5" : "size-4 stroke-[2.25px]")}
                            />
                        </span>
                    </BaseCombobox.Trigger>

                    <BaseCombobox.Portal>
                        <BaseCombobox.Positioner {...popoverPositionerProps}>
                            <BaseCombobox.Popup
                                className={cx(
                                    "w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-primary shadow-lg ring-1 ring-secondary_alt outline-hidden will-change-transform",
                                    "data-open:duration-150 data-open:ease-out data-open:animate-in data-open:fade-in",
                                    "data-open:data-[side=top]:slide-in-from-bottom-0.5 data-open:data-[side=bottom]:slide-in-from-top-0.5",
                                    "data-ending-style:duration-100 data-ending-style:ease-in data-ending-style:animate-out data-ending-style:fade-out",
                                    "data-ending-style:data-[side=top]:slide-out-to-bottom-0.5 data-ending-style:data-[side=bottom]:slide-out-to-top-0.5",
                                    popoverClassName,
                                )}
                            >
                                {showSearch && (
                                    <div className={cx("border-b border-secondary", searchSizes[size].wrapper)}>
                                        <div className={cx("flex items-center", searchSizes[size].root)}>
                                            <SearchLg data-icon aria-hidden="true" className="shrink-0 text-fg-quaternary" />
                                            <BaseCombobox.Input
                                                aria-label="Search"
                                                placeholder="Search"
                                                className={cx(
                                                    "w-full appearance-none bg-transparent text-primary caret-alpha-black/90 outline-hidden placeholder:text-placeholder",
                                                    searchSizes[size].text,
                                                )}
                                            />
                                        </div>
                                    </div>
                                )}

                                <BaseCombobox.Empty>
                                    <MultiSelectEmptyState
                                        title={emptyStateTitle}
                                        description={emptyStateDescription}
                                        onClearSearch={searchValue ? () => setSearchValue("") : undefined}
                                    />
                                </BaseCombobox.Empty>

                                <BaseCombobox.List
                                    aria-label={label || "Options"}
                                    className={cx("overflow-y-auto py-1 outline-hidden", popoverMaxHeights[size])}
                                >
                                    {children}
                                </BaseCombobox.List>

                                {showFooter && <MultiSelectFooter size={size} onReset={onReset} onSelectAll={onSelectAll} />}
                            </BaseCombobox.Popup>
                        </BaseCombobox.Positioner>
                    </BaseCombobox.Portal>
                </BaseCombobox.Root>
                </SelectItemOwnerContext.Provider>

                {hint && (
                    <HintText isInvalid={isInvalid} className={cx(size === "sm" && "text-xs")}>
                        {hint}
                    </HintText>
                )}
            </SelectContext.Provider>
        </Field.Root>
    );
};

const MultiSelect = MultiSelectRoot as typeof MultiSelectRoot & {
    Item: typeof SelectItem;
    Footer: typeof MultiSelectFooter;
    EmptyState: typeof MultiSelectEmptyState;
};

MultiSelect.Item = SelectItem;
MultiSelect.Footer = MultiSelectFooter;
MultiSelect.EmptyState = MultiSelectEmptyState;

export { MultiSelect };
