import { createRoot } from "react-dom/client";
import { Button } from "./components/ui/button";
import { PlaceholderCircleIcon } from "./fixtures/placeholder-circle";
import "./index.css";

/**
 * Golden specimen stage (Figma node 12246:5764).
 * Renders only the specimen, at the origin, so screenshot clip coordinates == DOM coordinates:
 * box 142x32 @ (0,0) -> captures compare 1:1 against a crop of .design-compiler/reference/golden@{1,2}x.png.
 */
createRoot(document.getElementById("specimen")!).render(
  <Button
    size="xs"
    leadingIcon={<PlaceholderCircleIcon />}
    trailingIcon={<PlaceholderCircleIcon />}
  >
    Button CTA
  </Button>,
);
