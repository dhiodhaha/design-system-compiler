/* Adopted from untitleduico/react@8b7409c078f8 — components/base/select/tag-select.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `ComboBox`/`Group`/`Input`/`ListBox` plus its
 * `useListData`/`useFilter`/`useFocusManager` helpers are replaced by `@base-ui/react@1.8.0`'s Combobox in
 * `multiple` mode (Root > InputGroup(Input) > Portal > Positioner > Popup > List) wrapped in `Field.Root`. The
 * consumer's `selectedItems` list stays the source of truth (Base UI's value is controlled from it, and the
 * added/removed diff drives `selectedItems.append`/`remove` and the `onItemInserted`/`onItemCleared` callbacks),
 * the already-selected items are filtered out locally while Base UI matches the query, and the payload's own
 * tag/chip markup and focus traversal are kept — the unit record is
 * .design-compiler/base-ui-migration/units/select-family.json. */
"use client";

import { Combobox as BaseCombobox, type ComboboxInputGroupState, type ComboboxRootChangeEventDetails } from "@base-ui/react/combobox";
import { Field } from "@base-ui/react/field";
import type { ComponentPropsWithoutRef, CSSProperties, KeyboardEvent, ReactNode, RefAttributes } from "react";
import { createContext, useContext, useMemo, useRef, useState } from "react";
import { SearchLg } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import type { IconComponentType } from "@/components/base/badges/badge-types";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { popoverPopupClassName, popoverPositionerProps } from "@/components/base/select/popover";
import { SelectContext, type SelectItemType, sizes } from "@/components/base/select/select-shared";
import { TagCloseX } from "@/components/base/tags/base-components/tag-close-x";
import { cx } from "@/utils/cx";
import { SelectItem } from "./select-item";

/** React Aria's `Key`: the identity of an item. */
type Key = string | number;

/**
 * The subset of react-stately's `ListData<SelectItemType>` this component drives: it reads the selected items and
 * appends/removes as the selection changes. A `useListData()` result satisfies it as-is.
 */
interface TagSelectListData<T> {
    readonly items: T[];
    append(...items: T[]): void;
    remove(...keys: Key[]): void;
    getItem(key: Key): T | undefined;
    setFilterText(filterText: string): void;
    readonly filterText: string;
}

interface TagSelectValueProps
    extends Omit<ComponentPropsWithoutRef<typeof BaseCombobox.InputGroup>, "className" | "style" | "children" | "render">,
        RefAttributes<HTMLDivElement> {
    size: "sm" | "md" | "lg";
    shortcut?: boolean;
    isDisabled?: boolean;
    placeholder?: string;
    shortcutClassName?: string;
    icon?: IconComponentType | null;
    className?: string | ((state: ComboboxInputGroupState) => string | undefined);
    style?: CSSProperties;
}

const TagSelectContext = createContext<{
    selectedKeys: Key[];
    selectedItems: TagSelectListData<SelectItemType>;
    onRemove: (keys: Set<Key>) => void;
    onInputChange: (value: string) => void;
    /** Opens the listbox popup — React Aria's `menuTrigger="focus"`. */
    onOpen: () => void;
    /** Closes the listbox popup — React Aria's `ComboBoxStateContext.close()`. */
    onClose: () => void;
    valueFormatter?: (item: SelectItemType) => string;
}>({
    selectedKeys: [],
    selectedItems: { items: [], append: () => {}, remove: () => {}, getItem: () => undefined, setFilterText: () => {}, filterText: "" },
    onRemove: () => {},
    onInputChange: () => {},
    onOpen: () => {},
    onClose: () => {},
});

