#!/usr/bin/env node
/**
 * State-selector audit (Phase 7).
 *
 *   node compiler/migration/audit-state-selectors.mjs [--json]
 *
 * `registry/untitledui/styles/globals.css` loads `tailwindcss-react-aria-components@2.2.0`, whose variants
 * compile to one of two selectors depending on whether the element carries `data-rac`:
 *
 *   native-backed  (hovered→:hover, focused→:focus, focus-visible→:focus-visible, disabled→:disabled,
 *                   invalid→:invalid, required→:required, readonly→:read-only, active→:active,
 *                   placeholder→:placeholder-shown, open→[open], expanded→[expanded])
 *       with data-rac:    [data-<attr>]
 *       without data-rac: the native selector listed above
 *   attribute-only (selected→[data-selected], pressed→[data-pressed], entering, exiting, unavailable,
 *                   indeterminate, dragging, drop-target, pending, empty, current, placement-*, enums)
 *       always:           [data-<attr>]
 *
 * After the Base UI migration no element carries `data-rac`, so every attribute-only variant must be rewritten
 * to an attribute Base UI actually emits, and every native-backed variant must be satisfied by real element
 * state. This script lists, per file, the variants in use and the verdict, so no React Aria selector can stay
 * silently dead.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

/** From the plugin source (node_modules/tailwindcss-react-aria-components/src/index.js, v2.2.0). */
const NATIVE_BACKED = {
  hovered: ":hover",
  focused: ":focus",
  "focus-visible": ":focus-visible",
  "focus-within": ":focus-within",
  disabled: ":disabled",
  invalid: ":invalid",
  required: ":required",
  readonly: ":read-only",
  "read-only": ":read-only",
  active: ":active",
  placeholder: ":placeholder-shown",
  open: "[open]",
  expanded: "[expanded]",
};
const ATTRIBUTE_ONLY = [
  "selected",
  "pressed",
  "entering",
  "exiting",
  "unavailable",
  "indeterminate",
  "dragging",
  "drop-target",
  "pending",
  "empty",
  "current",
  "has-submenu",
  "allows-removing",
  "allows-sorting",
  "allows-dragging",
  "outside-month",
  "outside-visible-range",
  "selection-start",
  "selection-end",
  "resizing",
];
const ENUM_PREFIXES = ["placement-", "type-", "layout-", "orientation-", "selection-", "resizable-", "sort-"];

/** Attributes Base UI 1.8.0 emits for state, verified from the installed package sources. */
const BASE_UI_ATTRS = new Set(
  (() => {
    const dir = "node_modules/@base-ui/react";
    const attrs = new Set();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const walk = (path) => {
        for (const item of readdirSync(path, { withFileTypes: true })) {
          const child = `${path}/${item.name}`;
          if (item.isDirectory()) walk(child);
          else if (item.name.endsWith(".js") || item.name.endsWith("*DataAttributes.d.ts") || /DataAttributes\.d\.ts$/.test(item.name) || item.name.endsWith(".mjs")) {
          for (const m of readFileSync(child, "utf8").matchAll(/"(data-[a-z-]+)"/g)) attrs.add(m[1].slice(5));
        }
        }
      };
      walk(`${dir}/${entry.name}`);
    }
    return [...attrs];
  })(),
);

/** Variant → the data attribute it expects (for attribute-only variants). */
const expectedAttribute = (variant) => (NATIVE_BACKED[variant] ? `data-${variant}` : `data-${variant}`);

const RA_RE = /from\s+"(react-aria-components|react-aria|react-stately|@react-aria\/[a-z-]+|@react-stately\/[a-z-]+)"/;
const walkFiles = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walkFiles(path, out);
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
};

const findings = [];
for (const file of walkFiles("registry/untitledui/components")) {
  const source = readFileSync(file, "utf8");
  const migrated = !RA_RE.test(source);
  const variants = new Map();
  for (const line of source.split("\n")) {
    for (const match of line.matchAll(/(?:^|[\s"'`])((?:[a-z-]+:)+)/g)) {
      for (const raw of match[1].split(":").filter(Boolean)) {
        const variant = raw.replace(/^(hover|focus|active|group|peer|data|aria|sm|md|lg|xl|2xl|dark|motion-safe|motion-reduce|print|first|last|odd|even|before|after|placeholder|file|marker|selection|disabled|invalid|required)-?.*$/, (m) => m);
        if (NATIVE_BACKED[variant] || ATTRIBUTE_ONLY.includes(variant) || ENUM_PREFIXES.some((p) => variant.startsWith(p))) variants.set(variant, (variants.get(variant) ?? 0) + 1);
      }
    }
  }
  if (variants.size === 0) continue;
  const rows = [...variants.entries()].map(([variant, count]) => {
    const attribute = expectedAttribute(variant);
    const nativeFallback = NATIVE_BACKED[variant] ?? null;
    const emittedByBaseUi = BASE_UI_ATTRS.has(attribute.slice(5));
    const verdict = !migrated
      ? "PENDING_MIGRATION"
      : nativeFallback && !emittedByBaseUi
        ? "NATIVE_FALLBACK_OK"
        : emittedByBaseUi
          ? "OK"
          : "DEAD_SELECTOR";
    return { variant, count, attribute, nativeFallback, emittedByBaseUi, verdict };
  });
  findings.push({ file, migrated, variants: rows.sort((a, b) => b.count - a.count) });
}

const dead = findings.flatMap((f) => f.variants.filter((v) => v.verdict === "DEAD_SELECTOR").map((v) => ({ file: f.file, ...v })));
const pending = findings.flatMap((f) => f.variants.filter((v) => v.verdict === "PENDING_MIGRATION").map((v) => ({ file: f.file, ...v })));

const report = {
  $schema: "design-compiler/BaseUiStateSelectorAudit@p0",
  baseUiAttributesKnown: BASE_UI_ATTRS.size,
  totals: {
    files: findings.length,
    variantsInUse: findings.reduce((n, f) => n + f.variants.length, 0),
    deadSelectors: dead.length,
    pendingMigration: pending.length,
  },
  dead,
  pending,
  files: findings,
};
writeFileSync(".design-compiler/base-ui-migration/state-selectors.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.totals, report: ".design-compiler/base-ui-migration/state-selectors.json", deadSample: dead.slice(0, 8), pendingSample: pending.slice(0, 6) }, null, 2));
process.exit(dead.length ? 1 : 0);
