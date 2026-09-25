import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import "../registry/untitledui/styles/globals.css";
import "./styles/fonts.css";

import { Button } from "../registry/untitledui/components/base/buttons/button";
import { ButtonUtility } from "../registry/untitledui/components/base/buttons/button-utility";
import { Checkbox } from "../registry/untitledui/components/base/checkbox/checkbox";
import { RadioButton, RadioGroup } from "../registry/untitledui/components/base/radio-buttons/radio-buttons";
import { Toggle } from "../registry/untitledui/components/base/toggle/toggle";
import { Label } from "../registry/untitledui/components/base/input/label";
import { HintText } from "../registry/untitledui/components/base/input/hint-text";
import { Input } from "../registry/untitledui/components/base/input/input";
import { TextArea } from "../registry/untitledui/components/base/textarea/textarea";
import { Select, type SelectItemType } from "../registry/untitledui/components/base/select/select";
import { Tooltip, TooltipTrigger } from "../registry/untitledui/components/base/tooltip/tooltip";
import { Tabs, TabList, Tab, TabPanel } from "../registry/untitledui/components/application/tabs/tabs";
import { Slider } from "../registry/untitledui/components/base/slider/slider";
import { Dropdown } from "../registry/untitledui/components/base/dropdown/dropdown";
import { ComboBox } from "../registry/untitledui/components/base/select/combobox";
import { Tag, TagGroup, TagList } from "../registry/untitledui/components/base/tags/tags";
import { MultiSelect } from "../registry/untitledui/components/base/select/multi-select";
import { SlideoutMenu } from "../registry/untitledui/components/application/slideout-menus/slideout-menu";
import { TagSelect } from "../registry/untitledui/components/base/select/tag-select";
import { InputNumber } from "../registry/untitledui/components/base/input/input-number";
import { PaymentInput } from "../registry/untitledui/components/base/input/input-payment";
import { InputTags } from "../registry/untitledui/components/base/input/input-tags";
import { ButtonGroup, ButtonGroupItem } from "../registry/untitledui/components/base/button-group/button-group";
import { Form } from "../registry/untitledui/components/base/form/form";
import { FileTrigger } from "../registry/untitledui/components/base/file-upload-trigger/file-upload-trigger";
import { Dialog, DialogTrigger, Modal } from "../registry/untitledui/components/application/modals/modal";
import { NavAccountCard } from "../registry/untitledui/components/application/app-navigation/base-components/nav-account-card";
import { DatePicker } from "../registry/untitledui/components/application/date-picker/date-picker";
import { Check } from "@untitledui/icons";

/**
 * The migration harness: one case per behaviour the Base UI migration must preserve.
 *
 * Every case renders the CANONICAL payload component through its public API — never React Aria internals —
 * so the same page can be captured before the migration (React Aria baseline) and after it (Base UI), and
 * the two captures compared. Cases carry their own interaction script because semantics that only appear
 * after a key press (focus movement, popup open, selection) cannot be verified from a static render.
 */
export type MigrationCase = {
  id: string;
  unit: string;
  /** semantic slots measured for geometry/style parity, by data-slot attribute */
  slots?: string[];
  actions?: Array<{ type: "click" | "focus" | "hover" | "press" | "type"; target?: string; value?: string; keys?: string[] }>;
  node: ReactNode;
};

const menu = (
  <Select
    label="Team member"
    placeholder="Select team member"
    items={[
      { id: "a", label: "Phoenix Baker", supportingText: "phoenix@untitledui.com" },
      { id: "b", label: "Olivia Rhye", supportingText: "olivia@untitledui.com" },
      { id: "c", label: "Lana Steiner", supportingText: "lana@untitledui.com" },
    ]}
  >
    {(item: SelectItemType) => <Select.Item id={item.id}>{item.label}</Select.Item>}
  </Select>
);

