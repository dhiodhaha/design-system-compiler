/* PRO composition — compiled from the licensed Untitled UI PRO Figma family "Check item text" (set 1345:1610).
 *
 * Provenance: private/proprietary composition. Reuses canonical OSS components (adopted, MIT):
 *   • FeaturedIcon (theme="light") — components/foundations/featured-icon/featured-icon.tsx
 *
 * Figma evidence for the representative variant (Type=Default, Size=lg, Color=Brand, Breakpoint=Desktop):
 *   box 400x32, gap 12  -> flex row, gap-3
 *   icon badge 32x32, #F4EBFF background, #7F56D9 glyph -> FeaturedIcon light/brand/sm (size-8 = 32px,
 *   --color-brand-100 background, --color-brand-600 glyph) — both values are canonical theme tokens
 *   label 18/28 weight 400 #525252 -> text-lg text-tertiary (--text-lg 18/28, --color-text-tertiary)
 * Figma axes map to props: Size -> size, Color -> color, Type -> content shape, Breakpoint -> consumer layout.
 * Do not redistribute: PRO-derived file.
 */
import type { FC, ReactNode } from "react";
import { CheckCircle } from "@untitledui/icons";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { cx } from "@/utils/cx";

export interface CheckItemTextProps {
  /** Figma `Size` axis (the badge stays size-8 for lg; smaller sizes scale the label). */
  size?: "sm" | "md" | "lg";
  /** Figma `Color` axis. */
  color?: "brand" | "gray" | "error";
  /** Figma `Type=Default|Icon` glyph; defaults to the check-circle used in the source. */
  icon?: FC<{ className?: string }>;
  children: ReactNode;
  className?: string;
}

const LABEL_SIZE: Record<NonNullable<CheckItemTextProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-md",
  lg: "text-lg",
};

export const CheckItemText = ({ size = "lg", color = "brand", icon: Icon = CheckCircle, children, className }: CheckItemTextProps) => (
  <div className={cx("flex items-center gap-3", className)} data-pro="check-item-text">
    <FeaturedIcon theme="light" color={color} size="sm" icon={Icon} />
    <span className={cx("text-tertiary", LABEL_SIZE[size])}>{children}</span>
  </div>
);
