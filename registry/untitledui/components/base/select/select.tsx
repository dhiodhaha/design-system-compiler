/* Adopted from untitleduico/react@8b7409c078f8 — components/base/select/select.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `Select`/`Button`/`SelectValue`/`ListBox` are
 * replaced by `@base-ui/react@1.8.0`'s Select composition (Root > Trigger(Value, Icon) > Portal > Positioner >
 * Popup > List > Item) wrapped in `Field.Root` so the payload's Label/HintText keep their control association.
 * Every export, prop name and default is preserved: `selectedKey`/`defaultSelectedKey`/`onSelectionChange` are
 * translated to Base UI's value pair, the React Aria className state is rebuilt from Base UI's state, and the
 * React Aria class variants that never matched without `data-rac` are re-pointed at Base UI's attributes — the
 * unit record is .design-compiler/base-ui-migration/units/select-family.json. */
"use client";

import { Field } from "@base-ui/react/field";
import { Select as BaseSelect } from "@base-ui/react/select";
import type { FC, CSSProperties, ReactNode, RefAttributes } from "react";
import { Fragment, isValidElement, useMemo, useState } from "react";
import { ChevronDown } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";
import { ComboBox } from "./combobox";
import { popoverPopupClassName, popoverPositionerProps } from "./popover";
import { SelectDisabledKeysContext, SelectItem } from "./select-item";
import { type CommonProps, SelectContext, type SelectItemType, sizes } from "./select-shared";

export { SelectContext, sizes, type CommonProps, type SelectItemType } from "./select-shared";

/** React Aria's `Key`: the identity of an item. */
type SelectKey = string | number;

/**
 * The render-prop state React Aria handed to `Select`'s `className`.
 *
 * React Aria's own state object, rebuilt from Base UI's state: `isOpen`/`isDisabled`/`isRequired` come from the
 * props, `isFocused`/`isFocusVisible` are tracked on the trigger (Base UI models focus as CSS state).
 */
interface SelectRenderState {
    isFocused: boolean;
    isFocusVisible: boolean;
    isDisabled: boolean;
    isOpen: boolean;
    isInvalid: boolean;
    isRequired: boolean;
}

export interface SelectProps extends RefAttributes<HTMLDivElement>, CommonProps {
    items?: SelectItemType[];
    popoverClassName?: string;
    icon?: FC | ReactNode;
    children: ReactNode | ((item: SelectItemType) => ReactNode);
    /** The currently selected key (controlled). */
    selectedKey?: SelectKey | null;
    /** The initial selected key (uncontrolled). */
    defaultSelectedKey?: SelectKey | null;
    /** The currently selected key (controlled) — React Aria's alias of `selectedKey`. */
    value?: SelectKey | null;
    /** The initial selected key (uncontrolled) — React Aria's alias of `defaultSelectedKey`. */
    defaultValue?: SelectKey | null;
    /** Handler that is called when the selection changes. */
    onSelectionChange?: (key: SelectKey | null) => void;
    /** Handler that is called when the selection changes — React Aria's alias of `onSelectionChange`. */
    onChange?: (key: SelectKey | null) => void;
    /** The keys of the items that cannot be selected. */
    disabledKeys?: Iterable<SelectKey>;
    /** Whether the select is disabled. */
    isDisabled?: boolean;
    /** Whether the user must select a value before submitting a form. */
    isRequired?: boolean;
    /** Whether the select is in an invalid state. */
    isInvalid?: boolean;
    /** Sets the open state of the listbox (controlled). */
    isOpen?: boolean;
    /** Sets the default open state of the listbox (uncontrolled). */
    defaultOpen?: boolean;
    /** Handler that is called when the open state changes. */
    onOpenChange?: (isOpen: boolean) => void;
    /** Whether the select popup is modal: blocks page scroll and outside pointer interaction. */
    modal?: boolean;
    /** Whether moving the pointer over items highlights them; disable to let CSS `:hover` differ. */
    highlightItemOnHover?: boolean;
    /** Identifies the field when a form is submitted. */
    name?: string;
    /** The `<form>` element to associate the hidden input with. */
    form?: string;
    /** Provides a hint to the browser for autofill. */
    autoComplete?: string;
    /** The id of the select. */
    id?: string;
    className?: string | ((state: SelectRenderState) => string | undefined);
    style?: CSSProperties;
}

