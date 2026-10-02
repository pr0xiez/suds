# Suds design system

One system for every surface: the owner app, the customer portal, public booking
pages, account screens, and the landing page. Tokens live in `app/globals.css`;
primitives live in `components/ui.tsx`. `app/(app)/dashboard/page.tsx` and
`app/page.tsx` are the reference implementations.

## Character

Gloss black and one lime signal. The tools a detailer uses outdoors on a phone:
high contrast, large touch targets, nothing decorative. Neutrals are graphite
with a faint lime cast. Lime is the brand and appears sparingly: active nav, the
logo, selected states, links, focus rings, and the one hero action on public
pages.

## Color: semantic tokens only

Never use raw Tailwind palette colors (`slate-*`, `cyan-*`, `emerald-*`, `white`,
`black`). Use the token utilities, which switch for dark mode and print on their
own. No `dark:` variants are needed in page code.

| Use | Utilities |
| --- | --- |
| Page background | `bg-canvas` |
| Panels, inputs | `bg-surface` |
| Subtle fill, hover rows, tracks | `bg-surface-2`, stronger `bg-surface-3` |
| Hairlines | `border-line`, `divide-line`; control borders `border-line-strong` |
| Text | `text-ink` primary, `text-ink-muted` secondary, `text-ink-faint` meta/placeholder |
| Primary action | `bg-primary text-on-primary` (graphite in light, lime in dark) |
| Accent | `bg-accent text-on-accent` fill; `text-accent-ink` text/links/icons; `bg-accent-soft border-accent-line` selected |
| Sidebar / dark bars | `bg-chrome`, `bg-chrome-2`, `border-chrome-line`, `text-chrome-ink`, `text-chrome-muted` |
| Status | `info` (scheduled), `warn` (in progress, unpaid, pending), `ok` (done, paid, posted), `danger` (no-show, overdue, errors). Each has `-soft` (bg) and `-line` (border); bare name is the text color. |

Status is always color plus words. Do not invent extra accents; platforms are told
apart by their logo icon, not a color.

## Type

- Geist Sans for everything (`font-sans`, the default). `tabular-nums` on times,
  money, and counts.
- `font-display` (Archivo, width-expanded) only for page titles, section
  headings on public pages, and stat numbers. Never for body or labels.
- Geist Mono (`font-mono`) only for machine-ish strings: plates, invoice numbers,
  IDs.
- Labels and table headers are sentence case `text-sm font-medium` /
  `text-xs font-medium text-ink-muted`. No uppercase wide-tracking eyebrows.

## Shape (locked)

- Panels and cards: `rounded-panel` (16px). Large hero media: `rounded-[1.25rem]`.
- Buttons, inputs, thumbnails, segmented controls: `rounded-control` (10px).
  An item nested inside a padded control uses `rounded-[0.5rem]`.
- Dense items (calendar blocks, platform glyph chips): `rounded-tight` (6px).
- Badges, avatars, toggles: `rounded-full`.

No other radii. Shadows: `shadow-panel` on panels, `shadow-float` on popovers.

## Primitives (`components/ui.tsx`)

- Buttons: `btnPrimary`, `btnSecondary`, `btnGhost`, `btnDanger`, `btnAccent`
  (public pages only); append `btnSmall` for compact. Put a Phosphor icon
  before the label for creation/confirm actions (`<PlusIcon aria-hidden />New job`).
- Controls: `inputClass`, `selectClass`, `textareaClass`; `Field` (label above,
  optional `hint`, optional `error`). Placeholders are examples, never labels.
- `PageHeader` (title, subtitle, actions, optional `back={{ href, label }}` for
  detail pages), `Card` (panel with optional header; `padded={false}` for lists
  and tables), `EmptyState` (icon, title, hint, action), `Callout` (tinted
  page-level prompt with icon and action), `Badge` (tone pill), `StatTile`
  (frameless; group tiles in a `gap-px bg-line` grid like the dashboard).
- Status: `JobStatusBadge`, `PostStatusBadge`, `PlatformChips`, `PhotoKindBadge`,
  `JOB_STATUS_META[status].chip` for calendar blocks.
- Filters: `segmentTrack` + `segmentClass(active)`.
- Tables: `thClass`, `tdClass`; rows `divide-y divide-line`, hover
  `hover:bg-surface-2`.
- `linkClass` for inline text links. `ErrorBanner` / `SuccessBanner` in
  `components/banners.tsx`. `bookingInput` / `bookingButton` are the roomier
  customer-facing aliases.

## Icons

Phosphor only, imported from `@phosphor-icons/react/ssr` (works in server and
client components), using the `...Icon` names (`CalendarBlankIcon`). Regular
weight. Size with `className="size-4"` (inline/buttons pick it up
automatically), `size-5` in empty states. Always `aria-hidden` when next to text.
No Unicode glyph icons (`→ ← ✓ ✦ ☰ ▦ ↗`) and no emoji in UI chrome or copy.

## Layout

- Page: `PageHeader` then content; sections separated by `mt-6` (related) or
  `mt-10` (new topic).
- **Every multi-column grid starts with `grid-cols-1`**, then adds columns at a
  breakpoint (`grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`).
  An implicit `auto` track lets one long unbroken string widen the whole page on
  phones. Flex children that hold text get `min-w-0`.
- Mobile first. Tables scroll inside their card (`overflow-x-auto`); the page
  never scrolls sideways. Touch targets are at least 40px (`min-h-10`).
- Use cards for real groups. Inside a card, separate rows with `divide-y
  divide-line`, not more cards.
- The app shell adds a fixed phone tab bar; `main` already has bottom padding.

## Copy

- No em dashes or en dashes in visible text. Use a comma, a period, a colon, or
  parentheses. Ranges use a hyphen (`7 AM-8 PM`). Empty table cells say what is
  missing in words (`Unpaid`, `None`) or stay blank, never `—`.
- At most one middle dot `·` per line.
- Plain, specific verbs. Keep the existing product voice; do not add claims.

## Motion

App surfaces: hover and press only (`active:scale-[0.98]` is built into the
buttons). The landing and account pages use `animate-rise` for entry and
`.reveal` for scroll reveal; both respect reduced motion via `globals.css`.

## Dark mode and print

Follows the system setting through the tokens. Check both modes. Print always
uses the light set; add `no-print` to chrome that should not print.

## Photography

`public/landing/` holds Unsplash License photos used on the landing and account
pages: `hero.jpg` (Sem Ramon, unsplash.com/photos/jVm9stv6UpE), `polish.jpg`
(Neelabh Raj, unsplash.com/photos/cw1914zDHUs), `interior.jpg` (Luay Barani,
unsplash.com/photos/5SmPnmCjwcU). Business booking pages do not use stock photos;
only a business's own approved photos could honestly represent its work.