interface TagSelectProps extends RefAttributes<HTMLDivElement> {
    hint?: string;
    label?: string;
    tooltip?: string;
    size?: "sm" | "md" | "lg";
    placeholder?: string;
    shortcut?: boolean;
    items?: SelectItemType[];
    popoverClassName?: string;
    shortcutClassName?: string;
    selectedItems: TagSelectListData<SelectItemType>;
    icon?: IconComponentType | null;
    children: ReactNode | ((item: SelectItemType) => ReactNode);
    onItemCleared?: (key: Key) => void;
    onItemInserted?: (key: Key) => void;
    valueFormatter?: (item: SelectItemType) => string;
    /** Whether the select is disabled. */
    isDisabled?: boolean;
    /** Whether the select is required. */
    isRequired?: boolean;
    /** Whether the select is in an invalid state. */
    isInvalid?: boolean;
    /** Sets the open state of the listbox (controlled). */
    isOpen?: boolean;
    /** Sets the default open state of the listbox (uncontrolled). */
    defaultOpen?: boolean;
    /** Handler that is called when the open state changes. */
    onOpenChange?: (isOpen: boolean) => void;
    /** The id of the select. */
    id?: string;
    /** Accepted for React Aria compatibility; the payload never submitted the tag select's value by name. */
    name?: string;
    className?: string | ((state: { isOpen: boolean; isDisabled: boolean; isInvalid: boolean; isRequired: boolean }) => string | undefined);
    style?: CSSProperties;
}

export const TagSelectBase = ({
    items,
    children,
    size = "sm",
    selectedItems,
    onItemCleared,
    onItemInserted,
    valueFormatter,
    shortcut,
    placeholder = "Search",
    icon,
    hint,
    label,
    tooltip,
    popoverClassName,
    shortcutClassName,
    isDisabled,
    isRequired,
    isInvalid,
    isOpen,
    defaultOpen,
    onOpenChange,
    id,
    className,
    style,
    ref,
    // Omit name to avoid conflicts with the `Select` component
    name: _name,
    ...props
}: TagSelectProps) => {
    const selectedKeys = selectedItems.items.map((item) => item.id);

    // React Aria built the accessible list with `useListData` and a filter that dropped the already-selected
    // items before matching the query; Base UI matches the query itself, so only the exclusion is projected here.
    const availableItems = useMemo(() => {
        const selectedKeySet = new Set(selectedKeys);
        return (items ?? []).filter((item) => !selectedKeySet.has(item.id));
    }, [items, selectedKeys]);

    const [filterText, setFilterText] = useState("");
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
    const open = isOpen ?? uncontrolledOpen;

    // React Aria's tag select closed the listbox when an item was picked; the popup staying open is what makes
    // picking several tags in a row possible, so the close request that follows a selection is swallowed once.
    const keepOpenRef = useRef(false);

    const tagSelectState = {
        isOpen: open,
        isDisabled: Boolean(isDisabled),
        isInvalid: Boolean(isInvalid),
        isRequired: Boolean(isRequired),
    };

    const onRemove = (keys: Set<Key>) => {
        const key = keys.values().next().value;

        if (!key) return;

        selectedItems.remove(key);
        onItemCleared?.(key);
    };

    const handleValueChange = (nextValue: SelectItemType[], details: ComboboxRootChangeEventDetails) => {
        // React Aria's tag select never cleared the selection on Escape; Base UI does when the popup is closed.
        if (details.reason === "escape-key") {
            details.cancel();
            return;
        }

        const previousItems = selectedItems.items;

        nextValue.forEach((item) => {
            if (!previousItems.some((previous) => previous.id === item.id)) {
                selectedItems.append(item);
                onItemInserted?.(item.id);
            }
        });

        previousItems.forEach((item) => {
            if (!nextValue.some((next) => next.id === item.id)) {
                selectedItems.remove(item.id);
                onItemCleared?.(item.id);
            }
        });

        // React Aria cleared the filter text after a selection and left the popup open for the next tag.
        setFilterText("");
        keepOpenRef.current = true;
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && keepOpenRef.current) {
            keepOpenRef.current = false;
            return;
        }
        if (isOpen === undefined) {
            setUncontrolledOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };

    return (
        <TagSelectContext.Provider
            value={{
                selectedKeys,
                selectedItems,
                onInputChange: setFilterText,
                onRemove,
                onOpen: () => handleOpenChange(true),
                onClose: () => handleOpenChange(false),
                valueFormatter,
            }}
        >
            <SelectContext.Provider value={{ size }}>
                <Field.Root
                    disabled={isDisabled}
                    invalid={isInvalid}
                    ref={ref}
                    render={<div style={style} data-open={open || undefined} className={cx("flex flex-col gap-1.5", typeof className === "function" ? className(tagSelectState) : className)} />}
                >
                    <BaseCombobox.Root
                        multiple
                        items={availableItems}
                        value={selectedItems.items}
                        onValueChange={handleValueChange}
                        // Base UI matches values by identity; React Aria matched keys, so equality follows the key.
                        isItemEqualToValue={(itemValue, valueToCompare) => itemValue === valueToCompare || itemValue?.id === valueToCompare?.id}
                        // React Aria filtered on the label, falling back to the supporting text.
                        itemToStringLabel={(itemValue) => itemValue?.label || itemValue?.supportingText || ""}
                        itemToStringValue={(itemValue) => String(itemValue?.id ?? "")}
                        inputValue={filterText}
                        onInputValueChange={setFilterText}
                        open={open}
                        onOpenChange={handleOpenChange}
                        modal={false}
                        disabled={isDisabled}
                        required={isRequired}
                        id={id}
                    >
                        {label && (
                            <Label isRequired={isRequired} tooltip={tooltip}>
                                {label}
                            </Label>
                        )}

                        <TagSelectTagsValue size={size} shortcut={shortcut} placeholder={placeholder} icon={icon} shortcutClassName={shortcutClassName} />

                        <BaseCombobox.Portal>
                            <BaseCombobox.Positioner {...popoverPositionerProps}>
                                <BaseCombobox.Popup className={cx(popoverPopupClassName(size), popoverClassName)}>
                                    <BaseCombobox.List className="size-full outline-hidden">{children}</BaseCombobox.List>
                                </BaseCombobox.Popup>
                            </BaseCombobox.Positioner>
                        </BaseCombobox.Portal>

                        {hint && (
                            <HintText isInvalid={isInvalid} className={cx(size === "sm" && "text-xs")}>
                                {hint}
                            </HintText>
                        )}
                    </BaseCombobox.Root>
                </Field.Root>
            </SelectContext.Provider>
        </TagSelectContext.Provider>
    );
};

