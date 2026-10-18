---
name: Strike Zone
description: An options income journal run like a station departures board.
colors:
  concourse-floor: "oklch(0.953 0.004 240)"
  enamel-panel: "oklch(0.99 0.002 240)"
  station-ink: "oklch(0.2 0.018 262)"
  platform-grey: "oklch(0.925 0.006 240)"
  timetable-grey: "oklch(0.46 0.02 255)"
  hover-wash: "oklch(0.925 0.018 250)"
  hairline: "oklch(0.87 0.008 245)"
  field-edge: "oklch(0.8 0.012 250)"
  railway-blue: "oklch(0.38 0.13 262)"
  enamel-white: "oklch(0.985 0.004 240)"
  focus-blue: "oklch(0.5 0.15 260)"
  enamel-rail: "oklch(0.31 0.115 263)"
  enamel-rail-lit: "oklch(0.38 0.12 263)"
  rail-ink: "oklch(0.96 0.012 250)"
  signal-yellow: "oklch(0.86 0.17 89)"
  signal-yellow-pressed: "oklch(0.83 0.17 86)"
  signal-ink: "oklch(0.19 0.02 262)"
  gain: "oklch(0.5 0.13 152)"
  gain-soft: "oklch(0.94 0.04 152)"
  loss: "oklch(0.54 0.2 27)"
  loss-soft: "oklch(0.95 0.03 25)"
  destructive: "oklch(0.55 0.2 27)"
  warn: "oklch(0.56 0.13 65)"
  warn-soft: "oklch(0.95 0.05 85)"
  info: "oklch(0.45 0.13 258)"
  info-soft: "oklch(0.94 0.025 255)"
  board: "oklch(0.2 0.006 262)"
  flap-leaf: "oklch(0.255 0.006 262)"
  flap-ink: "oklch(0.96 0.012 95)"
  flap-dim: "oklch(0.72 0.012 95)"
  flap-yellow: "oklch(0.87 0.17 89)"
  flap-gain: "oklch(0.8 0.15 150)"
  flap-loss: "oklch(0.72 0.18 28)"
  night-concourse-floor: "oklch(0.165 0.012 262)"
  night-enamel-panel: "oklch(0.2 0.014 262)"
  night-station-ink: "oklch(0.94 0.008 250)"
  night-railway-blue: "oklch(0.78 0.1 255)"
  night-enamel-rail: "oklch(0.21 0.07 263)"
  night-gain: "oklch(0.77 0.15 152)"
  night-loss: "oklch(0.72 0.18 27)"
  night-board: "oklch(0.12 0.006 262)"
  night-flap-leaf: "oklch(0.175 0.007 262)"
typography:
  headline:
    fontFamily: "Barlow Semi Condensed, Barlow, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Barlow Semi Condensed, Barlow, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.25
  board-title:
    fontFamily: "Barlow Semi Condensed, Barlow, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "0.1em"
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "\"kern\", \"liga\""
  body-dense:
    fontFamily: "Barlow, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "\"tnum\", \"lnum\""
  label:
    fontFamily: "Barlow Semi Condensed, Barlow, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.07em"
  board-label:
    fontFamily: "Barlow Semi Condensed, Barlow, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    letterSpacing: "0.12em"
  flap:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"tnum\", \"lnum\""
  flap-total:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"tnum\", \"lnum\""
rounded:
  hinge: "2px"
  sm: "0.15rem"
  md: "0.225rem"
  lg: "0.3rem"
  full: "9999px"
spacing:
  gutter: "16px"
  gutter-wide: "32px"
  board-inset: "20px"
  section: "32px"
  row: "10px"