export const CASES: MigrationCase[] = [
  {
    id: "button-default",
    unit: "button",
    slots: ["[role=button],a,button"],
    node: <Button color="primary" size="md">Button</Button>,
  },
  { id: "button-secondary", unit: "button", slots: ["[role=button],a,button"], node: <Button color="secondary" size="md">Button</Button> },
  { id: "button-disabled", unit: "button", slots: ["[role=button],a,button"], node: <Button color="primary" size="md" isDisabled>Button</Button> },
  { id: "button-loading", unit: "button", slots: ["[role=button],a,button"], node: <Button color="primary" size="md" isLoading showTextWhileLoading>Button</Button> },
  {
    id: "button-link",
    unit: "button",
    slots: ["a"],
    actions: [{ type: "click", target: "a" }],
    node: <Button color="link-gray" size="md" href="#">Link button</Button>,
  },
  {
    id: "button-keyboard",
    unit: "button",
    slots: ["[role=button],button"],
    actions: [{ type: "focus", target: "button" }, { type: "press", keys: ["Enter"] }, { type: "press", keys: ["Space"] }],
    node: <Button color="primary" size="md">Keyboard</Button>,
  },
  { id: "button-utility", unit: "button", slots: ["button"], node: <ButtonUtility icon={Check} tooltip="Copy to clipboard" aria-label="Copy to clipboard" /> },

  { id: "checkbox-unchecked", unit: "checkbox", slots: ["[role=checkbox],input,label"], node: <Checkbox label="Remember me" /> },
  { id: "checkbox-checked", unit: "checkbox", slots: ["[role=checkbox],input,label"], node: <Checkbox label="Checked" defaultSelected /> },
  {
    id: "checkbox-keyboard",
    unit: "checkbox",
    slots: ["[role=checkbox],input,label"],
    actions: [{ type: "focus", target: "input,[role=checkbox]" }, { type: "press", keys: ["Space"] }],
    node: <Checkbox label="Toggle me" />,
  },
  {
    id: "checkbox-hint-invalid",
    unit: "checkbox",
    slots: ["[role=checkbox],input,label"],
    node: <Checkbox label="Invalid" hint="This is a hint" isInvalid defaultSelected />,
  },
  { id: "checkbox-disabled", unit: "checkbox", slots: ["[role=checkbox],input,label"], node: <Checkbox label="Disabled" isDisabled /> },

  {
    id: "radio-group-default",
    unit: "radio-group",
    slots: ["[role=radiogroup],input"],
    node: (
      <RadioGroup aria-label="Plan">
        <RadioButton value="a" label="Starter" />
        <RadioButton value="b" label="Growth" />
        <RadioButton value="c" label="Scale" />
      </RadioGroup>
    ),
  },
  {
    id: "radio-group-keyboard",
    unit: "radio-group",
    slots: ["[role=radiogroup],input"],
    actions: [{ type: "focus", target: "input" }, { type: "press", keys: ["ArrowDown"] }, { type: "press", keys: ["ArrowDown"] }],
    node: (
      <RadioGroup aria-label="Plan" defaultValue="a">
        <RadioButton value="a" label="Starter" />
        <RadioButton value="b" label="Growth" />
        <RadioButton value="c" label="Scale" />
      </RadioGroup>
    ),
  },
  {
    id: "radio-group-disabled",
    unit: "radio-group",
    slots: ["[role=radiogroup],input"],
    node: (
      <RadioGroup aria-label="Plan" isDisabled defaultValue="a">
        <RadioButton value="a" label="Starter" />
        <RadioButton value="b" label="Growth" />
      </RadioGroup>
    ),
  },

  { id: "toggle-off", unit: "toggle", slots: ["[role=switch],input,label"], node: <Toggle label="Available" /> },
  {
    id: "toggle-keyboard",
    unit: "toggle",
    slots: ["[role=switch],input,label"],
    actions: [{ type: "focus", target: "input,[role=switch]" }, { type: "press", keys: ["Space"] }],
    node: <Toggle label="Toggle me" />,
  },
  { id: "toggle-on-disabled", unit: "toggle", slots: ["[role=switch],input,label"], node: <Toggle label="Disabled" defaultSelected isDisabled /> },

  {
    id: "field-label-hint",
    unit: "label-hint",
    slots: ["label,span"],
    node: (
      <div className="flex flex-col gap-1">
        <Label isRequired tooltip="Why we ask" tooltipDescription="We only use it for receipts.">Email address</Label>
        <Input placeholder="you@company.com" />
        <HintText>Use a work email.</HintText>
      </div>
    ),
  },
  {
    id: "field-invalid",
    unit: "label-hint",
    slots: ["label,span"],
    node: (
      <div className="flex flex-col gap-1">
        <Label isInvalid isRequired>Email address</Label>
        <Input isInvalid placeholder="you@company.com" />
        <HintText isInvalid>Please enter a valid email.</HintText>
      </div>
    ),
  },

  {
    id: "input-default",
    unit: "input",
    slots: ["input,wrapper"],
    actions: [{ type: "focus", target: "input" }, { type: "type", target: "input", value: "hello" }],
    node: <Input label="Name" placeholder="Your name" />,
  },
  { id: "input-disabled", unit: "input", slots: ["input,wrapper"], node: <Input label="Name" placeholder="Your name" isDisabled /> },
  { id: "input-invalid", unit: "input", slots: ["input,wrapper"], node: <Input label="Email" isInvalid hint="Enter a valid email." /> },

  { id: "textarea-default", unit: "textarea", slots: ["textarea,label"], node: <TextArea label="Notes" placeholder="Write something" /> },
  { id: "textarea-invalid", unit: "textarea", slots: ["textarea,label"], node: <TextArea label="Notes" isInvalid hint="Required field" /> },

  { id: "select-closed", unit: "select", slots: ["button,[role=combobox]"], node: menu },
  {
    id: "select-open",
    unit: "select",
    slots: ["button,[role=combobox],[role=listbox]"],
    actions: [{ type: "click", target: "[role=combobox],button" }, { type: "press", keys: ["ArrowDown"] }, { type: "press", keys: ["Enter"] }],
    node: menu,
  },

  {
    id: "tooltip",
    unit: "tooltip",
    slots: ["button,[role=tooltip]"],
    actions: [
      { type: "focus", target: "button" },
      { type: "press", keys: ["Escape"] },
      { type: "hover", target: "button" },
    ],
    node: (
      <Tooltip title="Tooltip" description="This is a tooltip">
        <TooltipTrigger>Trigger</TooltipTrigger>
      </Tooltip>
    ),
  },

  {
    id: "tabs-default",
    unit: "tabs",
    slots: ["[role=tablist],[role=tab],[role=tabpanel]"],
    actions: [{ type: "press", keys: ["ArrowRight"] }],
    node: (
      <Tabs>
        <TabList aria-label="Tabs">
          <Tab id="one">One</Tab>
          <Tab id="two">Two</Tab>
          <Tab id="three">Three</Tab>
        </TabList>
        <TabPanel id="one">First panel</TabPanel>
        <TabPanel id="two">Second panel</TabPanel>
        <TabPanel id="three">Third panel</TabPanel>
      </Tabs>
    ),
  },

  { id: "slider-default", unit: "slider", slots: ["input,[role=slider]"], node: <Slider aria-label="Volume" defaultValue={30} /> },
  {
    id: "slider-keyboard",
    unit: "slider",
    slots: ["input,[role=slider]"],
    actions: [{ type: "focus", target: "[role=slider],input" }, { type: "press", keys: ["ArrowRight"] }],
    node: <Slider aria-label="Volume" defaultValue={30} />,
  },

  {
    id: "dropdown-menu",
    unit: "dropdown",
    slots: ["button,[role=menu],[role=menuitem]"],
    actions: [
      { type: "click", target: "button" },
      { type: "press", keys: ["ArrowDown"] },
      { type: "press", keys: ["ArrowDown"] },
      { type: "press", keys: ["Escape"] },
    ],
    node: (
      <Dropdown.Root>
        <Dropdown.DotsButton />
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Actions">
            <Dropdown.Item id="view">View profile</Dropdown.Item>
            <Dropdown.Item id="settings">Account settings</Dropdown.Item>
            <Dropdown.Item id="delete" isDisabled>
              Delete
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    ),
  },
  {
    id: "combobox",
    unit: "combobox",
    slots: ["input,[role=combobox],[role=listbox]"],
    actions: [
      { type: "click", target: "input" },
      { type: "type", target: "input", value: "Oli" },
      { type: "press", keys: ["ArrowDown"] },
      { type: "press", keys: ["Enter"] },
    ],
    node: (
      <ComboBox label="Search members" placeholder="Search by name" items={[
        { id: "a", label: "Phoenix Baker" },
        { id: "b", label: "Olivia Rhye" },
        { id: "c", label: "Lana Steiner" },
      ]}>
        {(item: SelectItemType) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </ComboBox>
    ),
  },
  {
    id: "tags-render",
    unit: "tags",
    slots: ["[role=list],[role=listitem]"],
    actions: [{ type: "click", target: "button" }],
    node: (
      <TagGroup label="Tags" selectionMode="none">
        <TagList>
          <Tag id="alpha">Alpha</Tag>
          <Tag id="beta">Beta</Tag>
          <Tag id="gamma" isDisabled>
            Gamma
          </Tag>
        </TagList>
      </TagGroup>
    ),
  },
  {
    id: "input-number",
    unit: "input-number",
    slots: ["input,label"],
    actions: [
      { type: "focus", target: "input" },
      { type: "press", keys: ["ArrowUp"] },
      { type: "press", keys: ["ArrowUp"] },
    ],
    node: <InputNumber label="Quantity" placeholder="0" defaultValue={1} />,
  },
  { id: "input-payment", unit: "input-payment", slots: ["input,label"], actions: [{ type: "type", target: "input", value: "4242424242424242" }], node: <PaymentInput label="Card number" placeholder="Card number" /> },
  {
    id: "input-tags",
    unit: "input-tags",
    slots: ["input,label"],
    actions: [{ type: "type", target: "input", value: "alpha" }, { type: "press", keys: ["Enter"] }],
    node: <InputTags label="Tags" placeholder="Add a tag" />,
  },
  {
    id: "button-group",
    unit: "button-group",
    slots: ["[role=radiogroup],[role=group],[role=radio]"],
    actions: [{ type: "click", target: "[role=radio]" }],
    node: (
      <ButtonGroup>
        <ButtonGroupItem id="one">One</ButtonGroupItem>
        <ButtonGroupItem id="two">Two</ButtonGroupItem>
      </ButtonGroup>
    ),
  },
  {
    id: "form-submit",
    unit: "form",
    slots: ["form,button"],
    actions: [{ type: "click", target: "button" }],
    node: (
      <Form onSubmit={() => {}}>
        <Input label="Email" name="email" placeholder="you@company.com" />
        <Button type="submit" color="primary" size="md">
          Save
        </Button>
      </Form>
    ),
  },
  { id: "file-upload", unit: "file-upload", slots: ["button"], node: <FileTrigger><Button color="secondary" size="md">Upload</Button></FileTrigger> },
  {
    id: "modal-open",
    unit: "modal",
    slots: ["[role=dialog],button"],
    actions: [{ type: "click", target: "button" }, { type: "press", keys: ["Escape"] }],
    node: (
      <DialogTrigger>
        <Button color="primary" size="md">
          Open dialog
        </Button>
        <Modal>
          <Dialog aria-label="Example dialog">
            <p>Dialog body</p>
            <Button color="secondary" size="md">
              Cancel
            </Button>
          </Dialog>
        </Modal>
      </DialogTrigger>
    ),
  },
  {
    id: "nav-account-card",
    unit: "nav-parts",
    slots: ["button,[role=menu],[role=dialog]"],
    actions: [{ type: "click", target: "button" }, { type: "press", keys: ["Escape"] }],
    node: (
      <NavAccountCard
        items={[
          { id: "caitlyn", name: "Caitlyn King", email: "caitlyn@untitledui.com", avatar: "https://www.untitledui.com/images/avatars/caitlyn-king?fm=webp&q=80", status: "online" },
          { id: "sienna", name: "Sienna Hewitt", email: "sienna@untitledui.com", avatar: "https://www.untitledui.com/images/avatars/sienna-hewitt?fm=webp&q=80", status: "online" },
        ]}
      />
    ),
  },
  { id: "date-picker", unit: "date-picker", slots: ["button,input,label"], node: <DatePicker aria-label="Start date" /> },
  {
    id: "slideout-open",
    unit: "slideout",
    slots: ["[role=dialog],button"],
    actions: [
      { type: "click", target: "button" },
      { type: "press", keys: ["Escape"] },
    ],
    node: (
      <SlideoutMenu.Trigger>
        <Button color="primary" size="md">
          Open slideout
        </Button>
        <SlideoutMenu isDismissable>
          <SlideoutMenu.Content>
            <SlideoutMenu.Header>
              <p>Slideout header</p>
            </SlideoutMenu.Header>
            <p>Slideout body</p>
            <SlideoutMenu.Footer>
              <Button color="secondary" size="md">
                Save
              </Button>
            </SlideoutMenu.Footer>
          </SlideoutMenu.Content>
        </SlideoutMenu>
      </SlideoutMenu.Trigger>
    ),
  },
  {
    id: "multi-select",
    unit: "multi-select",
    slots: ["[role=combobox],button"],
    actions: [
      { type: "click", target: "[role=combobox],button" },
      { type: "press", keys: ["ArrowDown"] },
      { type: "press", keys: ["Enter"] },
      { type: "press", keys: ["ArrowDown"] },
      { type: "press", keys: ["Enter"] },
      { type: "press", keys: ["Escape"] },
    ],
    node: (
      <MultiSelect
        label="Team members"
        placeholder="Select members"
        items={[
          { id: "a", label: "Phoenix Baker" },
          { id: "b", label: "Olivia Rhye" },
          { id: "c", label: "Lana Steiner" },
        ]}
      >
        {(item: SelectItemType) => <MultiSelect.Item id={item.id}>{item.label}</MultiSelect.Item>}
      </MultiSelect>
    ),
  },
  {
    id: "tag-select",
    unit: "tag-select",
    slots: ["input,[role=combobox]"],
    actions: [
      { type: "click", target: "input" },
      { type: "press", keys: ["ArrowDown"] },
      { type: "press", keys: ["Enter"] },
      { type: "press", keys: ["Escape"] },
    ],
    node: (
      <TagSelect
        label="Labels"
        placeholder="Add labels"
        items={[
          { id: "a", label: "Design" },
          { id: "b", label: "Engineering" },
          { id: "c", label: "Research" },
        ]}
        selectedItems={{ items: [], append: () => {}, remove: () => {}, getItem: () => undefined, setFilterText: () => {}, filterText: "" }}
      >
        {(item: SelectItemType) => <TagSelect.Item id={item.id}>{item.label}</TagSelect.Item>}
      </TagSelect>
    ),
  },
];

/** One broken case must not hide the others: each case renders inside its own boundary. */
class CaseBoundary extends Component<{ children: ReactNode; id: string }, { failed: string | null }> {
  state = { failed: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { failed: error instanceof Error ? error.message : String(error) };
  }
  render() {
    if (this.state.failed) return <p data-case-error={this.state.failed} className="text-xs text-utility-red-700">render error: {this.state.failed}</p>;
    return this.props.children;
  }
}

const root = document.getElementById("migration");
if (root) {
  createRoot(root).render(
    <div className="bg-primary p-8">
      {CASES.map((testCase) => (
        <section
          key={testCase.id}
          data-case={testCase.id}
          data-unit={testCase.unit}
          data-slots={JSON.stringify(testCase.slots ?? [])}
          data-actions={JSON.stringify(testCase.actions ?? [])}
          className="mb-6 border-b border-secondary pb-6"
        >
          <p data-case-label className="mb-2 font-mono text-xs text-tertiary">
            {testCase.id}
          </p>
          <div data-case-body>
            <CaseBoundary id={testCase.id}>{testCase.node}</CaseBoundary>
          </div>
        </section>
      ))}
    </div>,
  );
}
