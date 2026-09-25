/** SSR check for PRO-derived compositions — bun tests/ssr-pro.tsx */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { HelpIcon } from "../registry/pro/help-icon";
import { CheckItemText } from "../registry/pro/check-item-text";
import { ContentHeading, ContentParagraph, ContentDivider, ContentQuote, ContentImage, ContentFeatureText, ContentStack, CONTENT_ITEM_SIZE_SUPPORT } from "../registry/pro/content-item";

const help = renderToString(<HelpIcon title="This is a tooltip" placement="top no arrow" />);
assert.match(help, /<button|<div/, "help icon renders a trigger element");
console.log("ssr pro help-icon ok");

const check = renderToString(<CheckItemText size="lg" color="brand">All features and premium</CheckItemText>);
assert.match(check, /data-pro="check-item-text"/);
assert.match(check, /All features and premium/);
assert.match(check, /text-lg/, "label uses the canonical text-lg scale");
console.log("ssr pro check-item-text ok");

const heading = renderToString(<ContentHeading size="lg">Heading text</ContentHeading>);
assert.match(heading, /data-pro="content-heading"/);
assert.match(heading, /font-semibold/);

const paragraph = renderToString(<ContentParagraph size="lg">Body copy</ContentParagraph>);
assert.match(paragraph, /data-pro="content-paragraph"/);
assert.match(paragraph, /text-tertiary/);

const divider = renderToString(<ContentDivider size="md" />);
assert.match(divider, /role="separator"/);

const quote = renderToString(<ContentQuote align="center" attribution="Ana" attributionRole="CTO">A quote</ContentQuote>);
assert.match(quote, /data-align="center"/);
assert.match(quote, /Ana/);

const image = renderToString(<ContentImage ratio="3:4" src="/x.png" alt="Portrait" caption="Caption" />);
assert.match(image, /data-ratio="3:4"/);
assert.match(image, /aspect-\[3\/4\]/);

const feature = renderToString(
  <ContentFeatureText>
    <ContentHeading size="sm">Nested</ContentHeading>
  </ContentFeatureText>,
);
assert.match(feature, /data-pro="content-feature-text"/);
assert.match(feature, /data-pro="content-heading"/, "feature text nests content items");

const stack = renderToString(
  <ContentStack>
    <ContentParagraph>One</ContentParagraph>
  </ContentStack>,
);
assert.match(stack, /data-pro="content-stack"/);

assert.equal(CONTENT_ITEM_SIZE_SUPPORT.heading.length, 5);
assert.equal(CONTENT_ITEM_SIZE_SUPPORT.divider.length, 5);
console.log("ssr pro content-item ok");

console.log("\nSSR PRO PASSED — PRO compositions render on the server from canonical children");