components:
  button-primary:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.signal-ink}"
    typography: "{typography.body-dense}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.signal-yellow-pressed}"
  button-secondary:
    backgroundColor: "{colors.enamel-rail}"
    textColor: "{colors.rail-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.enamel-rail-lit}"
  button-outline:
    backgroundColor: "{colors.enamel-panel}"
    textColor: "{colors.station-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-outline-hover:
    backgroundColor: "{colors.hover-wash}"
  button-destructive:
    textColor: "{colors.loss}"
    rounded: "{rounded.md}"
  button-destructive-hover:
    backgroundColor: "{colors.loss-soft}"
  input:
    backgroundColor: "{colors.enamel-panel}"
    textColor: "{colors.station-ink}"
    typography: "{typography.body-dense}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
    height: "32px"
  badge:
    backgroundColor: "{colors.enamel-rail}"
    textColor: "{colors.rail-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "20px"
  tab-active:
    backgroundColor: "{colors.enamel-rail}"
    textColor: "{colors.rail-ink}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.enamel-panel}"
    textColor: "{colors.station-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  board:
    backgroundColor: "{colors.board}"
    textColor: "{colors.flap-ink}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  flap-cell:
    backgroundColor: "{colors.flap-leaf}"
    textColor: "{colors.flap-ink}"
    typography: "{typography.flap}"
    rounded: "{rounded.hinge}"
  flap-status-due:
    backgroundColor: "{colors.flap-yellow}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.hinge}"
  flap-status-late:
    backgroundColor: "{colors.flap-loss}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.hinge}"
  nav-item:
    textColor: "{colors.rail-ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  nav-item-active:
    backgroundColor: "{colors.enamel-rail-lit}"
    textColor: "{colors.enamel-white}"
  pictogram:
    backgroundColor: "{colors.enamel-rail}"
    textColor: "{colors.rail-ink}"
    rounded: "{rounded.md}"
    size: "36px"
---

# Design System: Strike Zone

## Overview

**Creative North Star: "The Departure Hall"**

Every option has a scheduled departure, and Strike Zone is the station board that runs the book on time. The system is a railway concourse in daylight: a pale, cool enamel floor, a railway-blue wayfinding rail down the left edge, blue enamel pictogram signs, and one dark split-flap board that announces what departs next. Numbers are the interface. They sit on hinge-lined flap leaves on the board and in tabular, right-aligned columns everywhere else, so gains, losses, and time-to-expiry read in one look during a live session.

Density is operational, not editorial: 13–14px working text, 32px controls, tight table rows, and a board that runs full width at the top of the dashboard. Hierarchy comes from the station's own devices (the board against the pale floor, blue enamel for where you are, yellow for what you do), not from tinted KPI cards or decorative chrome. The system rejects the KPI-card trading dashboard: there is no grid of stat tiles; totals post as one line on the board.

The hall has a night mode that dims the concourse around the board. The board keeps its role as the darkest object in the room, and the blue and semantic tones lift in lightness to stay legible on the dark floor.

**Key Characteristics:**
- Pale cool-grey concourse, one dark split-flap board, blue enamel for wayfinding.
- Signal yellow is the single action color; it never decorates.
- Barlow in three widths: regular for reading, semi-condensed for signage and headings, condensed for flap cells.
- Money carries cents, numerals are tabular, and gain/loss colors are never ambiguous.
- Timetable vocabulary: Departures, Scheduled, ahead of / behind timetable, the year as a route.
- Motion is mechanical and brief: a flap riffle on changed values, 100–200ms state transitions elsewhere.

## Colors

A cool, low-chroma concourse palette (hue ~240–262) carrying three committed voices: railway blue for place, signal yellow for action, and a paired gain-green / loss-red for money. All tokens are authored in OKLCH in `src/app/globals.css`; that is the canonical source.

### Primary
- **Railway Blue** (`railway-blue`): links, focus rings, the progress fill on the month timetable and the year route line, "today" on the P&L calendar, the "Now" tag on the monthly breakdown, and the equity line (chart-1). It is the color of "you are here" and "this is where the book is".
- **Enamel Rail** (`enamel-rail`) and **Lit Rail** (`enamel-rail-lit`): the deep blue enamel of the sidebar, the page pictogram square, the secondary button, the default badge, and the active tab. Lit Rail marks the active nav destination and hover on rail surfaces.

### Secondary
- **Signal Yellow** (`signal-yellow`, pressed `signal-yellow-pressed`, ink `signal-ink`): the primary button only (Add Trade, Save, Close, Roll), plus text selection. On the rail it is the focus ring (`sidebar-ring`), because blue focus would vanish on blue enamel.

### Tertiary (money and state)
- **Gain** / **Gain Soft** and **Loss** / **Loss Soft**: every signed amount, the P&L calendar tints (mixed 5–18% into the panel by magnitude), punctuality ("ahead of" in gain, "behind" in loss), and destructive confirm actions. **Destructive** is the same red family, used for form validation.
- **Warn** / **Info** (with soft fills): import and account status chips only.

