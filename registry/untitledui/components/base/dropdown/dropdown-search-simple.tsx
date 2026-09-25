/* Adopted from untitleduico/react@8b7409c078f8 — components/base/dropdown/dropdown-search-simple.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration: React Aria's `Autocomplete` + `SearchField` + `useFilter` are replaced by Base UI's
 * `useFilter` (the same `Intl.Collator` matcher, `@base-ui/react/autocomplete`) driving a local filter over
 * the menu's items. Base UI's `Autocomplete` is a full combobox with its own popup, selection-less items and
 * `Autocomplete.Item` rows — it cannot render this menu's checkbox items inside the dropdown's own popup, so
 * the filter is applied locally and the menu keeps owning selection (see the unit record). */
"use client";

import { useState } from "react";
import { ChevronDown, SearchLg } from "@untitledui/icons";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Button } from "@/components/base/buttons/button";
import type { Selection } from "@/components/base/dropdown/dropdown";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { InputBase } from "../input/input";

const users = [
    { id: "olivia", name: "Olivia Rhye" },
    { id: "phoenix", name: "Phoenix Baker" },
    { id: "lana", name: "Lana Steiner" },
    { id: "demi", name: "Demi Wilkinson" },
    { id: "candice", name: "Candice Wu" },
    { id: "natali", name: "Natali Craig" },
    { id: "drew", name: "Drew Cano" },
    { id: "orlando", name: "Orlando Diggs" },
    { id: "andi", name: "Andi Lane" },
];

export const DropdownSearchSimple = () => {
    const [selectedUsers, setSelectedUsers] = useState<Selection>(new Set(["olivia", "phoenix"]));
    const [query, setQuery] = useState("");
    const { contains } = Autocomplete.useFilter();

    // React Aria's Autocomplete moved focus from the search field into the filtered menu with ArrowDown, and
    // cleared the query on Escape instead of closing the menu; both are kept here.
    const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape" && query) {
            event.preventDefault();
            event.stopPropagation();
            setQuery("");
            return;
        }

        if (event.key === "ArrowDown") {
            const item = event.currentTarget.closest('[role="menu"]')?.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])');
            if (item) {
                event.preventDefault();
                item.focus();
            }
        }
    };

    return (
        <Dropdown.Root>
            <Button
                size="sm"
                className="group"
                color="secondary"
                iconTrailing={(props) => <ChevronDown data-icon="trailing" {...props} className="size-4! stroke-[2.25px]!" />}
            >
                Manage access
            </Button>

            <Dropdown.Popover className="w-60">
                <div className="flex gap-3 border-b border-secondary p-3">
                    <InputBase
                        type="search"
                        size="md"
                        placeholder="Search"
                        icon={SearchLg}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                </div>
                <Dropdown.Menu selectionMode="multiple" selectedKeys={selectedUsers} onSelectionChange={setSelectedUsers}>
                    {users
                        .filter((user) => contains(user.name, query))
                        .map((user) => (
                            <Dropdown.Item key={user.id} id={user.id} textValue={user.name} selectionIndicator="checkbox">
                                {user.name}
                            </Dropdown.Item>
                        ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown.Root>
    );
};
