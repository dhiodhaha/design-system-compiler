/* Adopted from untitleduico/react@8b7409c078f8 — components/base/dropdown/dropdown-search-advanced.tsx
 * MIT licensed upstream source (Copyright (c) 2025 Untitled UI).
 * Adopted with the smallest necessary project-local transformations; deltas are recorded in
 * .design-compiler/references/untitledui/adoption-*.json. Do not hand-edit: re-run compiler/adopt/adopt.mjs.
 *
 * Base UI migration: React Aria's `Autocomplete` + `SearchField` + `useFilter` are replaced by Base UI's
 * `useFilter` (the same `Intl.Collator` matcher, `@base-ui/react/autocomplete`) driving a local filter over
 * the menu's items — Base UI's `Autocomplete` owns its own popup and has no selection state, so it cannot
 * replace a checkbox menu that already lives inside the dropdown's popup (see the unit record). Matching runs
 * against each item's `textValue`, exactly as React Aria's collection filter did. */
"use client";

import { useState } from "react";
import { ChevronDown, Plus, SearchLg } from "@untitledui/icons";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Button } from "@/components/base/buttons/button";
import type { Selection } from "@/components/base/dropdown/dropdown";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { InputBase } from "../input/input";

const teams = [
    { id: "untitledui", name: "Untitled UI", textValue: "Olivia Rhye" },
    { id: "shutterframe", name: "Shutterframe", textValue: "Phoenix Baker" },
    { id: "warpspeed", name: "Warpspeed", textValue: "Lana Steiner" },
    { id: "contrastai", name: "ContrastAI", textValue: "Demi Wilkinson" },
    { id: "launchsimple", name: "LaunchSimple", textValue: "Candice Wu" },
    { id: "elasticware", name: "Elasticware", textValue: "Natali Craig" },
];

const members = [
    { id: "olivia", name: "Olivia Rhye", avatar: "https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80" },
    { id: "phoenix", name: "Phoenix Baker", avatar: "https://www.untitledui.com/images/avatars/phoenix-baker?fm=webp&q=80" },
    { id: "lana", name: "Lana Steiner", avatar: "https://www.untitledui.com/images/avatars/lana-steiner?fm=webp&q=80" },
    { id: "demi", name: "Demi Wilkinson", avatar: "https://www.untitledui.com/images/avatars/demi-wilkinson?fm=webp&q=80" },
];

export const DropdownSearchAdvanced = () => {
    const [selectedUsers, setSelectedUsers] = useState<Selection>(new Set(["untitledui", "shutterframe"]));
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
                    {teams
                        .filter((team) => contains(team.textValue, query))
                        .map((team) => (
                            <Dropdown.Submenu key={team.id}>
                                <Dropdown.Item id={team.id} textValue={team.textValue} selectionIndicator="checkbox">
                                    {team.name}
                                </Dropdown.Item>
                                <Dropdown.Popover placement="right top" offset={-6} className="w-50">
                                    <Dropdown.Menu selectionMode="multiple">
                                        {members.map((member) => (
                                            <Dropdown.Item
                                                key={member.id}
                                                id={member.id}
                                                textValue={member.name}
                                                selectionIndicator="checkbox"
                                                avatarUrl={member.avatar}
                                            >
                                                {member.name}
                                            </Dropdown.Item>
                                        ))}
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown.Submenu>
                        ))}
                </Dropdown.Menu>
                <div className="flex flex-col gap-3 border-t border-secondary p-3">
                    <Button size="xs" color="secondary" iconLeading={Plus}>
                        Create team
                    </Button>
                </div>
            </Dropdown.Popover>
        </Dropdown.Root>
    );
};