### Neutral
- **Concourse Floor** (`concourse-floor`): the page background.
- **Enamel Panel** (`enamel-panel`): cards, table surfaces, inputs, popovers, dialogs.
- **Station Ink** (`station-ink`): body text and headings.
- **Timetable Grey** (`timetable-grey`): meta text, table heads, captions, axis ticks.
- **Platform Grey** (`platform-grey`): table head bands (at 60%), empty calendar cells, track of progress bars.
- **Hover Wash** (`hover-wash`): hover and open state for outline/ghost buttons and menu items.
- **Hairline** (`hairline`) and **Field Edge** (`field-edge`): dividers and card rings; input strokes.

### The Board Palette
- **Board** (`board`) and **Flap Leaf** (`flap-leaf`): the departures board and its cells.
- **Flap Ink** (`flap-ink`), **Flap Dim** (`flap-dim`): warm off-white posted values and secondary board text/labels.
- **Flap Yellow**, **Flap Gain**, **Flap Loss**: lifted tones for ink on the dark board: next departure ticker, open risk, due DTE, pre/after-hours session; gains and losses; late/expired status leaves.

### Named Rules
**The One Signal Rule.** Signal yellow fills action buttons and nothing else in daylight. Yellow appears elsewhere only as flap-yellow ink or a status leaf on the dark board.

**The Wayfinding Rule.** Railway blue carries place: links, selection, the active destination, today, and "now". It never labels a gain or a loss.

**The Money Pair Rule.** Signed amounts use gain and loss tokens (flap-gain / flap-loss on the board). Zero reads in the dim or muted tone, never green.

## Typography

**Display Font:** Barlow Semi Condensed (with Barlow, sans-serif), loaded as `--font-heading`
**Body Font:** Barlow (with sans-serif), loaded as `--font-sans`
**Label/Mono Font:** Barlow Condensed, loaded as `--font-flap` / `--font-mono`, for flap cells

**Character:** One grotesque family in three widths, the way transit signage runs a single typeface at different condensations. The semi-condensed cut is the sign; the regular cut is the notice you read; the condensed cut fits on a flap leaf.

### Hierarchy
- **Headline** (600, 1.625rem / 26px, line-height 1, -0.01em): the page title in the platform header, one per page.
- **Title** (600, 17px, 1.25): section headings inside a page ("Equity 2026", "Sep timetable", "2026 route", "September 2026 realised P&L").
- **Board Title** (600, 15px, uppercase, 0.1em, flap-yellow): the board's own name sign ("Departures"). Only on the board.
- **Body** (400, 14px): base text. Working surfaces (tables, tabs, cards, dialogs, controls) run at **Body Dense** (13px) with tabular lining numerals.
- **Label** (600, 11px, uppercase, 0.07em, timetable-grey): table column heads and figure captions (`sign-caps`, `.data-table thead th`).
- **Board Label** (600, 10px, uppercase, 0.12em, flap-dim): column heads and total captions on the board.
- **Flap** (Barlow Condensed 600, uppercase, tabular): 14px in rows, 19px for board totals (15px on phones), 30px for the login station name.

### Named Rules
**The Tabular Rule.** Tables, inputs, and any element marked `data-num` set `tabular-nums lining-nums`. Numeric columns are right-aligned.

**The Signage Caps Rule.** Uppercase tracked caps are for column heads, figure captions, and the board, where a real sign would use them. Section headings are sentence case at 17px semibold, with no eyebrow or kicker line above them.

## Layout

The shell is a fixed-height two-column frame: a blue enamel rail (56px icon-only below `md`, 240px with labels from `md`) and a scrolling main column capped at `max-w-screen-2xl` and centered. Pages pad 16px × 20px on phones and 32px × 28px from `md`, with 32px between top-level blocks (28px on the monthly page).

Every page opens with the **platform header**: pictogram square, page title, a meta line, then the session sign and the page actions pushed right (the sign hides below `sm`). The dashboard follows with the departures board at full width, then a `1.7fr : 1fr` split (from `xl`) of equity chart and goal timetable separated by a hairline, then the P&L calendar.

