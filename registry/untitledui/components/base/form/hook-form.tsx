/* Adopted from untitleduico/react@8b7409c078f8 — components/base/form/hook-form.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { createContext, useContext, useId } from "react";
import { Form as AriaForm } from "react-aria-components";
import type { Control, FieldPath, FieldValues, UseControllerReturn, UseFormReturn } from "react-hook-form";
import { FormProvider, useController, useFormContext } from "react-hook-form";

interface FormProps<TFieldValues extends FieldValues = FieldValues> extends ComponentPropsWithoutRef<typeof AriaForm> {
    form: UseFormReturn<TFieldValues>;
    children: ReactNode;
}

interface FormFieldProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> {
    name: TName;
    control: Control<TFieldValues>;
    children: ReactNode | ((control: UseControllerReturn<TFieldValues, TName>) => ReactNode);
}

interface FormFieldContextValues<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> {
    id: string;
    name: TName;
    control?: UseControllerReturn<TFieldValues, TName>;
}

const FormFieldContext = createContext<FormFieldContextValues>({} as FormFieldContextValues);

export const useFormFieldContext = () => {
    const context = useContext(FormFieldContext);
    const { getFieldState, formState } = useFormContext();
    const fieldState = getFieldState(context.name, formState);

    if (!context) {
        throw new Error("The 'useFormContext' hook must be used within a '<FormField />'");
    }

    return { ...context, ...fieldState };
};

export const HookForm = <TFieldValues extends FieldValues = FieldValues>({ form, ...props }: FormProps<TFieldValues>) => {
    return (
        <FormProvider {...form}>
            <AriaForm {...props} />
        </FormProvider>
    );
};

HookForm.displayName = "HookForm";

export const FormField = <TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({
    children,
    ...props
}: FormFieldProps<TFieldValues, TName>) => {
    const id = "form-item-" + useId();
    const control = useController(props);
    const withValidationBehavior = {
        ...control,
        field: {
            ...control.field,
            validationBehavior: "aria",
        },
    };

    return (
        <FormFieldContext.Provider
            value={{
                id,
                name: props.name,
                control: control as UseControllerReturn<FieldValues, TName>,
            }}
        >
            {children && (typeof children === "function" ? children(withValidationBehavior) : children)}
        </FormFieldContext.Provider>
    );
};

FormField.displayName = "FormField";