interface SelectValueProps {
    size: "sm" | "md" | "lg";
    placeholder?: string;
    icon?: FC | ReactNode;
    value: SelectItemType | null;
}

const SelectValue = ({ size, placeholder, icon, value }: SelectValueProps) => {
    const selectedItem = value;
    // Capitalized alias so a function-component icon can be rendered as JSX (mirrors Select).
    const Icon = selectedItem?.icon || icon;

    return (
        <BaseSelect.Value
            className={() =>
                cx(
                    "flex h-max w-full items-center justify-start truncate text-left align-middle",

                    sizes[size].root,

                    // With icon
                    Icon && sizes[size].withIcon,

                    // Icon styles
                    "*:data-icon:shrink-0 *:data-icon:text-fg-quaternary",
                )
            }
        >
            {() => (
                <>
                    {selectedItem?.avatarUrl ? (
                        <Avatar size="xs" src={selectedItem.avatarUrl} alt={selectedItem.label} className={cx(size === "sm" && "size-5")} />
                    ) : isReactComponent(Icon) ? (
                        <Icon data-icon aria-hidden="true" />
                    ) : isValidElement(Icon) ? (
                        Icon
                    ) : null}

                    {selectedItem ? (
                        <section className={cx("flex w-full truncate", sizes[size].textContainer)}>
                            <p className={cx("truncate font-medium text-primary", sizes[size].text)}>{selectedItem?.label}</p>
                            {selectedItem?.supportingText && (
                                <p className={cx("text-tertiary", sizes[size].text)}>{selectedItem?.supportingText}</p>
                            )}
                        </section>
                    ) : (
                        <p className={cx("text-placeholder", sizes[size].text)}>{placeholder}</p>
                    )}

                    <BaseSelect.Icon
                        render={
                            <ChevronDown
                                aria-hidden="true"
                                className={cx("ml-auto shrink-0 text-fg-quaternary", size === "lg" ? "size-5" : "size-4 stroke-[2.25px]")}
                            />
                        }
                    >
                        {null}
                    </BaseSelect.Icon>
                </>
            )}
        </BaseSelect.Value>
    );
};

