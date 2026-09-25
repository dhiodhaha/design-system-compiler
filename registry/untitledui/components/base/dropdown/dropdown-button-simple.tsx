/* Adopted from untitleduico/react@8b7409c078f8 — components/base/dropdown/dropdown-button-simple.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs. */
"use client";

import { ChevronDown } from "@untitledui/icons";
import { SubmenuTrigger } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";

export const DropdownButtonSimple = () => (
    <Dropdown.Root>
        <Button size="sm" color="secondary" iconTrailing={ChevronDown} className="group *:data-icon:size-4 *:data-icon:stroke-[2.25px]!">
            Account
        </Button>

        <Dropdown.Popover className="w-54">
            <Dropdown.Menu>
                <Dropdown.Section>
                    <Dropdown.Item addon="⌘X">Cut</Dropdown.Item>
                    <Dropdown.Item addon="⌘C">Copy</Dropdown.Item>
                    <Dropdown.Item addon="⌘V">Paste</Dropdown.Item>
                </Dropdown.Section>
                <Dropdown.Separator />
                <Dropdown.Section>
                    <Dropdown.Item>Edit</Dropdown.Item>
                    <Dropdown.Item>Duplicate</Dropdown.Item>
                    <Dropdown.Item>Delete</Dropdown.Item>
                </Dropdown.Section>
                <Dropdown.Separator />
                <Dropdown.Section>
                    <SubmenuTrigger>
                        <Dropdown.Item>View details</Dropdown.Item>
                        <Dropdown.Popover placement="right top" offset={-6} className="w-50">
                            <Dropdown.Menu>
                                <Dropdown.Item>Share</Dropdown.Item>
                                <Dropdown.Item>Save as</Dropdown.Item>
                                <Dropdown.Item>Archive</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </SubmenuTrigger>
                </Dropdown.Section>
            </Dropdown.Menu>
        </Dropdown.Popover>
    </Dropdown.Root>
);
