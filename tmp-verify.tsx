import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import "./registry/untitledui/styles/globals.css";
import "./src/styles/fonts.css";

import { Button } from "./registry/untitledui/components/base/buttons/button";
import { Input } from "./registry/untitledui/components/base/input/input";
import { Tabs, TabList, Tab, TabPanel } from "./registry/untitledui/components/application/tabs/tabs";
import { Slider } from "./registry/untitledui/components/base/slider/slider";
import { Tag, TagGroup, TagList } from "./registry/untitledui/components/base/tags/tags";
import { InputNumber } from "./registry/untitledui/components/base/input/input-number";
import { PaymentInput } from "./registry/untitledui/components/base/input/input-payment";
import { InputTags } from "./registry/untitledui/components/base/input/input-tags";
import { Form } from "./registry/untitledui/components/base/form/form";
import { FileTrigger } from "./registry/untitledui/components/base/file-upload-trigger/file-upload-trigger";

type VerifyCase = {
    id: string;
    unit: string;
    slots?: string[];
    actions?: Array<{ type: "click" | "focus" | "hover" | "press" | "type"; target?: string; value?: string; keys?: string[] }>;
    node: ReactNode;
};

const CASES: VerifyCase[] = [
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
    {
        id: "input-payment",
        unit: "input-payment",
        slots: ["input,label"],
        actions: [{ type: "type", target: "input", value: "4242424242424242" }],
        node: <PaymentInput label="Card number" placeholder="Card number" />,
    },
    {
        id: "input-tags",
        unit: "input-tags",
        slots: ["input,label"],
        actions: [
            { type: "type", target: "input", value: "alpha" },
            { type: "press", keys: ["Enter"] },
        ],
        node: <InputTags label="Tags" placeholder="Add a tag" />,
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
