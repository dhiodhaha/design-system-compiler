/* Adopted from untitleduico/react@8b7409c078f8 — components/base/select/select-item.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration (branch migration/base-ui-v1.8): React Aria's `ListBoxItem`/`Text` are replaced by
 * `@base-ui/react@1.8.0`'s `Select.Item`. `id` stays the option's key (Base UI identifies options by `value`),
 * `isDisabled` maps to `disabled`, and the React Aria render-prop state handed to `className`/`style`/`children`
 * is rebuilt from Base UI's `{selected, highlighted, disabled}` plus locally tracked hover/press/focus-visible
 * state. The option's `aria-labelledby`/`aria-describedby` wiring React Aria supplied through its `Text` slots
 * is reproduced with the ids the label/description elements carry — the unit record is
 * .design-compiler/base-ui-migration/units/select-family.json. */
"use client";

import { Combobox as BaseCombobox, type ComboboxItemState } from "@base-ui/react/combobox";
import { Select as BaseSelect, type SelectItemState } from "@base-ui/react/select";
import type { BaseUIEvent } from "@base-ui/react/internals/types";
import type { ComponentPropsWithoutRef, CSSProperties, FocusEvent, PointerEvent, ReactElement, ReactNode, Ref } from "react";
import { createContext, isValidElement, useContext, useId, useState } from "react";
import { Check } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { CheckboxBase } from "@/components/base/checkbox/checkbox";
import { cx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";
import type { SelectItemType } from "./select-shared";
import { SelectContext } from "./select-shared";

const sizes = {
    sm: {
        root: "p-2 pr-2.5 gap-2 *:data-icon:size-4 *:data-icon:stroke-[2.25px]",
        text: "text-sm",
        textContainer: "gap-x-1.5",
        check: "size-4 stroke-[2.25px]",
        checkbox: "sm" as const,
    },
    md: {
        root: "p-2 pr-2.5 gap-2 *:data-icon:size-5",
        text: "text-md",
        textContainer: "gap-x-2",
        check: "size-5",
        checkbox: "sm" as const,
    },
    lg: {
        root: "p-2.5 pl-2 gap-2 *:data-icon:size-5",
        text: "text-md",
        textContainer: "gap-x-2",
        check: "size-5",
        checkbox: "md" as const,
    },
};

/**
 * The render-prop state React Aria handed to `className`, `style` and `children`.
 *
 * `isSelected`/`isDisabled` come from Base UI's item state, `isFocused` is Base UI's `highlighted` (React Aria's
 * "focused" list option was the roving highlight, which Base UI calls highlighted), and hover, press and
 * focus-visible are tracked here because Base UI models them as CSS state only.
 */
interface SelectItemRenderState {
    isSelected: boolean;
    isFocused: boolean;
    isFocusVisible: boolean;
    isHovered: boolean;
    isPressed: boolean;
    isDisabled: boolean;
}

/**
 * Base UI types the item's value as `any` and owns selection state, so the React Aria names the payload exposes
 * are re-added below; `id` is the payload's option key (Base UI's options are keyed by `value`), so it is not
 * forwarded to the DOM as an element id.
 */
type BaseSelectItemProps = Omit<
    ComponentPropsWithoutRef<typeof BaseSelect.Item>,
    "ref" | "id" | "value" | "label" | "disabled" | "index" | "nativeButton" | "children" | "className" | "style" | "render"
>;

interface SelectItemProps extends BaseSelectItemProps, SelectItemType {
    /** The selection indicator to be displayed on the item. */
    selectionIndicator?: "checkmark" | "checkbox" | "none";
    /** The alignment of the selection indicator. */
    selectionIndicatorAlign?: "left" | "right";
    /** The object value of the item; defaults to the item's own data. */
    value?: SelectItemType;
    className?: string | ((state: SelectItemRenderState) => string | undefined);
    style?: CSSProperties | ((state: SelectItemRenderState) => CSSProperties | undefined);
    children?: ReactNode | ((state: SelectItemRenderState) => ReactNode);
    /** React Aria's DOM render escape hatch: replaces the option element, receiving its props and state. */
    render?: (props: ComponentPropsWithoutRef<"div">, state: SelectItemRenderState) => ReactElement;
    ref?: Ref<HTMLDivElement>;
}

/**
 * React Aria disabled the options named by the collection's `disabledKeys`; Base UI resolves disabled state
 * per item, so a root that supports `disabledKeys` hands the key set down through this context. An item's own
 * `isDisabled` still wins, and rendering the item outside such a root keeps it enabled.
 */
export const SelectDisabledKeysContext = createContext<ReadonlySet<string | number> | undefined>(undefined);

/**
 * React Aria's `ListBoxItem` served both collections — the payload's combo box documents `Select.Item` as the way
 * to render its options — while Base UI's `Select.Item` and `Combobox.Item` are separate parts that each read
 * their own root context (rendering the wrong one throws). The combobox family marks its subtree with this
 * context, so the item renders the part whose root is above it.
 */
export const SelectItemOwnerContext = createContext<"select" | "combobox">("select");

export const SelectItem = ({
    label,
    id,
    value,
    avatarUrl,
    supportingText,
    isDisabled,
    icon: Icon,
    className,
    style,
    render,
    children,
    selectionIndicator = "checkmark",
    selectionIndicatorAlign = "right",
    ...props
}: SelectItemProps) => {
    const { size } = useContext(SelectContext);
    const disabledKeys = useContext(SelectDisabledKeysContext);

    const labelId = useId();
    const descriptionId = useId();

    // Base UI exposes selection/disabled/highlight as state, so the interaction flags React Aria also reported
    // are tracked here (the same reconstruction `checkbox.tsx` performs for its root element).
    const [interaction, setInteraction] = useState({ isHovered: false, isPressed: false, isFocusVisible: false });

    const labelOrChildren = label || (typeof children === "string" ? children : "");
    const textValue = supportingText ? labelOrChildren + " " + supportingText : labelOrChildren;

    // React Aria disabled an option either through the item's own `isDisabled` or the collection's `disabledKeys`.
    const isItemDisabled = isDisabled ?? disabledKeys?.has(id);

    const isLeft = selectionIndicatorAlign === "left";

    // The combobox family marks its subtree through `SelectItemOwnerContext` so the item renders the part that
    // matches the root above it (see the context's declaration).
    const itemOwner = useContext(SelectItemOwnerContext);

    const toState = (state: SelectItemState | ComboboxItemState): SelectItemRenderState => ({
        isSelected: state.selected,
        isFocused: state.highlighted,
        isFocusVisible: interaction.isFocusVisible,
        isHovered: interaction.isHovered,
        isPressed: interaction.isPressed,
        isDisabled: state.disabled,
    });

    const onFocus = (event: BaseUIEvent<FocusEvent<HTMLDivElement>>) => {
        props.onFocus?.(event);
        // Read the event synchronously: React nulls `currentTarget` before the state updater runs.
        const isFocusVisible = event.currentTarget.matches(":focus-visible");
        setInteraction((current) => ({ ...current, isFocusVisible }));
    };

    const onBlur = (event: BaseUIEvent<FocusEvent<HTMLDivElement>>) => {
        props.onBlur?.(event);
        setInteraction((current) => (current.isFocusVisible ? { ...current, isFocusVisible: false } : current));
    };

    const onPointerEnter = (event: BaseUIEvent<PointerEvent<HTMLDivElement>>) => {
        props.onPointerEnter?.(event);
        if (event.pointerType === "touch") return;
        setInteraction((current) => (current.isHovered ? current : { ...current, isHovered: true }));
    };

    const onPointerLeave = (event: BaseUIEvent<PointerEvent<HTMLDivElement>>) => {
        props.onPointerLeave?.(event);
        setInteraction((current) => (current.isHovered || current.isPressed ? { ...current, isHovered: false, isPressed: false } : current));
    };

    const onPointerDown = (event: BaseUIEvent<PointerEvent<HTMLDivElement>>) => {
        props.onPointerDown?.(event);
        setInteraction((current) => (current.isPressed ? current : { ...current, isPressed: true }));
    };

    const onPointerUp = (event: BaseUIEvent<PointerEvent<HTMLDivElement>>) => {
        props.onPointerUp?.(event);
        setInteraction((current) => (current.isPressed ? { ...current, isPressed: false } : current));
    };

    const onPointerCancel = (event: BaseUIEvent<PointerEvent<HTMLDivElement>>) => {
        props.onPointerCancel?.(event);
        setInteraction((current) => (current.isPressed ? { ...current, isPressed: false } : current));
    };

    const itemClassName = (state: SelectItemState | ComboboxItemState) =>
        cx("w-full py-px outline-hidden", size === "sm" ? "px-1" : "px-1.5", typeof className === "function" ? className(toState(state)) : className);

    const itemStyle = (state: SelectItemState | ComboboxItemState) => (typeof style === "function" ? style(toState(state)) : style);

    const itemRender = (itemProps: ComponentPropsWithoutRef<"div">, state: SelectItemState | ComboboxItemState): ReactElement => {
        const itemState = toState(state);

        const content = (
            <div
                className={cx(
                    "flex cursor-pointer items-center rounded-md outline-hidden select-none",
                    (itemState.isFocused || itemState.isHovered || (itemState.isSelected && selectionIndicator !== "checkbox")) && "bg-primary_hover",
                    itemState.isDisabled && "cursor-not-allowed opacity-50",
                    itemState.isFocusVisible && "ring-2 ring-focus-ring ring-inset",

                    // Icon styles
                    "*:data-icon:shrink-0 *:data-icon:text-fg-quaternary",

                    sizes[size].root,
                )}
            >
                {isLeft && selectionIndicator === "checkbox" && (
                    <CheckboxBase size={sizes[size].checkbox} isSelected={itemState.isSelected} isDisabled={itemState.isDisabled} />
                )}

                {avatarUrl ? (
                    <Avatar aria-hidden="true" size="xs" src={avatarUrl} alt={label} className={cx(size === "sm" && "size-5")} />
                ) : isReactComponent(Icon) ? (
                    <Icon data-icon aria-hidden="true" />
                ) : isValidElement(Icon) ? (
                    Icon
                ) : null}

                <div className={cx("flex w-full min-w-0 flex-1 flex-wrap", sizes[size].textContainer)}>
                    <span id={labelId} className={cx("truncate font-medium whitespace-nowrap text-primary", sizes[size].text)}>
                        {label || (typeof children === "function" ? children(itemState) : children)}
                    </span>

                    {supportingText && (
                        <span id={descriptionId} className={cx("whitespace-nowrap text-tertiary", sizes[size].text)}>
                            {supportingText}
                        </span>
                    )}
                </div>

                {itemState.isSelected && selectionIndicator === "checkmark" && (
                    <Check aria-hidden="true" className={cx("ml-auto text-fg-brand-primary", sizes[size].check)} />
                )}

                {!isLeft && selectionIndicator === "checkbox" && (
                    <CheckboxBase size={sizes[size].checkbox} isSelected={itemState.isSelected} isDisabled={itemState.isDisabled} className="ml-auto" />
                )}
            </div>
        );

        // React Aria's `render` escape hatch, given the option props (children included) and the state.
        if (render) {
            return render({ ...itemProps, children: content }, itemState);
        }
        return <div {...itemProps}>{content}</div>;
    };

    const sharedProps = {
        // The option's accessible name and description keep the React Aria wiring: the option is labelled by the
        // label element and described by the supporting text, not by the option's whole text content.
        "aria-labelledby": labelId,
        ...(supportingText ? { "aria-describedby": descriptionId } : {}),
        value: value ?? { id, label: labelOrChildren, avatarUrl, supportingText, isDisabled, icon: Icon },
        // Base UI matches keyboard typeahead against `label`; React Aria's `textValue` was the same string.
        label: textValue,
        disabled: isItemDisabled,
        ...props,
        onFocus,
        onBlur,
        onPointerEnter,
        onPointerLeave,
        onPointerDown,
        onPointerUp,
        onPointerCancel,
        className: itemClassName,
        style: itemStyle,
        render: itemRender,
    };

    if (itemOwner === "combobox") {
        return <BaseCombobox.Item {...(sharedProps as ComponentPropsWithoutRef<typeof BaseCombobox.Item>)} />;
    }
    return <BaseSelect.Item {...sharedProps} />;
};
