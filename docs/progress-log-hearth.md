# Hearth redesign: progress log

Branch `hearth-redesign`, made from `payments-ledger-app`. Not merged. This is a visual pass only: no routes, params, titles, data, API calls, or business logic change.

## Phase 1: tokens, fonts, shared components (done)

- **New packages** (named in the brief): `@expo-google-fonts/fraunces` and `@expo-google-fonts/dm-sans` through `npx expo install`. `expo-font` and `expo-splash-screen` were already there.
- **`App.js`:**
  - Loads Fraunces 400 and 500 and DM Sans 400, 500, and 600.
  - Holds the splash with `SplashScreen.preventAutoHideAsync()` and hides it once the fonts load or fail.
  - If loading fails, it logs, and the app opens anyway with the system font filling in.
  - Inter isn't loaded anymore.
- **`theme.js`:**
  - Every color token was remapped to Hearth with the same names: paper `#F7F3EC`, ink `#2A2520`, muted `#6B6259`, hairline `#E4DCCF`, strong border `#CFC4B2`, forest green `#2F5D4A`, terracotta `#A8442A`, and amber `#83560F`.
  - The tints are quiet warm versions, and the backdrop is warm.
  - New tokens:
    - `COLORS.hairline`
    - `FONTS.medium`, `serif`, and `serif_medium`
    - `TYPE.hero` (58), `number` (30), `name`, `empty_title`, and `wordmark`
    - `SPACING.xxxl` (64)
    - `RADIUS.button` (26)
    - `SIZES.screen_padding` (24), `row_min_height` (64), `row_icon`, `chevron`, `progress`, and `header_avatar`
  - The TYPE keys stayed, now in DM Sans and Fraunces.
  - Buttons are 52 tall.
  - `SHADOWS.low` and `medium` are flat now, and only `high` (sheets) has a shadow.
  - All the old comments are kept.
- **Contrast:** every pair is AA. The lowest are `danger_text` on `danger_tint` at 4.91 and `text_muted` on `neutral_tint` at 4.95.
- **Components:**
  - New: `StatusLabel` (an icon and colored words), `ProgressLine`, and `lineIcon` (filled to outline Ionicons, checked against the glyph map).
  - `StatusPill` now renders a StatusLabel, so every caller keeps working.
  - Changed:
    - `Button`: pills, a see-through secondary, and an outlined terracotta destructive.
    - `ListRow`: hairline rows, 64 tall, a 24 line icon, a 17 medium title, `subtitle_tone`, and an 18 chevron.
    - `IconCircle`: the line icon only, with no circle.
    - `Avatar`: a hairline ring.
    - `KpiTile`: no tile. Label, then a Fraunces figure, then the caption.
    - `SummaryBlock`: no card, a Fraunces hero, and `size="small"`.
    - `Card`: flat and interactive are no longer boxes. Raised is a white box with a hairline edge.
    - `Chip`: see-through, and picked chips have a green edge.
    - `SegmentedControl` and the `listStyles` segment: tabs on a hairline with a green underline.
    - Inputs (`TextField`, `DateField`, `listStyles`, `sheet.input`): white, a hairline edge, 8 corners, 52 tall. TextField errors get an alert icon.
    - `sheet.js`: 12 corners.
    - `Toast`: an ink pill with no shadow.
    - `EmptyState`: a muted line icon, a Fraunces title, and a primary pill.
    - `Skeleton`: hairline rows.
    - `Wordmark`: Fraunces 500 next to a green line house. No pixels, and there's an `align` prop.
    - `DemoBanner`: a thin green strip with Switch view and an underlined Exit Demo Mode as text buttons.
    - `navigation/screenOptions.js`: a paper header with no line or shadow. Only the look changed.
- **Dropped comments** (their code was removed):
  - Wordmark: "the logomark sits in a soft indigo tile, like an app icon".
  - SummaryBlock: "the one floating card on a home screen, so it gets the soft shadow".
  - DemoBanner's `PrimaryButton` and `StatusPill` imports had no comments.
- **Tests:** `components/ui/hearth.test.js` covers the Button variants, the Row, StatusLabel, the hero amount block with the ProgressLine, `lineIcon`, and every new text and background pair (23 tests).
- **`docs/DESIGN.md`** is rewritten for Hearth.
- **Checks:**
  - Lint: the 13 known problems.
  - Tests: 360 passed in 31 suites.
  - Format: clean.
  - iOS export with `--clear`: OK.

## Phase 2: Welcome, Login, both Dashboards (done)

- **New pieces** in `features/home/components/`:
  - `HomeTopBar`: the wordmark on the left and a 44pt outlined initials circle on the right, which opens Settings, the same place the gear already goes.
  - `HeroNote`: the one colored line under a hero, made of a line icon, words, and a chevron.
- **Landlord Dashboard:**
  - Top to bottom: the top bar, "Collected in October", the Fraunces hero amount, "of $X expected", the green progress line, then one line that opens Payments. The line reads "1 tenant is behind, $2,000.00 in total" in terracotta with a clock, or claims to review in amber, or "Everyone is paid up" in green.
  - Then plain rows with live subtitles: Payments, Work orders, Messages, Tenants, Expenses, Documents, Checklist.
  - The temporary demo New Work Order button is now a secondary pill. Log Out stays.
  - Removed: the spending card and its Sparkline, the KPI tiles, the quick actions, and the feature tiles.
  - New helper `behindSummary` (tested).
- **Decision:** there are no Properties or Mileage rows on the Dashboard. The brief lists them, but they'd add new navigation edges, and the map, its tests, and the diagram must stay the same. Properties is one tap away under Tenants, and Mileage under Expenses or Settings.
- **My Home (tenant):**
  - The top bar, the address, "Due now" as the hero, "Next rent $1,450.00 on Nov 1", and one line: "$2,000.00 is overdue" (terracotta), "Due now" (amber), or "You're all paid up" (green).
  - Then rows: Payments, My Requests, Report an Issue, Message Landlord.
  - The read-only home uses a Fraunces "No Active Rental" in place of the shimmer ScreenTitle, and its three cards are now rows.
- **Welcome:** pill buttons, the three trust icons all in green line icons, and 24 side padding.
- **Login and sign up** (`AuthLayout`): the medium wordmark, 24 side padding, and a quiet error note with a line icon. `SubmitButton` is the 52 pill.
- **Demo chooser:** the two choices are ruled rows with green line icons.
- **Dropped comments** (their code was removed):
  - Dashboard: "the badge sits on the corner of the button and hides itself at zero", "an empty half next to the odd third tile, so it stays the same size instead of stretching", "capped so the tiles don't stretch across a whole iPad", and "two tiles to a row, they grow taller instead of squishing when the text is big".
  - Tenant home: "two tiles to a row, they grow taller instead of squishing when the text is big" and "the read-only home still uses the full-width cards".
- **Visual QA** (web render at 390, 360 by 640, and 820 by 1180): Welcome, Login, the chooser, and both homes. There were no page errors, and nothing was clipped or cramped. At 360 the hero note wraps to two lines, which reads fine.
