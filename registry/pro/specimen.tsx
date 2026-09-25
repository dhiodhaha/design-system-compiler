import { createRoot } from "react-dom/client";
import { ContentHeading, ContentParagraph, ContentStack, ContentFeatureText, ContentQuote, ContentDivider } from "./content-item";
import "../untitledui/styles/globals.css";
import "../../src/styles/fonts.css";

/**
 * PRO composition specimen: the three deep-read representatives of the licensed PRO family
 * "Content item" (3947:417447), rendered at their Figma frame width (720px desktop) so the DOM can be
 * measured against the sliced evidence:
 *   3947:417423  Type=Heading,     Size=sm, Breakpoint=Desktop  (20/30 w600 #171717, 32/12 spacing)
 *   3947:417429  Type=Paragraph,   Size=lg, Breakpoint=Desktop  (18/28 w400 #525252, 0/18 spacing)
 *   3947:420501  Type=Feature text, Size=md, Breakpoint=Desktop (48/48, nests content items)
 */
const REPRESENTATIVES = [
  { id: "3947:417423", label: "Heading sm", node: <ContentHeading size="sm">Heading text</ContentHeading> },
  { id: "3947:417429", label: "Paragraph lg", node: <ContentParagraph size="lg">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</ContentParagraph> },
  {
    id: "3947:420501",
    label: "Feature text md",
    node: (
      <ContentFeatureText>
        <ContentHeading size="sm">What&apos;s next?</ContentHeading>
        <ContentParagraph size="md">Nested content items composed inside a container.</ContentParagraph>
      </ContentFeatureText>
    ),
  },
  { id: "quote", label: "Quote left md", node: <ContentQuote align="left" size="md">In a world older and more complete than ours they move finished and complete.</ContentQuote> },
  { id: "divider", label: "Divider md", node: <ContentDivider size="md" /> },
];

createRoot(document.getElementById("pro")!).render(
  <div style={{ width: 720 }}>
    {REPRESENTATIVES.map((r) => (
      <div key={r.id} data-rep={r.id} data-label={r.label}>
        {r.node}
      </div>
    ))}
    <div data-rep="stack" data-label="ContentStack">
      <ContentStack>
        <ContentHeading size="lg">Composed stack</ContentHeading>
        <ContentParagraph size="lg">Stacked items keep their own semantic spacing.</ContentParagraph>
        <ContentDivider size="sm" />
      </ContentStack>
    </div>
  </div>,
);