const Select = ({
    placeholder = "Select",
    icon,
    size = "md",
    children,
    items,
    label,
    hint,
    tooltip,
    hideRequiredIndicator,
    className,
    popoverClassName,
    selectedKey,
    defaultSelectedKey,
    value: valueProp,
    defaultValue,
    onSelectionChange,
    onChange,
    disabledKeys,
    isDisabled,
    isRequired,
    isInvalid,
    isOpen,
    defaultOpen,
    onOpenChange,
    modal = false,
    highlightItemOnHover,
    name,
    form,
    autoComplete,
    id,
    ref,
    style,
}: SelectProps) => {
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

    // Base UI's root holds the popup state; React Aria's `isOpen`/`defaultOpen`/`onOpenChange` pair is funnelled
    // through one state so the className state can report the open flag as well.
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
    const open = isOpen ?? uncontrolledOpen;

    const [focus, setFocus] = useState({ isFocused: false, isFocusVisible: false });

    const selectState: SelectRenderState = {
        isFocused: focus.isFocused,
        isFocusVisible: focus.isFocusVisible,
        isDisabled: Boolean(isDisabled),
        isOpen: open,
        isInvalid: Boolean(isInvalid),
        isRequired: Boolean(isRequired),
    };

    const disabledKeySet = useMemo(
        () => (disabledKeys === undefined ? undefined : new Set(disabledKeys)),
        // React Aria accepted any iterable; a new iterable identity re-creates the set the items read.
        [disabledKeys],
    );

    const handleValueChange = (nextValue: SelectItemType | null) => {
        if (!isSelectionControlled) {
            setUncontrolledValue(nextValue);
        }
        const key = nextValue?.id ?? null;
        onSelectionChange?.(key);
        onChange?.(key);
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (isOpen === undefined) {
            setUncontrolledOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };

    // React Aria mapped items through its `children` render function against the collection's `items`; Base UI's
    // Select renders the options the caller puts in `<Select.List>`, so the same projection happens here.
    const listChildren =
        typeof children === "function"
            ? (items ?? []).map((item) => <Fragment key={item.id}>{children(item)}</Fragment>)
            : children;

    return (
        <Field.Root
            disabled={isDisabled}
            invalid={isInvalid}
            // React Aria's root was a single element carrying the payload's classes and the state attributes;
            // `Field.Root` renders the field wrapper, so the payload's divider merges into it.
            render={
                <div
                    ref={ref}
                    style={style}
                    data-open={open || undefined}
                    data-focused={focus.isFocused || undefined}
                    data-focus-visible={focus.isFocusVisible || undefined}
                />
            }
            className={cx("flex flex-col gap-1.5", typeof className === "function" ? className(selectState) : className)}
        >
            <SelectContext.Provider value={{ size }}>
                <SelectDisabledKeysContext.Provider value={disabledKeySet}>
                    <BaseSelect.Root
                        // Base UI resolves labels from `items`, so the payload's item list is projected into the
                        // `{ value, label }` shape it reads (the value stays the item itself).
                        items={items?.map((item) => ({ value: item, label: item.label ?? String(item.id) }))}
                        value={selectedItem}
                        onValueChange={handleValueChange}
                        // Base UI matches values by identity; React Aria matched keys, so equality follows the key.
                        isItemEqualToValue={(itemValue, valueToCompare) =>
                            itemValue === valueToCompare || itemValue?.id === valueToCompare?.id
                        }
                        itemToStringLabel={(itemValue) => itemValue?.label ?? String(itemValue?.id ?? "")}
                        itemToStringValue={(itemValue) => String(itemValue?.id ?? "")}
                        disabled={isDisabled}
                        required={isRequired}
                        open={open}
                        onOpenChange={handleOpenChange}
                        modal={modal}
                        highlightItemOnHover={highlightItemOnHover}
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

                        <BaseSelect.Trigger
                            className={cx(
                                "relative flex w-full cursor-pointer items-center rounded-lg bg-primary shadow-xs ring-1 ring-primary outline-hidden transition duration-100 ease-linear ring-inset",

                                // React Aria's `isFocused || isOpen` ring, on Base UI's attributes: the trigger is
                                // focused through the field context and open while its popup is.
                                "data-focused:ring-2 data-focused:ring-brand",
                                "data-popup-open:ring-2 data-popup-open:ring-brand",
                                "data-disabled:cursor-not-allowed data-disabled:opacity-50",
                            )}
                            onFocus={(event) => {
                                // Read the event synchronously: React nulls `currentTarget` before the updater runs.
                                const isFocusVisible = event.currentTarget.matches(":focus-visible");
                                setFocus({ isFocused: true, isFocusVisible });
                            }}
                            onBlur={() => setFocus({ isFocused: false, isFocusVisible: false })}
                        >
                            <SelectValue size={size} placeholder={placeholder} icon={icon} value={selectedItem} />
                        </BaseSelect.Trigger>

                        <BaseSelect.Portal>
                            {/* React Aria's popover hung below the trigger, start-aligned: `alignItemWithTrigger`
                                would overlap the popup with the trigger, so it stays off. */}
                            <BaseSelect.Positioner {...popoverPositionerProps} alignItemWithTrigger={false}>
                                <BaseSelect.Popup className={cx(popoverPopupClassName(size), popoverClassName)}>
                                    <BaseSelect.List className="size-full outline-hidden">{listChildren}</BaseSelect.List>
                                </BaseSelect.Popup>
                            </BaseSelect.Positioner>
                        </BaseSelect.Portal>
                    </BaseSelect.Root>

                    {hint && (
                        <HintText isInvalid={isInvalid} className={cx(size === "sm" && "text-xs")}>
                            {hint}
                        </HintText>
                    )}
                </SelectDisabledKeysContext.Provider>
            </SelectContext.Provider>
        </Field.Root>
    );
};

const _Select = Select as typeof Select & {
    ComboBox: typeof ComboBox;
    Item: typeof SelectItem;
};
_Select.ComboBox = ComboBox;
_Select.Item = SelectItem;

export { _Select as Select };
