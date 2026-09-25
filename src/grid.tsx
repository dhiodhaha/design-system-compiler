import { createRoot } from "react-dom/client";
import index from "../.design-compiler/ir/button.index.json";
import { PlaceholderCircleIcon } from "./fixtures/placeholder-circle";
import { Button, type ButtonSize, type ButtonVariant, type ButtonVisualState } from "./components/ui/button";
import "./index.css";

/**
 * Full-matrix specimen stage.
 *
 * Mirrors the Figma component set exactly: the same frame, and every variant placed at the coordinates
 * Figma reports for it. One screenshot of this stage can therefore be diffed, pixel for pixel, against
 * `.design-compiler/reference/button-set@1x.png` — 200 variants, one capture, no per-variant exports.
 *
 * Recorded exception: `--dsb-label-width` pins each label's box to the Figma text-node width (Figma rounds
 * the hug text box up to whole pixels; Chromium keeps the fractional advance). See exceptions.json.
 */

const VARIANT: Record<string, ButtonVariant> = {
  Primary: "primary",
  Secondary: "secondary",
  Tertiary: "tertiary",
  "Link color": "link-color",
  "Link gray": "link-gray",
};

const SUPPORTS_ICON_ONLY: Record<string, true> = { Primary: true, Secondary: true, Tertiary: true };

createRoot(document.getElementById("grid")!).render(
  <div
    id="stage"
    style={{
      position: "relative",
      width: index.frame.size.w,
      height: index.frame.size.h,
      background: index.frame.background ?? "#fff",
      borderRadius: index.frame.radius,
      boxShadow: index.frame.border ? `inset 0 0 0 ${index.frame.borderWidth}px ${index.frame.border}` : undefined,
    }}
  >
    {index.variants.map((variant) => {
      const { Size, Hierarchy, State, "Icon only": iconOnly } = variant.axes;
      if (iconOnly === "True" && !SUPPORTS_ICON_ONLY[Hierarchy]) return null;
      const label = variant.sig.label;
      // Figma spells states with capitals; the public contract is lowercase (see button.abi.ts)
      const forced = State === "Default" ? undefined : (State.toLowerCase() as ButtonVisualState);
      const icons = variant.sig.icons.filter((i) => i.kind === "placeholder").length;
      return (
        <div
          key={variant.nodeId}
          data-key={`${Size}/${Hierarchy}/${State}/${iconOnly}`}
          style={{
            position: "absolute",
            left: variant.at.x - index.frame.origin.x,
            top: variant.at.y - index.frame.origin.y,
            ["--dsb-label-width" as string]: label ? `${label.box.w}px` : undefined,
          }}
        >
          <Button
            variant={VARIANT[Hierarchy]}
            size={Size as ButtonSize}
            iconOnly={iconOnly === "True"}
            loading={State === "Loading"}
            loadingText={label?.text}
            state={forced}
            disabled={State === "Disabled"}
            aria-label={iconOnly === "True" ? `${Hierarchy} ${Size} icon only specimen` : undefined}
            leadingIcon={icons > 0 && !variant.sig.icons.some((i) => i.kind === "spinner") ? <PlaceholderCircleIcon /> : undefined}
            trailingIcon={icons > 1 ? <PlaceholderCircleIcon /> : undefined}
          >
            {iconOnly === "True" ? <PlaceholderCircleIcon /> : label?.text}
          </Button>
        </div>
      );
    })}
  </div>,
);
