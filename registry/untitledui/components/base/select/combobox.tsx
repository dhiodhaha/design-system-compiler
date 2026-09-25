/* Adopted from untitleduico/react@8b7409c078f8 — components/base/select/combobox.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `ComboBox`/`Group`/`Input`/`ListBox` are
 * replaced by `@base-ui/react@1.8.0`'s Combobox composition (Root > InputGroup(Input) > Portal > Positioner >
 * Popup > List > Item) wrapped in `Field.Root` so the payload's Label/HintText keep their control association.
 * Filtering moves from React Aria's collection filter to Base UI's `items` + `filter`, the selected value and
 * the typed text are the two independent controlled pairs Base UI exposes, and the React Aria class variants
 * that never matched without `data-rac` are re-pointed at Base UI's attributes — the unit record is
 * .design-compiler/base-ui-migration/units/select-family.json. */
"use client";

import { Field } from "@base-ui/react/field";
import { Combobox as BaseCombobox, type ComboboxInputGroupState } from "@base-ui/react/combobox";
import type { CSSProperties, FocusEventHandler, FC, ReactNode, Ref, RefAttributes } from "react";
import { isValidElement, useMemo, useState } from "react";
import { SearchLg } from "@untitledui/icons";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { type CommonProps, SelectContext, type SelectItemType, sizes } from "@/components/base/select/select-shared";
import { popoverPopupClassName, popoverPositionerProps } from "@/components/base/select/popover";
import { SelectItem } from "@/components/base/select/select-item";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";

/** React Aria's `Key`: the identity of an item. */
type ComboBoxKey = string | number;

/**
 * The render-prop state React Aria handed to `ComboBox`'s `className`, rebuilt from the props Base UI's root
 * receives (`isReadOnly` stays `undefined` because the payload's combo box is never read-only).
 */
interface ComboBoxRenderState {
    isOpen: boolean;
    isDisabled: boolean;
    isInvalid: boolean;
    isRequired: boolean;
    isReadOnly: boolean;
}

export interface ComboBoxProps extends RefAttributes<HTMLDivElement>, CommonProps {
    shortcut?: boolean;
    items?: SelectItemType[];
    popoverClassName?: string;
    shortcutClassName?: string;
    /** Leading icon component displayed before the input. */
    icon?: FC | ReactNode;
    children: ReactNode | ((item: SelectItemType) => ReactNode);
    /** The currently selected key (controlled). */
    selectedKey?: ComboBoxKey | null;
    /** The initial selected key (uncontrolled). */
    defaultSelectedKey?: ComboBoxKey | null;
    /** The currently selected key (controlled) — React Aria's alias of `selectedKey`. */
    value?: ComboBoxKey | null;
    /** The initial selected key (uncontrolled) — React Aria's alias of `defaultSelectedKey`. */
    defaultValue?: ComboBoxKey | null;
    /** Handler that is called when the selection changes. */
    onSelectionChange?: (key: ComboBoxKey | null) => void;
    /** Handler that is called when the selection changes — React Aria's alias of `onSelectionChange`. */
    onChange?: (key: ComboBoxKey | null) => void;
    /** The value of the input (controlled). */
    inputValue?: string;
    /** The default value of the input (uncontrolled). */
    defaultInputValue?: string;
    /** Handler that is called when the input value changes. */
    onInputChange?: (value: string) => void;
    /** Sets the open state of the listbox (controlled). */
    isOpen?: boolean;
    /** Sets the default open state of the listbox (uncontrolled). */
    defaultOpen?: boolean;
    /** Handler that is called when the open state changes. */
    onOpenChange?: (isOpen: boolean) => void;
    /** The interaction that displays the listbox. */
    menuTrigger?: "focus" | "input" | "manual";
    /** The filter function used to determine if an option should be included in the list. */
    defaultFilter?: (textValue: string, inputValue: string) => boolean;
    /** Whether the key or the text of the selected item is submitted as part of an HTML form. */
    formValue?: "text" | "key";
    /** Whether keyboard navigation is circular. */
    shouldFocusWrap?: boolean;
    /** Whether the combo box allows a non-item matching input value to be set — Base UI has no equivalent. */
    allowsCustomValue?: boolean;
    /** Whether the combo box allows the menu to be open when the collection is empty. */
    allowsEmptyCollection?: boolean;
    /** Whether the input should be focused on mount. */
    autoFocus?: boolean;
    /** Whether the combo box is disabled. */
    isDisabled?: boolean;
    /** Whether the user must select a value before submitting a form. */
    isRequired?: boolean;
    /** Whether the combo box is in an invalid state. */
    isInvalid?: boolean;
    /** Identifies the field when a form is submitted. */
    name?: string;
    /** The `<form>` element to associate the hidden input with. */
    form?: string;
    /** Provides a hint to the browser for autofill. */
    autoComplete?: string;
    /** The id of the combo box. */
    id?: string;
    className?: string | ((state: ComboBoxRenderState) => string | undefined);
    style?: CSSProperties;
}

