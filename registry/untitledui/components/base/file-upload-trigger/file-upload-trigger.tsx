/* Adopted from untitleduico/react@8b7409c078f8 — components/base/file-upload-trigger/file-upload-trigger.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import type { DetailedReactHTMLElement, HTMLAttributes, ReactNode } from "react";
import React, { cloneElement, useRef } from "react";

interface FileTriggerProps {
    /**
     * Specifies what mime type of files are allowed.
     */
    acceptedFileTypes?: Array<string>;
    /**
     * Whether multiple files can be selected.
     */
    allowsMultiple?: boolean;
    /**
     * Specifies the use of a media capture mechanism to capture the media on the spot.
     */
    defaultCamera?: "user" | "environment";
    /**
     * Handler when a user selects a file.
     */
    onSelect?: (files: FileList | null) => void;
    /**
     * The children of the component.
     */
    children: ReactNode;
    /**
     * Enables the selection of directories instead of individual files.
     */
    acceptDirectory?: boolean;
}

/**
 * A FileTrigger allows a user to access the file system with any pressable component, or custom components
 * built with a press layer.
 *
 * The trigger is a native `<input type="file">` kept out of the layout; the single child element is cloned
 * with a click handler that opens the file dialog, which is what gives any pressable element file-picker
 * behaviour without the element having to know about it.
 */
export const FileTrigger = (props: FileTriggerProps) => {
    const { children, onSelect, acceptedFileTypes, allowsMultiple, defaultCamera, acceptDirectory, ...rest } = props;

    const inputRef = useRef<HTMLInputElement | null>(null);

    // Make sure that only one child is passed to the component.
    const clonableElement = React.Children.only(children);

    // Clone the child element and add an `onClick` handler to open the file dialog.
    const mainElement = cloneElement(clonableElement as DetailedReactHTMLElement<HTMLAttributes<HTMLElement>, HTMLElement>, {
        onClick: () => {
            if (inputRef.current?.value) {
                inputRef.current.value = "";
            }
            inputRef.current?.click();
        },
    });

    return (
        <>
            {mainElement}
            <input
                {...rest}
                type="file"
                ref={inputRef}
                style={{ display: "none" }}
                accept={acceptedFileTypes?.toString()}
                onChange={(e) => onSelect?.(e.target.files)}
                capture={defaultCamera}
                multiple={allowsMultiple}
                // @ts-expect-error
                webkitdirectory={acceptDirectory ? "" : undefined}
            />
        </>
    );
};
