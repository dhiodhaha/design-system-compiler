/* Adopted from untitleduico/react@8b7409c078f8 — components/base/button-group/button-group.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 *
 * Base UI migration (migration/base-ui-v1.8): React Aria's ToggleButton/ToggleButtonGroup are replaced by
 * Base UI's Toggle/ToggleGroup. The public API is unchanged — `isSelected`, `defaultSelected`, `isDisabled`,
 * `id`, `selectionMode`, `selectedKeys`, `defaultSelectedKeys` and `onSelectionChange` all still work; the
 * translation to Base UI's vocabulary (`pressed`, `disabled`, array values) happens in this file.
 * Visual deltas: the `selected:` state variant became `data-pressed:` because Base UI's toggle emits
 * `data-pressed` (React Aria emitted `data-selected`). */
"use client";

import { Children, type FC, type PropsWithChildren, type ReactNode, type RefAttributes, createContext, isValidElement, useContext } from "react";
import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { cx, sortCx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";

export const styles = sortCx({
    common: {
        root: [
            "group/button-group inline-flex h-max cursor-pointer items-center bg-primary font-semibold whitespace-nowrap text-secondary shadow-skeuomorphic ring-1 ring-primary outline-brand transition duration-100 ease-linear ring-inset",
            // Hover and focus styles
            "hover:bg-primary_hover hover:text-secondary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2",
            // Disabled styles
            "data-disabled:cursor-not-allowed data-disabled:text-secondary/50 data-disabled:*:opacity-50",
            // Selected styles
            "data-pressed:bg-primary_hover data-pressed:text-secondary_hover",
        ].join(" "),
        icon: "pointer-events-none text-fg-quaternary transition-[inherit] group-hover/button-group:text-fg-quaternary_hover group-data-pressed/button-group:text-fg-quaternary_hover",
    },

    sizes: {
        sm: {
            root: "gap-1.5 px-3.5 py-2 text-sm not-last:pr-[calc(calc(var(--spacing)*3.5)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3 data-icon-only:px-2.5",
            icon: "size-5",
        },
        md: {
            root: "gap-1.5 px-4 py-2.5 text-sm not-last:pr-[calc(calc(var(--spacing)*4)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3.5 data-icon-only:px-3",
            icon: "size-5",
        },
        lg: {
            root: "gap-2 px-4.5 py-2.5 text-md not-last:pr-[calc(calc(var(--spacing)*4.5)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-4 data-icon-only:px-3.5",
            icon: "size-5",
        },
    },
});

type ButtonSize = keyof typeof styles.sizes;

const ButtonGroupContext = createContext<{ size: ButtonSize; multiple: boolean }>({ size: "md", multiple: false });

/**
 * React Aria's Selection vocabulary, kept so consumer call sites do not change.
 *
 * One deliberate narrowing: React Aria's `Key` is `string | number`, Base UI's toggle identifies items by
 * `string` only. `ButtonGroupKey` is therefore `string` — a numeric id now fails at compile time instead of
 * being silently coerced at runtime.
 */
export type ButtonGroupKey = string;
export type ButtonGroupSelection = "all" | Set<ButtonGroupKey>;

const toValueArray = (selection: ButtonGroupSelection | undefined): ButtonGroupKey[] | undefined =>
    selection === undefined ? undefined : selection === "all" ? [] : [...selection];

const toSelection = (values: ButtonGroupKey[]): ButtonGroupSelection => new Set(values);

interface ButtonGroupItemProps extends RefAttributes<HTMLButtonElement> {
    /** Identifies the item inside its group. */
    id?: ButtonGroupKey;
    /** Controlled pressed state (React Aria's `isSelected`). */
    isSelected?: boolean;
    /** Uncontrolled initial pressed state (React Aria's `defaultSelected`). */
    defaultSelected?: boolean;
    /** Called when the pressed state changes. */
    onChange?: (isSelected: boolean) => void;
    isDisabled?: boolean;
    iconLeading?: FC<{ className?: string }> | ReactNode;
    iconTrailing?: FC<{ className?: string }> | ReactNode;
    onClick?: () => void;
    className?: string;
}

export const ButtonGroupItem = ({
    id,
    isSelected,
    defaultSelected,
    onChange,
    isDisabled,
    iconLeading: IconLeading,
    iconTrailing: IconTrailing,
    children,
    className,
    onClick,
}: PropsWithChildren<ButtonGroupItemProps>) => {
    const context = useContext(ButtonGroupContext);

    if (!context) {
        throw new Error("ButtonGroupItem must be used within a ButtonGroup component");
    }

    const { size } = context;

    const isIcon = (IconLeading || IconTrailing) && !children;

    const content = (
        <>
            {isReactComponent(IconLeading) && <IconLeading className={cx(styles.common.icon, styles.sizes[size].icon)} />}
            {isValidElement(IconLeading) && IconLeading}

            {children}

            {isReactComponent(IconTrailing) && <IconTrailing className={cx(styles.common.icon, styles.sizes[size].icon)} />}
            {isValidElement(IconTrailing) && IconTrailing}
        </>
    );

    const shared = {
        value: id,
        disabled: isDisabled,
        onClick,
        "data-icon-only": isIcon ? true : undefined,
        "data-icon-leading": IconLeading ? true : undefined,
        className: cx(styles.common.root, styles.sizes[size].root, className),
    } as const;

    // Single-selection groups are radios in both React Aria and the APG, so the migrated item is a Base UI
    // Radio; multiple selection is a toggle. The public props are identical in both modes.
    return context.multiple ? (
        <BaseToggle {...shared} pressed={isSelected} defaultPressed={defaultSelected} onPressedChange={(pressed) => onChange?.(pressed)}>
            {content}
        </BaseToggle>
    ) : (
        <BaseRadio.Root {...shared}>{content}</BaseRadio.Root>
    );
};

interface ButtonGroupProps extends RefAttributes<HTMLDivElement> {
    /** Single selection (default) or multiple. */
    selectionMode?: "single" | "multiple";
    /** Controlled selection, in React Aria's vocabulary. */
    selectedKeys?: ButtonGroupSelection;
    /** Uncontrolled initial selection. */
    defaultSelectedKeys?: ButtonGroupSelection;
    /** Called with the resulting selection. */
    onSelectionChange?: (selection: ButtonGroupSelection) => void;
    isDisabled?: boolean;
    orientation?: "horizontal" | "vertical";
    size?: ButtonSize;
    className?: string;
    children?: ReactNode;
}

export const ButtonGroup = ({
    children,
    size = "md",
    className,
    selectionMode = "single",
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    isDisabled,
    orientation,
    ref,
}: ButtonGroupProps) => {
    const multiple = selectionMode === "multiple";

    /**
     * Base UI keeps selection state on the group, while React Aria also let an individual item declare
     * `isSelected` (pagination relies on that). Those item-level declarations are read here and folded into
     * the group's controlled value, so the public API behaves exactly as before without the group needing to
     * know about it.
     */
    const declaredItems = Children.toArray(children)
        .filter((child) => isValidElement<ButtonGroupItemProps>(child))
        .map((child) => child.props)
        .filter((props) => props.isSelected !== undefined);
    const controlledByItems = declaredItems.length > 0;
    const pressedIds = declaredItems.filter((props) => props.isSelected).map((props) => props.id).filter((id): id is ButtonGroupKey => id !== undefined);

    const controlledValue = selectedKeys !== undefined ? toValueArray(selectedKeys) : controlledByItems ? pressedIds : undefined;
    const defaultValues = controlledByItems ? undefined : toValueArray(defaultSelectedKeys);

    const classNameBase = "relative z-0 inline-flex w-max -space-x-px rounded-lg shadow-xs";

    return (
        <ButtonGroupContext.Provider value={{ size, multiple }}>
            {multiple ? (
                <BaseToggleGroup
                    ref={ref}
                    value={controlledValue}
                    defaultValue={defaultValues}
                    onValueChange={(values) => onSelectionChange?.(toSelection(values as ButtonGroupKey[]))}
                    multiple
                    disabled={isDisabled}
                    orientation={orientation}
                    className={cx(classNameBase, className)}
                >
                    {children}
                </BaseToggleGroup>
            ) : (
                <BaseRadioGroup
                    ref={ref}
                    value={controlledValue?.[0]}
                    defaultValue={defaultValues?.[0]}
                    onValueChange={(value) => onSelectionChange?.(toSelection(value === null || value === undefined ? [] : [value as ButtonGroupKey]))}
                    disabled={isDisabled}
                    aria-orientation={orientation}
                    className={cx(classNameBase, className)}
                >
                    {children}
                </BaseRadioGroup>
            )}
        </ButtonGroupContext.Provider>
    );
};