/** React Aria matched the filter and the input text against an item's `textValue`: its label plus supporting text. */
const itemTextValue = (item: SelectItemType | null | undefined) =>
    item ? (item.supportingText ? `${item.label ?? ""} ${item.supportingText}`.trim() : item.label ?? String(item.id)) : "";

interface ComboBoxValueProps {
    size: "sm" | "md" | "lg";
    shortcut: boolean;
    placeholder?: string;
    shortcutClassName?: string;
    icon?: FC | ReactNode;
    /** The typed text, mirrored behind the transparent input so the value can be styled per part. */
    inputValue: string;
    /** The selected item, whose supporting text is mirrored in a lighter colour. */
    selectedItem: SelectItemType | null;
    autoFocus?: boolean;
    onFocus: FocusEventHandler<HTMLDivElement>;
}

const ComboBoxValue = ({ size, shortcut, placeholder, shortcutClassName, icon: IconProp, inputValue, selectedItem, autoFocus, onFocus }: ComboBoxValueProps) => {
    const first = inputValue?.split(selectedItem?.supportingText ?? "")?.[0] || "";
    const last = inputValue?.split(first)[1];

    return (
        <BaseCombobox.InputGroup
            onFocus={onFocus}
            className={(state: ComboboxInputGroupState) =>
                cx(
                    "relative flex w-full items-center gap-2 rounded-lg bg-primary shadow-xs ring-1 ring-primary outline-hidden transition-shadow duration-100 ease-linear ring-inset",

                    // React Aria's `isFocusWithin`, on Base UI's field state: the group is focused while its input is.
                    "data-focused:ring-2 data-focused:ring-brand",
                    "data-disabled:cursor-not-allowed data-disabled:opacity-50",

                    // Icon styles
                    "*:data-icon:shrink-0 *:data-icon:text-fg-quaternary",

                    sizes[size].root,
                )
            }
        >
            {isReactComponent(IconProp) ? (
                <IconProp data-icon className="pointer-events-none" aria-hidden="true" />
            ) : isValidElement(IconProp) ? (
                IconProp
            ) : (
                <SearchLg data-icon className="pointer-events-none" aria-hidden="true" />
            )}

            <div className="relative flex w-full items-center">
                {inputValue && (
                    <span className={cx("absolute top-1/2 z-0 inline-flex w-full -translate-y-1/2 truncate", sizes[size].textContainer)} aria-hidden="true">
                        <p className={cx("font-medium text-primary", sizes[size].text)}>{first}</p>
                        {last && <p className={cx("-ml-0.75 text-tertiary", sizes[size].text)}>{last}</p>}
                    </span>
                )}

                <BaseCombobox.Input
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className={cx(
                        "z-10 w-full appearance-none bg-transparent text-transparent caret-alpha-black/90 placeholder:text-placeholder focus:outline-hidden disabled:cursor-not-allowed",
                        sizes[size].text,
                    )}
                />
            </div>

            {shortcut && (
                <div
                    className={cx(
                        "absolute inset-y-0.5 right-0.5 z-10 hidden items-center rounded-r-[inherit] bg-linear-to-r from-transparent to-bg-primary to-40% pl-8 md:flex",
                        sizes[size].shortcut,
                        shortcutClassName,
                    )}
                >
                    <span
                        className="pointer-events-none rounded px-1 py-px text-xs font-medium text-quaternary ring-1 ring-secondary select-none ring-inset"
                        aria-hidden="true"
                    >
                        ⌘K
                    </span>
                </div>
            )}
        </BaseCombobox.InputGroup>
    );
};

