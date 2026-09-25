/**
 * SSR check for ADOPTED upstream sources — run with: bun tests/ssr-adopted.tsx
 *
 * Same contract as tests/ssr.tsx but over the source-owned adopted component: it must render on the
 * server with no DOM, no browser globals and no framework imports, because Next.js and TanStack Start
 * render it first.
 */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { Button } from "@/components/base/buttons/button";

const html = renderToString(
  <Button size="xs" color="primary">
    Button CTA
  </Button>,
);
assert.match(html, /<button/, "server render must produce a button element");
assert.match(html, /Button CTA/, "label must be present in server output");
assert.match(html, /data-rac|data-react-aria/, "React Aria wiring expected");
console.log("ssr adopted basic ok");

const link = renderToString(<Button href="https://example.com">Docs</Button>);
assert.match(link, /<a[^>]*href="https:\/\/example.com"/, "href must render an anchor on the server");
console.log("ssr adopted link ok");

const loading = renderToString(<Button isLoading>Save</Button>);
assert.match(loading, /data-icon="loading"|aria-busy/, "loading state must be announced in server output");
console.log("ssr adopted loading ok");

const source = await Bun.file("src/components/base/buttons/button.tsx").text();
assert.ok(!/from "next\//.test(source) && !/from "@tanstack\//.test(source), "adopted source stays framework-agnostic");

console.log("\nSSR ADOPTED PASSED — official source renders under react-dom/server");
