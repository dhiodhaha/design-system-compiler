/** SSR check for PRO-derived compositions — bun tests/ssr-pro.tsx */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { HelpIcon } from "../registry/pro/help-icon";
import { CheckItemText } from "../registry/pro/check-item-text";

const help = renderToString(<HelpIcon title="This is a tooltip" placement="top no arrow" />);
assert.match(help, /<button|<div/, "help icon renders a trigger element");
console.log("ssr pro help-icon ok");

const check = renderToString(<CheckItemText size="lg" color="brand">All features and premium</CheckItemText>);
assert.match(check, /data-pro="check-item-text"/);
assert.match(check, /All features and premium/);
assert.match(check, /text-lg/, "label uses the canonical text-lg scale");
console.log("ssr pro check-item-text ok");

console.log("\nSSR PRO PASSED — PRO compositions render on the server from canonical children");