export const ComboBox = ({
    placeholder = "Search",
    shortcut = true,
    size = "md",
    children,
    items,
    shortcutClassName,
    icon,
    label,
    hint,
    tooltip,
    hideRequiredIndicator,
    className,
    style,
    popoverClassName,
    selectedKey,
    defaultSelectedKey,
    value: valueProp,
    defaultValue,
    onSelectionChange,
    onChange,
    inputValue: inputValueProp,
    defaultInputValue,
    onInputChange,
    isOpen,
    defaultOpen,
    onOpenChange,
    menuTrigger = "focus",
    defaultFilter,
    formValue = "key",
    shouldFocusWrap,
    autoFocus,
    isDisabled,
    isRequired,
    isInvalid,
    name,
    form,
    autoComplete,
    id,
    ref,
}: ComboBoxProps) => {
    // React Aria's `Key` vocabulary addresses items by `id`; Base UI's value is the item itself, so keys are
    // resolved through the item list, and item equality is decided by key.
    const itemsById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);

    const controlledKey = selectedKey !== undefined ? selectedKey : valueProp;
    const isSelectionControlled = controlledKey !== undefined;
    const initialKey = defaultSelectedKey !== undefined ? defaultSelectedKey : defaultValue;

    const [uncontrolledValue, setUncontrolledValue] = useState<SelectItemType | null>(() =>
        initialKey == null ? null : itemsById.get(initialKey) ?? { id: initialKey },
    );
    const selectedItem = isSelectionControlled ? (controlledKey == null ? null : itemsById.get(controlledKey) ?? { id: controlledKey }) : uncontrolledValue;

    // The typed text and the popup state are the two other pairs Base UI keeps apart from the value; they are
    // funnelled through one state each so the payload's React Aria props and className state can report them.
    const [uncontrolledInput, setUncontrolledInput] = useState(defaultInputValue ?? "");
    const inputValue = inputValueProp ?? uncontrolledInput;

    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
    const open = isOpen ?? uncontrolledOpen;

    const comboBoxState: ComboBoxRenderState = {
        isOpen: open,
        isDisabled: Boolean(isDisabled),
        isInvalid: Boolean(isInvalid),
        isRequired: Boolean(isRequired),
        isReadOnly: false,
    };

    const handleValueChange = (nextValue: SelectItemType | null | undefined) => {
        if (!isSelectionControlled) {
            setUncontrolledValue(nextValue ?? null);
        }
        const key = nextValue?.id ?? null;
        onSelectionChange?.(key);
        onChange?.(key);
    };

    const handleInputChange = (nextInputValue: string) => {
        if (inputValueProp === undefined) {
            setUncontrolledInput(nextInputValue);
        }
        onInputChange?.(nextInputValue);
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (isOpen === undefined) {
            setUncontrolledOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };

    return (
        <Field.Root
            disabled={isDisabled}
            invalid={isInvalid}
            // React Aria's root was a single element carrying the payload's classes and the state attributes;
            // `Field.Root` renders the field wrapper, so the payload's divider merges into it.
            render={<div ref={ref} style={style} data-open={open || undefined} />}
            className={cx("flex flex-col gap-1.5", typeof className === "function" ? className(comboBoxState) : className)}
        >
            <SelectContext.Provider value={{ size }}>
                <BaseCombobox.Root
                    items={items}
                    value={selectedItem}
                    onValueChange={handleValueChange}
                    // Base UI matches values by identity; React Aria matched keys, so equality follows the key.
                    isItemEqualToValue={(itemValue, valueToCompare) => itemValue === valueToCompare || itemValue?.id === valueToCompare?.id}
                    // React Aria's `textValue` (label + supporting text) is what both the filter and the input text use.
                    itemToStringLabel={itemTextValue}
                    itemToStringValue={(itemValue) => (formValue === "text" ? itemTextValue(itemValue) : String(itemValue?.id ?? ""))}
                    inputValue={inputValue}
                    onInputValueChange={handleInputChange}
                    // React Aria's `defaultFilter` compared the item's text value with the query; Base UI's filter
                    // receives the item itself, so the same comparison is restored here.
                    filter={defaultFilter ? (item: SelectItemType, query: string) => defaultFilter(itemTextValue(item), query) : undefined}
                    open={open}
                    onOpenChange={handleOpenChange}
                    openOnInputClick={menuTrigger !== "manual"}
                    // React Aria's `menuTrigger="focus"` opened the listbox as soon as the input was focused.
                    loopFocus={shouldFocusWrap}
                    modal={false}
                    disabled={isDisabled}
                    required={isRequired}
                    name={name}
                    form={form}
                    autoComplete={autoComplete}
                    id={id}
                >
                    {label && (
                        <Label isRequired={hideRequiredIndicator ? false : isRequired} tooltip={tooltip}>
                            {label}
                        </Label>
                    )}

                    <ComboBoxValue
                        size={size}
                        shortcut={shortcut}
                        shortcutClassName={shortcutClassName}
                        placeholder={placeholder}
                        icon={icon}
                        inputValue={inputValue}
                        selectedItem={selectedItem}
                        autoFocus={autoFocus}
                        onFocus={() => {
                            if (menuTrigger === "focus") {
                                handleOpenChange(true);
                            }
                        }}
                    />

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
            </SelectContext.Provider>
        </Field.Root>
    );
};
