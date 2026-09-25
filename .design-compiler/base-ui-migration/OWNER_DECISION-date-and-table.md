# Owner decision: the date and table components

Base UI 1.8.0 has **no** date or table primitives. This is not an opinion: the pinned package's export
surface (80 subpaths, listed in `docs/_base-ui-1.8.0-export-surface.json`) contains no calendar/date-field/
date-picker/time-field/table/tree/grid entry, the official docs index has no page for them, and
`docs/{calendar,date-field,date-picker,date-range-picker,time-field,table,tree,grid-list}.json` each record
`exists: false` with that evidence. Date scaffolding exists only as internal temporal helpers with no public
widget.

Seven canonical files therefore cannot be expressed in Base UI:

| file | React Aria usage |
| --- | --- |
| `application/date-picker/calendar.tsx` | Calendar, CalendarContext, CalendarGrid(+Header/Body) |
| `application/date-picker/range-calendar.tsx` | RangeCalendar, calendar grid parts, useDateFormatter |
| `application/date-picker/cell.tsx` | CalendarCell, RangeCalendarContext, useLocale, useSlottedContext |
| `application/date-picker/date-picker.tsx` | DatePicker, Dialog, Group, useControlledState, useDateFormatter |
| `application/date-picker/date-range-picker.tsx` | DateRangePicker, the same supporting hooks |
| `base/input/input-date.tsx` | DateField, DateInput, DateSegment, Group |
| `application/table/table.tsx` | Table, TableHeader/Column/Row/Cell/Body, Collection |

## The three options

**A. Keep React Aria for these seven files.** The migration's residue gate would need an explicit, documented
allow-list for this family. Cost: `react-aria-components` stays a runtime dependency (bundled for anyone who
imports these components); the "zero React Aria" acceptance criterion cannot be met. No new dependencies, no
visual or behavioural risk, date/table semantics stay exactly as they are today (the parity baseline passes
untouched).

**B. Replace them with a specialized dependency.** The migration's own rule for this case is
`Base UI → native platform → already-approved specialized dependency → small local adapter`, so the choice is
yours to approve. Candidate shapes:

| need | candidate | note |
| --- | --- | --- |
| calendar + date picker + range picker | `react-day-picker` | unstyled, headless-ish, date-fns based; the payload's date-picker visual layer would be re-attached to it |
| date *input* segments (mm/dd/yyyy fields) | `@internationalized/date` + a small local adapter, or keep the field UI and back it with native `<input type="date">` | native loses segment-level editing and the current keyboard model |
| data table | `@tanstack/react-table` | headless; the payload's Table markup/classes stay, the collection/selection model is replaced |

Cost: two or three new dependencies, a new visual-parity baseline for these components (their Figma mapping
exists — `docs/FIGMA_SLICING.md` — so parity can be measured the same way), and a real behavioural migration
effort (this is the largest single family left).

**C. Drop the components from the Base UI-backed library.** They stay available in the React Aria-backed
registry only. Cost: the "free components, Base UI underneath" library is incomplete for date and table use
cases; no new work, no new dependencies.

## What each option does to the acceptance gates

| gate | A | B | C |
| --- | --- | --- | --- |
| no React Aria in canonical runtime | fails (documented allow-list) | passes | passes |
| `react-aria-components` removable from package.json | no | yes | yes |
| clean install without React Aria | no | yes | yes |
| visual/behavioural risk | none | medium (re-baselined) | none |
| new dependencies | none | 2–3 | none |
| library completeness | full | full | missing date + table |

## Recommendation in absence of a decision

Do nothing irreversible: these seven files are untouched by the migration so far, their Figma evidence and
registry entries are intact, and the migration matrix records them as `NO_BASE_UI_EQUIVALENT` with this
document as the reason. Every other family can proceed to `BASE_UI_VERIFIED` without them; only the final
package removal and the clean-install gate wait on this choice.

To pick up option B later, the work is: approve the dependency, capture a fresh React Aria baseline for the
date/table harness cases (still possible while these files keep their React Aria code), migrate the seven
files, then run the same parity/a11y/hydration gates that every other unit goes through.
