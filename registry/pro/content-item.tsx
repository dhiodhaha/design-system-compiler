/* PRO composition — compiled from the licensed Untitled UI PRO Figma family "Content item" (set 3947:417447).
 *
 * Provenance: private/proprietary composition. Every visual value comes from a deep read of the family's
 * representative variants plus its shallow variant signatures; nothing is invented. Canonical OSS pieces
 * (theme tokens, Avatar) are reused rather than regenerated.
 *
 * Semantic model (not a mirror of Figma's authoring matrix):
 *   ContentStack        vertical composition container (the family's layoutMode)
 *   ContentHeading      Type=Heading        — w600 text-primary, spacing scales with Size
 *   ContentParagraph    Type=Paragraph      — w400 text-tertiary
 *   ContentDivider      Type=Divider        — hairline rule, symmetric spacing by Size
 *   ContentImage        Type=Image *        — ratio 3:2 | 1:1 | 3:4 with an optional caption
 *   ContentQuote        Type=Quote left/center — align="left" (rule) | align="center" (attribution + avatar)
 *   ContentFeatureText  Type=Feature text   — a container that nests other content items
 *   ContentItem         thin dispatcher over the Figma `Type` values for consumers arriving from Figma
 *
 * Evidence (see .design-compiler/references/untitledui/pro-gap-compile.json):
 *   typography  Heading xs/sm/md/lg/xl = 18/28 20/30 24/32 30/38 36/44 w600 #171717 (text-primary)
 *               Paragraph sm/md/lg/xl  = 14/20 16/24 18/28 20/30 w400 #525252 (text-tertiary)
 *               Quote     sm..2xl      = 16/24 … 30/38 w500 #171717   (Quote left's inner text was not
 *               exposed by the shallow read: it reuses the Quote centre scale — recorded as INFERRED)
 *   spacing     Heading 32/12 … 48/24 (desktop) and 20/8 … 40/20 (mobile), Paragraph 0/14…0/18,
 *               Divider 24/24…64/64, Image & Feature text 48/48 desktop / 40/40 mobile
 *   breakpoints Figma Desktop -> md: ; Figma Mobile -> base (documented, not guessed)
 * Design-tool annotations ("Measure + spacing guide") are excluded: they are Figma tooling, not content.
 */
import type { ReactNode } from "react";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";

// ---------------------------------------------------------------- shared types
export type ContentSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type ContentImageRatio = "3:2" | "1:1" | "3:4";

/** Figma Desktop/Mobile spacing pairs, as measured from the variant signatures. */
const SPACING: Record<string, Partial<Record<ContentSize, string>>> = {
  heading: { xs: "pt-6 pb-3 md:pt-6 md:pb-3", sm: "pt-5 pb-2 md:pt-8 md:pb-3", md: "pt-8 pb-3 md:pt-8 md:pb-4", lg: "pt-8 pb-4 md:pt-10 md:pb-5", xl: "pt-10 pb-5 md:pt-12 md:pb-6" },
  paragraph: { sm: "pb-3.5", md: "pb-4", lg: "pb-4.5", xl: "pb-4.5" },
  divider: { sm: "py-6", md: "py-8", lg: "py-10", xl: "py-12", "2xl": "py-16" },
  media: { md: "py-10 md:py-12" },
  quote: { sm: "py-8 md:py-10", md: "py-8 md:py-10", lg: "py-10 md:py-12", xl: "py-10 md:py-12", "2xl": "py-10 md:py-12" },
};

/** Canonical upstream type scale (theme.css): each Figma size maps onto an existing text-* step. */
const TEXT_STEP: Record<ContentSize, string> = {
  xs: "text-lg", // 18/28
  sm: "text-md md:text-xl", // 16/24 mobile, 20/30 desktop
  md: "text-xl md:text-2xl", // 20/30 mobile, 24/32 desktop
  lg: "text-2xl md:text-3xl", // 24/32 mobile, 30/38 desktop
  xl: "text-3xl md:text-4xl", // 30/38 mobile, 36/44 desktop
  "2xl": "text-2xl md:text-3xl",
};