interface InnerTagSelectProps {
    isDisabled?: boolean;
    shortcut?: boolean;
    shortcutClassName?: string;
    placeholder?: string;
    size?: "sm" | "md" | "lg";
}

const InnerTagSelect = ({ isDisabled, shortcut, shortcutClassName, placeholder, size = "sm" }: InnerTagSelectProps) => {
    const tagSelectContext = useContext(TagSelectContext);
    const containerRef = useRef<HTMLDivElement>(null);

    // React Aria's `useFocusManager` moved focus between the tags and the input; that traversal is the DOM order
    // of the group's buttons followed by its input, so the same moves are expressed against the container.
    const moveFocus = (from: HTMLElement, direction: -1 | 1) => {
        const focusable = Array.from(containerRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []);
        focusable[focusable.indexOf(from) + direction]?.focus();
    };

    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const isCaretAtStart = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0;

        if (!isCaretAtStart && event.currentTarget.value !== "") {
            return;
        }

        switch (event.key) {
            case "Backspace":
            case "ArrowLeft":
                moveFocus(event.currentTarget, -1);
                break;
            case "ArrowRight":
                moveFocus(event.currentTarget, 1);
                break;
        }
    };

    const handleTagKeyDown = (event: KeyboardEvent<HTMLButtonElement>, value: Key) => {
        // Do nothing when tab is clicked to move focus from the tag to the input element.
        if (event.key === "Tab") {
            return;
        }

        event.preventDefault();

        const isFirstTag = tagSelectContext?.selectedItems?.items?.[0]?.id === value;

        switch (event.key) {
            case " ":
            case "Enter":
            case "Backspace":
                if (isFirstTag) {
                    moveFocus(event.currentTarget, 1);
                } else {
                    moveFocus(event.currentTarget, -1);
                }

                tagSelectContext.onRemove(new Set([value]));
                break;

            case "ArrowLeft":
                moveFocus(event.currentTarget, -1);
                break;
            case "ArrowRight":
                moveFocus(event.currentTarget, 1);
                break;
            case "Escape":
                tagSelectContext.onClose();
                break;
        }
    };

    const isSelectionEmpty = tagSelectContext?.selectedItems?.items?.length === 0;

    return (
        <div ref={containerRef} className="relative flex w-full min-w-0 flex-1 flex-row flex-wrap items-center justify-start gap-1.5">
            {!isSelectionEmpty &&
                tagSelectContext?.selectedItems?.items?.map((value) => (
                    <span
                        key={value.id}
                        className={cx(
                            "flex min-w-0 items-center rounded-md bg-primary ring-1 ring-primary ring-inset",
                            size === "sm" ? "px-1 py-0.75" : "py-0.5 pr-1 pl-1.25",
                        )}
                    >
                        <Avatar size="xs" alt={value?.label} src={value?.avatarUrl} className="size-4" />

                        <p
                            className={cx(
                                "truncate font-medium whitespace-nowrap text-secondary select-none",
                                size === "sm" ? "ml-1 text-xs" : "ml-1.25 text-sm",
                            )}
                        >
                            {tagSelectContext.valueFormatter ? tagSelectContext.valueFormatter(value) : value?.label}
                        </p>

                        <TagCloseX
                            size={size === "sm" ? "sm" : "md"}
                            isDisabled={isDisabled}
                            className="ml-0.75"
                            // For workaround, onKeyDown is added to the button
                            onKeyDown={(event) => handleTagKeyDown(event, value.id)}
                            onPress={() => tagSelectContext.onRemove(new Set([value.id]))}
                        />
                    </span>
                ))}

            <div className={cx("relative flex min-w-12 flex-1 flex-row items-center", !isSelectionEmpty && "ml-0.5", shortcut && "min-w-[30%]")}>
                <BaseCombobox.Input
                    placeholder={placeholder}
                    onKeyDown={handleInputKeyDown}
                    // React Aria's `menuTrigger="focus"` opened the listbox as soon as the input was focused.
                    onFocus={() => tagSelectContext.onOpen()}
                    className={cx(
                        "w-full flex-[1_0_0] appearance-none bg-transparent text-ellipsis text-primary caret-alpha-black/90 outline-hidden placeholder:text-placeholder focus:outline-hidden disabled:cursor-not-allowed",
                        sizes[size].text,
                    )}
                />

                {shortcut && (
                    <div
                        aria-hidden="true"
                        className={cx(
                            "absolute inset-y-0.5 right-0.5 z-10 hidden items-center rounded-r-[inherit] bg-linear-to-r from-transparent to-bg-primary to-40% pl-8 md:flex",
                            shortcutClassName,
                            sizes[size].shortcut,
                        )}
                    >
                        <span
                            className={cx(
                                "pointer-events-none rounded px-1 py-px text-xs font-medium text-quaternary ring-1 ring-secondary select-none ring-inset",
                                isDisabled && "bg-transparent",
                            )}
                        >
                            ⌘K
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const TagSelectTagsValue = ({
    size = "sm",
    shortcut,
    placeholder,
    shortcutClassName,
    icon: Icon = SearchLg,
    className,
    // Omit this prop to avoid invalid HTML attribute warning
    isDisabled: _isDisabled,
    ...otherProps
}: TagSelectValueProps) => {
    const tagSelectContext = useContext(TagSelectContext);

    const selectedItemsCount = tagSelectContext.selectedKeys.length;

    return (
        <BaseCombobox.InputGroup
            {...otherProps}
            className={(state) =>
                cx(
                    "relative flex w-full items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary outline-hidden transition duration-100 ease-linear ring-inset",

                    // React Aria's `isFocusWithin`/`isDisabled` group state, on Base UI's field state.
                    state.disabled && "cursor-not-allowed opacity-50",
                    state.focused && "ring-2 ring-brand",

                    // Icon styles
                    "*:data-icon:shrink-0 *:data-icon:text-fg-quaternary",

                    sizes[size].root,

                    // Overwrite vertical padding for small size when there are selected items
                    // to prevent height jump because the tags are taller than the input text.
                    size === "sm" && selectedItemsCount > 0 && "py-1.5",

                    typeof className === "function" ? className(state) : className,
                )
            }
            render={(groupProps, state) => (
                <div {...groupProps}>
                    {Icon && <Icon data-icon className="pointer-events-none" />}
                    <InnerTagSelect
                        isDisabled={state.disabled}
                        size={size}
                        shortcut={shortcut}
                        shortcutClassName={shortcutClassName}
                        placeholder={placeholder}
                    />
                </div>
            )}
        />
    );
};

const TagSelect = TagSelectBase as typeof TagSelectBase & {
    Item: typeof SelectItem;
};

TagSelect.Item = SelectItem;

export { TagSelect };
