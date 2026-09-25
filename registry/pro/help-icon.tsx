/* PRO composition — compiled from the licensed Untitled UI PRO Figma family "Help icon" (set 1054:13).
 *
 * Provenance: private/proprietary composition. Reuses canonical OSS components (adopted, MIT):
 *   • Tooltip + TooltipTrigger  — components/base/tooltip/tooltip.tsx
 *   • HelpCircle icon           — @untitledui/icons (official package)
 * The composition itself follows the canonical usage published in the OSS demo
 * (components/base/tooltip/tooltip.demo.tsx), with the Figma axes mapped 1:1:
 *   Tooltip axis        -> placement   (Top no arrow -> "top" without arrow; the rest -> "arrow")
 *   Supporting text     -> title + description
 *   Cursor / Open axes  -> interaction states, already handled by the canonical Tooltip
 * Do not redistribute: PRO-derived file.
 */
import type { FC, ReactNode } from "react";
import { HelpCircle } from "@untitledui/icons";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { TooltipTrigger } from "@/components/base/tooltip/tooltip";

export interface HelpIconProps {
  /** Figma `Tooltip` axis. "top no arrow" renders without the overlay arrow. */
  placement?: "top" | "top left" | "top right" | "bottom" | "left" | "right" | "top no arrow";
  /** Figma `Supporting text=True`. */
  supportingText?: ReactNode;
  /** Tooltip title (Figma `Tooltip` text). */
  title: ReactNode;
  className?: string;
  icon?: FC<{ className?: string }>;
}

const FIGMA_PLACEMENT: Record<NonNullable<HelpIconProps["placement"]>, string> = {
  top: "top",
  "top left": "top left",
  "top right": "top right",
  bottom: "bottom",
  left: "left",
  right: "right",
  "top no arrow": "top",
};

export const HelpIcon = ({ placement = "top no arrow", supportingText, title, className, icon: Icon = HelpCircle }: HelpIconProps) => (
  <Tooltip title={title} description={supportingText} arrow={placement !== "top no arrow"} placement={FIGMA_PLACEMENT[placement] as never}>
    <TooltipTrigger
      className={
        className ??
        "group relative flex size-4 cursor-pointer items-center justify-center text-fg-quaternary transition duration-100 ease-linear hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover"
      }
    >
      <Icon className="size-4" />
    </TooltipTrigger>
  </Tooltip>
);