Tables collapse by hiding columns at breakpoints (`sm`, `md`, `lg`) rather than reflowing into cards, and scroll horizontally inside their container when they still overflow. Board totals run 2 → 3 → 5 columns across `sm` and `xl`.

## Elevation & Depth

The hall is mostly flat and tonal: panels separate from the floor by a hairline ring and a near-invisible 1–2px shadow, not by lift. Two objects carry real depth. The board sits on the floor with an inset top highlight and a soft blue-tinted drop, reading as a mounted enamel-and-metal box. Dialogs float with one deep, blue-tinted shadow. Primary buttons carry a pressed-enamel inset at the bottom edge.

### Shadow Vocabulary
- **Panel rest** (`box-shadow: 0 1px 2px oklch(0.2 0.02 262 / 0.06)` plus a 1px `hairline` ring): cards.
- **Board mount** (`inset 0 1px 0 oklch(1 0 0 / 6%), 0 1px 2px oklch(0 0 0 / 18%), 0 8px 24px -12px oklch(0.2 0.05 262 / 45%)`): the board in day mode; at night the drop darkens and a 1px white/9% ring outlines it.
- **Dialog float** (`0 24px 48px -16px oklch(0.2 0.06 262 / 0.45)`): dialogs and alert dialogs.
- **Signal press** (`inset 0 -1px 0 oklch(0 0 0 / 0.18), 0 1px 1px oklch(0.2 0.05 90 / 0.2)`): the primary button.
- **Field inset** (`inset 0 1px 1px oklch(0.2 0.02 262 / 0.05)`): inputs.

### Named Rules
**The One Dark Object Rule.** In day mode the board (and the flap cells on it) is the only near-black surface. Blue enamel is the only other deep fill, and it belongs to wayfinding. Nothing else goes dark to get attention.

## Shapes

Corners are small and engineered. The base radius is 0.3rem (about 5px): cards, the board, dialogs, and table containers use it; buttons, inputs, nav items, and the pictogram square step down to 0.225rem; badges, tabs, and tags to 0.15rem. Flap cells use a 2px corner and a 1px hinge line across their middle: every flap is two leaves, the top leaf a shade lighter than the bottom. Round shapes appear only where the world has them: the station clock face, the route line's stops and train marker, and progress tracks.

## Components

### Buttons
Pressed enamel: compact, solid, and quiet except for the one yellow action.
- **Shape:** gently squared (0.225rem), 32px tall, 13px semibold; sizes xs 24 / sm 28 / lg 40.
- **Primary:** signal yellow with signal ink and the signal-press shadow. Reserved for the page's action (Add Trade, Save, Close, Roll).
- **Hover / Focus:** hover deepens to `signal-yellow-pressed`; focus is a 2px ring in focus-blue offset 1px from the floor; press nudges down 1px. Transitions run 150ms on color and shadow only.
- **Secondary:** blue enamel with rail ink, lighting to Lit Rail on hover.
- **Outline / Ghost:** enamel panel with a field-edge stroke, or bare ink; both take hover-wash on hover.
- **Destructive:** loss-red text that fills with loss-soft on hover. Confirm dialogs fill the action in loss.

### Chips (Badges and Tags)
- **Style:** 20px tall, 0.15rem corners, Barlow Semi Condensed 11px uppercase at 0.05em. Default is blue enamel; destructive is loss on loss-soft; outline is a hairline on a faint field tint.
- **State:** the "Now" tag on the current month uses railway blue with white ink.

### Cards / Containers
- **Corner Style:** 0.3rem.
- **Background:** enamel panel on the concourse floor.
- **Shadow Strategy:** Panel rest (see Elevation).
- **Border:** a 1px hairline ring, not a border.
- **Internal Padding:** 16px (12px for the small size). Card titles are 15px semibold semi-condensed. Cards frame tables and forms; they are never used as KPI tiles.

### Inputs / Fields
- **Style:** 32px tall, field-edge stroke, enamel panel fill, field-inset shadow, 13px text with tabular numerals, 0.225rem corners.
- **Focus:** stroke shifts to focus-blue with a 2px focus-blue ring at 25%.
- **Error / Disabled:** `aria-invalid` turns the stroke destructive with a 20% destructive ring; disabled drops to 50% opacity.

