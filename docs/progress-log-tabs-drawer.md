# Progress log: tabs and drawer (branch `tabs-drawer`)

Branch made from `master` after `git pull origin master` (already up to date). `git branch --no-merged master` lists `leases-expenses-onboarding`, which I left alone. The one uncommitted change on master (a deleted comment line in `screens/index.js`) came along in the working tree and is not part of any commit on this branch.

## Phase 1: navigators

- Installed with `npx expo install`: `@react-navigation/bottom-tabs` 7.21.0, `@react-navigation/drawer` 7.14.4, `react-native-gesture-handler` ~2.32.0. `react-native-reanimated` 4.5.1 and `react-native-worklets` were already there.
- Setup: `App.js` wraps everything in `GestureHandlerRootView`. No babel config is needed: SDK 57's `babel-preset-expo` adds the worklets plugin for Reanimated 4 by itself.
- Nesting: the root native stack holds the signed-out screens, `Main` (the drawer), and every drill-down screen. The drawer's first screen is `Tabs` (the bottom tab navigator). Drill-downs push over the tabs and drawer.
- `navigation/hubRouter.js`: an `UNSTABLE_router` override on the root stack. A `navigate`, `push`, `replace` or `reset` to a tab or drawer screen name gets wrapped in its parents (`Main`, then `Tabs`), with `pop: true` so a detail screen comes off. That keeps every existing `navigate('Payments')`, push tap, and socket handler working with no screen changes.
- `navigationMap.js`: `future` is replaced by `place` (`auth`, `tab`, `drawer`, `drill`), plus `nav_label` and `nav_icon` on tabs and drawer items, and a `hubs` table (tab order and drawer sections per role). Reachability counts the tab bar and drawer as hubs.
- `navigation/screenOptions.js`: `shared_tab_options`, `shared_drawer_options`, `tabOptionsFor`, `drawerOptionsFor`, all from `theme.js`.
- `navigation/headerButtons.js`: `HeaderMenuButton` (opens the drawer, hidden at 768 and wider) and `DrawerHeaderLeft` (a back arrow when a section was opened by a link inside another section, the menu button otherwise).
- `navigation/DrawerContent.js`: wordmark, role label, a Main section with the tabs, then the sections as plain rows.
- `navigation/tabBadges.js`: unread count on Messages, terracotta dot on Payments (anything overdue) and Work Orders (owner, anything still Open).
- `theme.js`: new `SIZES` tokens `tab_icon`, `tab_dot`, `drawer_width`, `drawer_row`, `drawer_swipe_edge`, `wide_layout`.
- Tests changed because they asserted the old single stack: the registration regex (now Stack, Tab and Drawer screens), the role guard tests (now any `shows_owner`/`shows_tenant` block in all three navigators), the navigator key test (now includes the role), and the old `future` test (now the real tabs and drawer). New: navigator per place, tab order per role, drawer contents per role, initialRouteName on all three navigators, "can get back" from every reached screen, hubs one tap apart.
- Checks: lint 13 problems (the known 13), 396 tests passing, format clean, iOS bundle exported with `--clear`.

## Phase 2: tests