const PARAGRAPH_STEP: Record<"sm" | "md" | "lg" | "xl", string> = { sm: "text-sm", md: "text-md", lg: "text-lg", xl: "text-xl" };

const QUOTE_STEP: Record<ContentSize, string> = {
  xs: "text-sm",
  sm: "text-md",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
  "2xl": "text-3xl",
};

// ---------------------------------------------------------------- container
export interface ContentStackProps {
  children: ReactNode;
  className?: string;
  /** Figma Desktop/Mobile frame widths (720px desktop, 343px mobile) are container-driven. */
  width?: string;
}

/** The family's layoutMode: a vertical stack whose spacing comes from each child's own scale. */
export const ContentStack = ({ children, className, width = "max-w-[45rem]" }: ContentStackProps) => (
  <div className={cx("flex w-full flex-col", width, className)} data-pro="content-stack">
    {children}
  </div>
);

// ---------------------------------------------------------------- typography items
export interface ContentHeadingProps {
  /** Figma `Size`. */
  size?: Exclude<ContentSize, "2xl">;
  children: ReactNode;
  className?: string;
}

export const ContentHeading = ({ size = "sm", children, className }: ContentHeadingProps) => (
  <h2 className={cx("font-semibold text-primary", TEXT_STEP[size], SPACING.heading[size], className)} data-pro="content-heading" data-size={size}>
    {children}
  </h2>
);

export interface ContentParagraphProps {
  /** Figma `Size`. */
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
  className?: string;
}

export const ContentParagraph = ({ size = "lg", children, className }: ContentParagraphProps) => (
  <p className={cx("text-tertiary", PARAGRAPH_STEP[size], SPACING.paragraph[size], className)} data-pro="content-paragraph" data-size={size}>
    {children}
  </p>
);

export interface ContentDividerProps {
  /** Figma `Size` — symmetric vertical spacing. */
  size?: ContentSize;
  className?: string;
}

export const ContentDivider = ({ size = "md", className }: ContentDividerProps) => (
  <div className={cx(SPACING.divider[size], className)} data-pro="content-divider" data-size={size} role="separator">
    <div className="h-px w-full bg-border-secondary" />
  </div>
);

export interface ContentImageProps {
  /** Figma `Type` (Image landscape 3:2 | Image square 1:1 | Image portrait 3:4). */
  ratio?: ContentImageRatio;
  src: string;
  alt: string;
  caption?: ReactNode;
  className?: string;
}

const RATIO_CLASS: Record<ContentImageRatio, string> = { "3:2": "aspect-[3/2]", "1:1": "aspect-square", "3:4": "aspect-[3/4]" };

export const ContentImage = ({ ratio = "3:2", src, alt, caption, className }: ContentImageProps) => (
  <figure className={cx("w-full", SPACING.media.md, className)} data-pro="content-image" data-ratio={ratio}>
    <img src={src} alt={alt} className={cx("w-full rounded-lg object-cover", RATIO_CLASS[ratio])} />
    {caption ? <figcaption className="mt-3 text-sm text-tertiary">{caption}</figcaption> : null}
  </figure>
);

export interface ContentQuoteProps {
  /** Figma `Type=Quote left` (a rule beside the quote) or `Quote center` (attribution + avatar). */
  align?: "left" | "center";
  size?: ContentSize;
  attribution?: string;
  attributionRole?: string;
  avatarSrc?: string;
  children: ReactNode;
  className?: string;
}

