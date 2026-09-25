import { createRoot } from "react-dom/client";
import { Button, styles } from "@/components/base/buttons/button";
import { Check, Plus, ArrowRight, Trash01 } from "@untitledui/icons";
// Canonical upstream stylesheet, adopted verbatim: tailwind + upstream theme tokens + plugins.
import "./styles/globals.css";
// Project font stack: upstream's theme asks for Inter; Figma renders Inter, so both must resolve to it.
import "./styles/fonts.css";

/**
 * Specimen for the ADOPTED official Untitled UI Button (source-owned, unmodified apart from the
 * provenance header). The variant grid is generated from the extracted reference contract, so the
 * specimen can never drift from the contract it is meant to demonstrate.
 *
 * Registry vocabulary (contracts/button.json): sizes xs..xl, colors including the destructive and link
 * colours, icon slots via iconLeading/iconTrailing or an element child, loading via isLoading.
 */
const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
const COLORS = ["primary", "secondary", "tertiary", "link-color", "link-gray", "primary-destructive", "secondary-destructive", "tertiary-destructive", "link-destructive"] as const;

const row = (label: string, children: React.ReactNode) => (
  <section style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderBottom: "1px solid #f2f4f7" }}>
    <span style={{ width: 168, fontSize: 12, color: "#667085", fontFamily: "ui-monospace, monospace" }}>{label}</span>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>{children}</div>
  </section>
);

createRoot(document.getElementById("adopted")!).render(
  <div data-slot="specimen-adopted" style={{ padding: 8 }}>
    {COLORS.map((color) =>
      row(
        `color=${color}`,
        SIZES.map((size) => (
          <Button key={`${color}-${size}`} color={color} size={size}>
            Button
          </Button>
        )),
      ),
    )}
    {row("iconLeading", <Button iconLeading={Plus}>Add user</Button>)}
    {row("iconTrailing", <Button iconTrailing={ArrowRight}>Continue</Button>)}
    {row("composition", (
      <Button>
        <Plus data-icon="leading" className={styles.common.icon} />
        Element child
      </Button>
    ))}
    {row("icon only (isIcon)", <Button iconLeading={Check} aria-label="Confirm" />)}
    {row("isLoading", <Button isLoading>Loading</Button>)}
    {row("isLoading + text", <Button isLoading showTextWhileLoading>Loading with text</Button>)}
    {row("isDisabled", <Button isDisabled iconLeading={Trash01}>Delete</Button>)}
    {row("href (link)", <Button href="https://example.com">Link styled button</Button>)}
    {row("noTextPadding", <Button noTextPadding>No text padding</Button>)}
    <div data-slot="adopted-mark" style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1 }} />
  </div>,
);