- `jest.setup.js`: test stand-ins for `react-native-worklets`, `react-native-reanimated` and `react-native-gesture-handler` (the drawer imports them).
- `navigation/hubRouter.test.js` (13 tests): the root stack router with the override, run on small states: navigate, push, replace and reset to a tab or drawer screen, plain stack actions untouched, the drawer's menu history trim, the back arrow rule, the role label, and the badge rules.
- `navigation/appNavigation.test.js` (11 tests): renders the real `App` signed out, taps Try the Demo and a side, then presses every tab, opens the drawer and presses every item, drills into a detail and goes back, follows a link between sections and uses the back arrow, navigates by name from a detail screen (what push taps do), switches the demo side both ways, and exits the demo. Every step checks that exactly one header is showing and that its title is the map's title. The badges are checked by their spoken labels.
- How "one header" is checked: the root stack's native bars that aren't hidden, plus the tab and drawer headers a screen reader can reach. A double header (the drawer's and the tab's, or the stack's over Main) would show up as two titles.
- Checks: lint 13 (known), 420 tests passing, format clean, iOS bundle exported with `--clear`. The only console output in the render tests is a deprecation warning from inside the drawer library (InteractionManager).

## Phase 3: visual QA, diagram, first draft marker

- The first run was cut off while `qa.mjs` (scratch copy only) was being changed to tap "Got It" on the demo intro sheet. On the reruns the sheet never showed, so the script finds nothing to dismiss and goes on, and the screenshots are clean.
- Web render (scratch copy outside the repo with react-native-web, headless Chrome over the DevTools protocol) at 390x844, 360x640 and 820x1180: landlord home, a tab switch, the drawer open, Expenses, the Mileage link with its back arrow, a work order drill-down and back, Switch view, tenant home, tenant tabs, tenant drawer, Settings. No page errors, no sideways scroll, and one header showing on every screen (hidden tab screens stay mounted, but nothing doubles on screen).
- Found and fixed: the tab labels were clipped at the bottom. The library's icon box is 28 tall inside a 49 bar, which leaves about 11 for the label. The bar is now `SIZES.tab_bar` (56) plus the bottom safe area inset (set in `MainTabs`), and the label line is 14. At the 1.3 font cap the label needs about 46 of the 46 there is, so it still fits.
- Tablet: the permanent drawer works at 820, the menu button hides, and the tabs stay at the bottom.
- Diagram: `scripts/buildNavigationDiagram.mjs` rewritten as swimlanes (signed out across the top, landlord and tenant side by side). Each lane is its own ELK layout with the TAB BAR and DRAWER (menu) as group boxes, arrows into detail screens labeled with their id param, header buttons in amber, and "opens ..." notes on detail screens for links that jump to a tab or drawer screen (so those don't need arrows across the lane). Hub boxes show "tab 3" or "drawer 2" because ELK orders boxes for the fewest crossings (forcing model order inside a group crashes ELK). Scale went from 0.555 on the first try to 0.758.
- The diagram test now checks the "#id" titles, the three lanes, and both groups per role. The mermaid copy groups screens into subgraphs per tab bar, drawer and detail.
- ASSIGNMENT_NOTES.md: the "(DRAFT, rewrite in your own words)" title is replaced.
- Checks: lint 13 (known), 421 tests passing, format clean, iOS bundle exported with `--clear`.

## Phase 4: docs, draft markers, final sweeps

- Draft marker search (case-insensitive: DRAFT, TODO, FIXME, "rewrite in your own words", "in his own words", "Draft for", "placeholder", "lorem", "Christian to rewrite") across the repo, leaving out node_modules, .git, dist, and package-lock.json:
  - Fixed: `ASSIGNMENT_NOTES.md` line 1 (title had "DRAFT, rewrite in your own words"), `ASSIGNMENT_NAV.md` line 1 ("(draft)") and line 3 ("Draft for Christian to rewrite in his own words"), and `CLAUDE.md` ("the write-up draft").
  - Left on purpose: every `placeholder=` and `placeholderTextColor` prop on text inputs, the chat composer's `draft` state in `MessageThreadScreen.js`, comments that say "placeholder rows" (skeleton loading) and "stub (placeholder for the assignment)" in the map, and the progress logs' and CLAUDE.md's mentions of the "draft API" (the ledger's history, not a draft label).
  - No TODO, FIXME, or lorem anywhere in the app code.
- New `ASSIGNMENT_STRUCTURE.md`. `ASSIGNMENT_NAV.md` rewritten as final: the navigator structure, the screen table regenerated from the map (with where each screen lives), the requirement checklist, header buttons (the menu button and the drawer back arrow added), and the tabs and drawer table. README's navigation section, `docs/DESIGN.md` (Tab bar and drawer), and `CLAUDE.md` updated.
- Sweeps: no hex values or bare numbers in the new chrome (all tokens), `navigation/chromeStyles.test.js` checks the tab bar and drawer color pairs for AA, the touch sizes, and the label fit at the 1.3 font cap. `git diff master` shows no screen file changed on this branch.
- Checks: lint 13 (known), 433 tests passing, format clean, iOS bundle exported with `--clear`.