### Navigation
- **Rail:** full-height blue enamel column with a 76px station-name block ("SZ" plate plus "Strike Zone" in 19px semibold semi-condensed). Items are 40px tall, 14px medium, with a 19px HugeIcons pictogram.
- **States:** rest at 75% rail ink; hover to full ink over Lit Rail at 60%; active fills Lit Rail with a heavier icon stroke and `aria-current="page"`. Focus on the rail is a 2px signal-yellow outline.
- **Mobile:** below `md` the rail collapses to a 56px icon column with titles on hover.

### Tabs
- **Style:** a hairline-ringed enamel strip, 36px tall; triggers 13px semibold at 65% ink.
- **Active:** blue enamel fill with rail ink. Counts sit in small 11px tabular pills.

### Data Tables
- **Head:** a platform-grey band (60%) with label-style signage caps in timetable grey (`.data-table`).
- **Rows:** 13px, hairline dividers, 10px vertical padding, numeric columns right-aligned and tabular, signed money in gain/loss.

### The Departures Board (signature)
The only dark object in the hall. A board title ("Departures") and count sit at the top; a totals line posts month P&L, YTD return, win rate, open risk, and projected premium as 19px flaps with board-label captions; then open positions run in timetable order, soonest expiration first, stock last. Each row is a line of flap cells (ticker, type, strike, expiry, DTE, quantity, entry, projected) with a status leaf: **On time** and **Holding** in flap ink, **Due** (≤7 days) as a yellow leaf, **Today** / **Expired** as a loss-red leaf. The next departure's ticker posts in flap yellow over a faint white row wash. Fields that do not apply post a single dim dash.

### Flap Cells (signature)
Barlow Condensed caps on a two-leaf cell with a hinge line. When a value changes, its leaves riffle through glyphs at 55ms per tick, three to five ticks per cell, landing within about 300ms, with rows staggered 20ms and totals 40ms. A flap with an id riffles once per browser session on first posting and stays still afterward while unchanged. `prefers-reduced-motion` renders the settled value with no riffle. Flaps expose their value through `role="img"` and `aria-label`.

### Session Sign (signature)
A small board in the platform header: a Swiss railway clock face (bar indices, black hands, red disc second hand) beside a phase flap (Open in flap-gain, Pre-mkt / After hrs in flap-yellow, Closed in flap-ink) and a board-label line with New York time and the countdown to the bell.

### Goal Timetable and Route Line (signature)
The goal is a timetable, not a gauge. The month reads Actual / Scheduled / Gap with a punctuality line ("$1,204.00 ahead of timetable" in gain, "behind" in loss) and a railway-blue progress track. The year is a route line: twelve month stops placed where the goal curve says each month ends, a railway-blue fill to the train marker (a ringed dot where the book is), and an ink tick labeled "Sched." where the timetable says it should be today.

### P&L Calendar
A hairline-ringed grid with an ISO week column. Day cells tint toward gain or loss by magnitude (5–18%), and the amount grows from 12px to 18px and 500 to 700 weight with size. Today's date is a railway-blue square. The month total posts as a flap on a small board beside the heading.

## Do's and Don'ts

### Do:
- **Do** put the page's one action in the signal-yellow primary button, top right of the platform header.
- **Do** open every page with the platform header: pictogram square, 26px title, meta, session sign, actions.
- **Do** post live, glanceable numbers on the board as flap cells, and everything else in tabular, right-aligned columns.
- **Do** carry cents on money everywhere (`formatCurrency` defaults to two decimals) and sign amounts with gain/loss tokens.
- **Do** use railway blue for links, selection, today, and "now", and blue enamel for place-marking fills.
- **Do** speak the timetable: Departures, Scheduled, ahead of / behind timetable, route.
- **Do** keep motion state-only: flap riffles on changed values within ~300ms, overlays in 100ms, control state changes in 150–200ms, and honor reduced motion.

### Don't:
- **Don't** build KPI stat-card grids; totals post as one line on the board.
- **Don't** use signal yellow for decoration, chart marks, highlights, or status off the board.
- **Don't** introduce a second dark surface in day mode; if something needs weight, it belongs on the board or in blue enamel.
- **Don't** put eyebrow or kicker labels above section headings.
- **Don't** round money to whole dollars or color zero as a gain.
- **Don't** animate on load for its own sake; a flap that has already posted this session stays still.
