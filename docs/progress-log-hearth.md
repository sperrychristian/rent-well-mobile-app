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
