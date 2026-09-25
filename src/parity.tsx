import { createRoot } from "react-dom/client";
import { Button } from "@/components/base/buttons/button";
import { PlaceholderCircleIcon } from "./fixtures/placeholder-circle";
import "./styles/globals.css";
import "./styles/fonts.css";

/**
 * Parity specimen: the ADOPTED official Button configured exactly like the Figma golden specimen
 * (Buttons/Button, Size=xs, Hierarchy=Primary, State=Default, Icon only=False, leading + trailing icon,
 * label "Button CTA"), rendered at the page origin so the capture can be diffed 1:1 against
 * .design-compiler/reference/golden@2x.png (crop 4,2,284,64).
 *
 * The Figma placeholder circles are reproduced with the harness fixture, exactly as the visual harness
 * does for the compiled benchmark — fixtures reproduce specimens, they are not product API.
 */
createRoot(document.getElementById("parity")!).render(
  <Button size="xs" color="primary" iconLeading={PlaceholderCircleIcon} iconTrailing={PlaceholderCircleIcon}>
    Button CTA
  </Button>,
);
