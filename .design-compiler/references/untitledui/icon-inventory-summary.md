# Icon inventory — official packages, local OSS icon components, Figma mapping

Packages: `@untitledui/icons@0.0.22` (license field: MIT), `@untitledui/file-icons@0.0.9` (license field: MIT)
Local OSS icon sources: 6 (114 files, 113 exports) — MIT.
Figma pages in scope: 5 / families: 2221.

## Package surface

| package | version | license field | d.ts files | exports | sample |
|---|---|---|---|---|---|
| `@untitledui/icons` | 0.0.22 | MIT (+ shipped LICENSE restrictions) | 1180 | 1179 | ActivityHeart, Activity, Airplay, Airpods, AlarmClockCheck, AlarmClockMinus |
| `@untitledui/file-icons` | 0.0.9 | MIT (no LICENSE file shipped) | 159 | 1 | FileIcon |

## Local OSS icon components (MIT)

| source | class | files | exports |
|---|---|---|---|
| `components/foundations/payment-icons` | PAYMENT_BRAND_ICON | 57 | 56 |
| `components/foundations/social-icons` | SOCIAL_BRAND_ICON | 23 | 22 |
| `components/foundations/integration-icons` | INTEGRATION_BRAND_ICON | 17 | 16 |
| `components/foundations/featured-icon` | ICON_CONTAINER | 1 | 1 |
| `components/foundations/dot-icon.tsx` | ICON_PRIMITIVE | 1 | 1 |
| `components/shared-assets` | MIXED_ASSET | 15 | 18 |

## Figma icon-ish pages

| page | families | icons | file-icons | local OSS | unresolved | PRO-only candidates |
|---|---|---|---|---|---|---|
| Icons (`3463:407484`) | 1173 | 1170 | 0 | 0 | 3 | 3 |
| Misc icons (`1025:31781`) | 1026 | 4 | 2 | 17 | 1003 | 982 |
| Logos (`1083:118533`) | 4 | 0 | 0 | 0 | 4 | 0 |
| Background elements (`4938:371336`) | 4 | 0 | 0 | 1 | 3 | 0 |
| Miscellaneous assets (`1291:157819`) | 14 | 0 | 0 | 2 | 12 | 0 |
| **total** | **2221** | **1174** | **2** | **20** | **1025** | **985** |

## Unresolved families by classification

| classification | count | rules |
|---|---|---|
| PRO_ONLY_ICON_CANDIDATE | 985 | page-icon-surface-unresolved (985) |
| DUPLICATE_OF_RESOLVED | 19 | brand-stem-local-component (10), qualifier-stripped-stem-package-export (2), stem-token-source-family (6), numbered-package-family-style-wrapper (1) |
| HELPER_OR_INTERNAL | 3 | internal-underscore-prefix (3) |
| NON_ICON_ASSET | 18 | composite-not-icon (3), page-logos-brand-asset (4), page-misc-asset-decor (9), page-background-decor-asset (2) |

## Licensing

- Free packages: `REDISTRIBUTABLE_AS_NPM_DEPENDENCY` — consumed as an npm dependency, never vendored.
  - icons LICENSE: Use the icons in personal and commercial projects
  - icons LICENSE: Sell, sublicense, or distribute the icons (in original or modified form)
  - icons LICENSE: Create derivative icon libraries based on the icons
  - icons LICENSE: Use the icons in any form of UI kit, library, or template intended for resale
- PRO icon surface (985 candidates): `NEVER_REDISTRIBUTE` — separate licensed artifacts, never part of this repository.
- Local extractions of PRO-only icons: `PRIVATE_ONLY` (names, counts and license/redistribution metadata only — no glyph data, no package source, no Figma payload).
