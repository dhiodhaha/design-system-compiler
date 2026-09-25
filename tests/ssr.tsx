/**
 * SSR / framework portability check — run with: bun tests/ssr.tsx
 *
 * Next.js and TanStack Start render the component on the server first, so the component must render
 * without a DOM, without browser globals, and without pulling in framework-specific modules.
 * This asserts the server output, which is the contract both frameworks consume.
 */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { Button, buttonVariants } from "../src/components/ui/button";

const render = (el: React.ReactElement) => renderToString(el);

// 1. server render works and emits the public contract
const basic = render(
  <Button variant="secondary" size="md">
    Save
  </Button>,
);
assert.match(basic, /<button[^>]*data-variant="secondary"/, "variant attribute expected in SSR output");
assert.match(basic, /data-size="md"/);
assert.match(basic, /data-ds-button/);
assert.match(basic, />Save</);
console.log("ssr basic ok:", basic.slice(0, 120));

// 2. composition form resolves on the server too (no useEffect/measure involved)
const composed = render(
  <Button>
    <svg data-testid="leading" />
    Add user
  </Button>,
);
assert.match(composed, /data-slot="icon"/, "leading element child must become the leading visual on the server");
assert.match(composed, /data-slot="label"/);
console.log("ssr composition ok");

// 3. loading renders the spinner, aria-busy and the provided loading text
const loading = render(
  <Button loading loadingText="Saving…" variant="primary">
    Save
  </Button>,
);
assert.match(loading, /aria-busy="true"/);
assert.match(loading, /aria-disabled="true"/);
assert.match(loading, /data-slot="spinner"/);
assert.match(loading, /Saving…/);
console.log("ssr loading ok");

// 4. disabled keeps native semantics
const disabled = render(<Button disabled>Delete</Button>);
assert.match(disabled, /\sdisabled=""/, "native disabled attribute expected");
console.log("ssr disabled ok");

// 5. shadcn-grade surface: icon size sugar, data-icon markers, buttonVariants on a plain anchor
const iconSize = render(
  <Button size="icon-lg" aria-label="Settings">
    <svg />
  </Button>,
);
assert.match(iconSize, /data-size="lg"/);
assert.match(iconSize, /data-icon-only="true"/, "icon size sugar must set the icon-only layout");

const marked = render(
  <Button>
    <svg data-icon="inline-start" />
    Label
  </Button>,
);
assert.match(marked, /data-slot="icon"/);
assert.match(marked, /data-slot="label"/);

const asLink = render(
  <a href="/login" {...buttonVariants({ variant: "secondary", size: "sm" })}>
    Login
  </a>,
);
assert.match(asLink, /<a[^>]*data-variant="secondary"/, "buttonVariants must produce the styling contract");
assert.match(asLink, /data-size="sm"/);
assert.match(asLink, /data-slot="button"/);
console.log("ssr shadcn-surface ok");

// 6. no browser globals were touched, and the module stays framework-agnostic
const source = await Bun.file("src/components/ui/button.tsx").text();
assert.ok(!/from "next\//.test(source) && !/from "@tanstack\//.test(source), "component must not import a framework");
assert.ok(!/\bwindow\.|\bdocument\./.test(source.replace(/\/\*[\s\S]*?\*\//g, "")), "component must not touch browser globals at module scope");
console.log("ssr portability ok");

console.log("\nSSR CHECK PASSED — renders under react-dom/server with no DOM and no framework imports");