export const ContentQuote = ({ align = "left", size = "md", attribution, attributionRole, avatarSrc, children, className }: ContentQuoteProps) => (
  <blockquote className={cx("w-full", SPACING.quote[size], className)} data-pro="content-quote" data-align={align} data-size={size}>
    {align === "left" ? (
      <div className="flex gap-6">
        <div className="w-px shrink-0 self-stretch bg-border-secondary" aria-hidden="true" />
        <p className={cx("font-medium text-primary", QUOTE_STEP[size])}>{children}</p>
      </div>
    ) : (
      <div className="flex flex-col items-center gap-6 text-center">
        <p className={cx("font-medium text-primary", QUOTE_STEP[size])}>{children}</p>
        {attribution || avatarSrc ? (
          <div className="flex items-center gap-3">
            {avatarSrc ? <Avatar size="sm" src={avatarSrc} alt={attribution ?? ""} /> : null}
            <div className="flex flex-col">
              {attribution ? <span className="text-md font-medium text-primary">{attribution}</span> : null}
              {attributionRole ? <span className="text-sm text-tertiary">{attributionRole}</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    )}
  </blockquote>
);

export interface ContentFeatureTextProps {
  children: ReactNode;
  className?: string;
}

/** Figma `Type=Feature text`: a container that nests content items (it is a composition, not a text style). */
export const ContentFeatureText = ({ children, className }: ContentFeatureTextProps) => (
  <section className={cx("w-full rounded-xl bg-secondary", SPACING.media.md, className)} data-pro="content-feature-text">
    <div className="flex w-full flex-col gap-8 px-8">{children}</div>
  </section>
);

// ---------------------------------------------------------------- dispatcher
export type ContentItemType =
  | "heading"
  | "paragraph"
  | "feature-text"
  | "quote-left"
  | "quote-center"
  | "image-landscape-3-2"
  | "image-square-1-1"
  | "image-portrait-3-4"
  | "divider";

/** Figma `Type` axis -> semantic component (the axis is evidence; this mapping is the API decision). */
export const FIGMA_TYPE_TO_ITEM: Record<string, ContentItemType> = {
  Heading: "heading",
  Paragraph: "paragraph",
  "Feature text": "feature-text",
  "Quote left": "quote-left",
  "Quote center": "quote-center",
  "Image landscape 3:2": "image-landscape-3-2",
  "Image square 1:1": "image-square-1-1",
  "Image portrait 3:4": "image-portrait-3-4",
  Divider: "divider",
};

/** Convenience dispatcher; the semantic components above remain the public surface. */
export interface ContentItemProps {
  /** Figma `Type` value (see FIGMA_TYPE_TO_ITEM). */
  type: ContentItemType;
  content: ReactNode;
  size?: ContentSize;
  imageProps?: { src: string; alt: string; caption?: ReactNode };
  quoteProps?: { attribution?: string; attributionRole?: string; avatarSrc?: string };
  className?: string;
}

export const ContentItem = ({ type, content, size = "md", imageProps, quoteProps, className }: ContentItemProps) => {
  switch (type) {
    case "heading":
      return <ContentHeading size={size as Exclude<ContentSize, "2xl">} className={className}>{content}</ContentHeading>;
    case "paragraph":
      return <ContentParagraph size={size as "sm" | "md" | "lg" | "xl"} className={className}>{content}</ContentParagraph>;
    case "divider":
      return <ContentDivider size={size} className={className} />;
    case "quote-left":
      return <ContentQuote align="left" size={size} className={className}>{content}</ContentQuote>;
    case "quote-center":
      return <ContentQuote align="center" size={size} {...quoteProps} className={className}>{content}</ContentQuote>;
    case "image-landscape-3-2":
      return <ContentImage ratio="3:2" {...(imageProps ?? { src: "", alt: "" })} className={className} />;
    case "image-square-1-1":
      return <ContentImage ratio="1:1" {...(imageProps ?? { src: "", alt: "" })} className={className} />;
    case "image-portrait-3-4":
      return <ContentImage ratio="3:4" {...(imageProps ?? { src: "", alt: "" })} className={className} />;
    case "feature-text":
      return <ContentFeatureText className={className}>{content}</ContentFeatureText>;
    default:
      return null;
  }
};

export const CONTENT_ITEM_SIZE_SUPPORT: Record<ContentItemType, ContentSize[]> = {
  heading: ["xs", "sm", "md", "lg", "xl"],
  paragraph: ["sm", "md", "lg", "xl"],
  divider: ["sm", "md", "lg", "xl", "2xl"],
  "quote-left": ["sm", "md", "lg", "xl", "2xl"],
  "quote-center": ["sm", "md", "lg", "xl", "2xl"],
  "image-landscape-3-2": ["md"],
  "image-square-1-1": ["md"],
  "image-portrait-3-4": ["md"],
  "feature-text": ["sm", "md"],
};
