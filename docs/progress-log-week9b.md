# Progress log: week 9b (shared state, search, calendar, biometric unlock)

Branch `week9-shared-state`, off `master` at `e49825f`.

Baseline before any change: lint 13 known problems (8 errors, 5 warnings), 539 tests in 47 suites passing, Prettier clean.

## Phase 1: shared state (work orders)

- Audited every work order reader. Every screen already read `useWorkOrders()` except two copies:
  - Past Requests fetched its own list with `getAllWorkOrders()` in real mode. It reads the shared store now (the real-mode store already loads a former tenant's requests), with the same skeleton, error, and pull to refresh.
  - Tenant Profile kept its recent orders from its own `fetchTenantDetail` call, so a status change didn't show there until the next load. The count and rows come from the shared orders now (by account id, else by name), and only fall back to the server's detail copy while the real-mode list is still loading.
- `WorkOrdersContext.js`: "step 1" to "step 4" comments in the lecture style, and `useWorkOrders()` throws a clear error outside the provider (the default is `null`, so it used to crash on a destructure).
- `App.js`: one comment where the provider wraps the navigator.
- Comments dropped with removed code (Past Requests' own fetch state): "loading, ready, or error" and "goes up on Try Again or a pull down so the load runs again".
- Tests: `navigation/sharedState.test.js` (5, real navigators), `features/workOrders/context/remoteWorkOrders.test.js` (3, real mode optimistic, rollback, socket), 2 helper tests.
- Docs: `ASSIGNMENT_STATE.md`, `docs/shared-state.md`, README section.
- Checks: lint 13 (the known ones), 549 tests in 49 suites, Prettier clean, iOS bundle with `--clear` (1876 modules).

## Phase 2: Search

- New drill screen `Search` (title "Search", no params, role shared) in the root stack, opened by a magnifying glass on both homes (`HomeHeaderButtons` in `navigation/headerButtons.js`: Search, then the Settings gear).
- `features/search/`: `utils/searchIndex.js` (pure: builds rows from the loaded lists, every word has to match, title matches first, grouped in a fixed section order, highlight parts, recent list), `hooks/useDebouncedValue.js` (250 ms), `hooks/useRecentSearches.js` (per account under `rent_well_recent_searches_<user id>`, memory only in the demo), `screens/SearchScreen.js`.
- What a landlord searches: tenants, properties, work orders, payments, charges, expenses. A tenant: their own requests, payments, and charges (the demo tenant's orders come out of the shared list by name, like My Requests).
- Taps go by id only, one inline navigate per route: Tenant Profile (`tenantId`), Property Overview (`propertyId`), Work Order (`workOrderId`), Request (`workOrderId`), Payment Record (`paymentId`), Rent Ledger (`tenancyId`, for a landlord's charge), Payments (a tenant's charge), Expenses (`expenseId`, new optional param that opens that expense's form once and then clears itself).
- Decision: the matching letters are DM Sans 600 in the action green, so a match is shown by weight as well as color.
- Map: Search with its edges, header edges from both homes, `expenseId` on Expenses. Search and Calendar join the one-word title exceptions in the map test.
- Tests: `features/search/utils/searchIndex.test.js` (11), `features/search/hooks/useRecentSearches.test.js` (3), `navigation/searchFlow.test.js` (4, real navigators, both demo sides).
- Checks: lint 13 (known), 567 tests in 52 suites, Prettier clean, iOS bundle with `--clear` (1880 modules). Diagram regenerated.

## Phase 3: Calendar

- New drawer screen `Calendar` (title "Calendar", no params, role shared) in a new "Schedule" section for both roles (landlord: Rentals, Money, Records, Schedule, Account; tenant: Repairs, Schedule, Account). No new tab. Both homes got a "Calendar" row too, like every other drawer place.
- Decision: no calendar library. The month grid is 7 columns of Pressables with the same tokens and line icons as the rest of the app, so it works in light and dark with nothing to install. Dots are one per tone (past due, due, paid or done, other), at most three, with a legend under the grid so color is never the only signal. Each day cell says its full date, today, the event count, and how many are past due.
- Events (`features/calendar/utils/calendarEvents.js`, pure): rent and other charge due dates with their status, confirmed payments on the day paid, lease ends, and work order reported, started, and resolved dates. A landlord sees all of them, a tenant only their own ledger, lease, and requests. Past due rows are terracotta with the alert icon and the word "Overdue" (or "Expired").
- Taps by id: Rent Ledger (`tenancyId`, a landlord's charge), Payment Record (`paymentId`), Lease and Documents (`tenancyId`), Work Order (`workOrderId`), Request (`workOrderId`), Payments (a tenant's charge), My Home (a tenant's lease end).
- "Add to my calendar" (`expo-calendar`, installed with `npx expo install`, `~57.0.6`): a plus on each row from today on, and "Add upcoming rent due dates and lease ends" (the next 90 days, unpaid only). A sheet explains first (and in the demo says these are sample events going into the real calendar). Then the system prompt if needed, then a "Rent Well" calendar (made once, the default calendar if the phone won't allow it). Event ids are saved per account under `rent_well_calendar_events_<user id>`, and an event deleted in the Calendar app is added again next time. A denied permission gets a plain alert with Open Settings.
- Decision: the legacy functions (`expo-calendar/legacy`). The SDK 57 object API throws in Expo Go, the legacy one works in Expo Go and in a build.
- Decision: the demo's added events are remembered in memory until the app closes, not cleared on Exit Demo, so running the demo twice doesn't put the same [Demo] events on the phone twice. Nothing is saved to storage in the demo.
- `services/appLock.js`: `whileSystemDialog` wraps the calendar prompt so the Phase 4 lock never fires coming back from it.
- `app.json`: the `expo-calendar` and `expo-local-authentication` plugins with the calendar and Face ID strings (the unused reminders string is turned off), and the same strings in `ios.infoPlist`.
- Tests: `calendarEvents.test.js` (11), `deviceCalendar.test.js` (6), `navigation/calendarFlow.test.js` (4).
- Checks: lint 13 (known), 588 tests in 55 suites, Prettier clean, iOS bundle with `--clear` (1890 modules).

## Phase 4: Biometric unlock

- `expo-local-authentication` (`~57.0.3`, installed with `npx expo install` in Phase 3 along with `expo-calendar`), with the Face ID string through its plugin and `ios.infoPlist` in `app.json`.
- Settings, Security (`features/security/components/SecurityCard.js`): a switch worded for the phone ("Unlock with Face ID", "Touch ID", "fingerprint", or "face unlock"). Turning it on checks with the phone first. Saved per device under `rent_well_biometric_unlock`. Shown only for a signed-in account (never in the demo or signed out). A phone with nothing set up gets a short explanation instead of the switch.
- `AppLockProvider` (`features/security/context/AppLockContext.js`) wraps `AppNavigator` in `App.js`. It locks on a launch that restores a saved session (a fresh login with a password doesn't) and after more than 60 seconds in the background. The lock screen covers the app instead of replacing it, so nothing underneath loses its place, and the app under it is hidden from screen readers.
- Lock screen (`features/security/components/LockScreen.js`): the wordmark on paper, one line, the green Unlock pill (asks once by itself), Use Passcode, and Log Out as text. After three failed tries a terracotta line offers Log Out and the button becomes outlined.
- Fail safe: the passcode fallback is never turned off. If the phone can't check anyone (no passcode, nothing enrolled, no hardware), the lock steps aside instead of trapping the person.
- System dialogs: `services/appLock.js` `whileSystemDialog` pauses the lock. The photo picker, camera, file picker, and share sheet go through `services/systemPickers.js` (same names and calls as the expo modules, so each of the 13 files only changed its import line), and the push and calendar permission prompts are wrapped where they're asked.
- Push taps: `navigateWhenReady` holds the target while the cover is up (and while a cold start is still deciding), and `openHeldNavigation` opens it after unlock.
- Note: Face ID needs a development build. Expo Go has no Face ID entitlement for the app, so the prompt falls back to the passcode there.
- Note: `npx expo-doctor` flags four patch updates (expo, expo-notifications, expo-sharing, jest-expo) that were already behind before this branch. Left alone.
- Tests: `features/security/appLock.test.js` (17). The existing Settings test got a mock for the lock context.
- Checks: lint 13 (known), 605 tests in 56 suites, Prettier clean, iOS bundle with `--clear` (1899 modules).

## Phase 5: navigation, diagram, docs

- Map: 35 screens. Search (drill, shared) and Calendar (drawer, shared, Schedule section for both roles) with their edges, Search header edges and Calendar rows from both homes, `expenseId` on Expenses.
- Tests: hubRouter covers the new names (Calendar opens inside Main, Expenses keeps `expenseId`, Search stays on the stack). `appNavigation.test.js` checks Search has one header and Back returns to each home, and its existing drawer walk now opens Calendar in both demo sides with one header. The map tests (registered once, reachable from all five starting points, a way back, id-only params, no inline object params) all pass with the new screens.
- Diagram regenerated (`npm run diagram`): one page, swimlanes, 35 screens. Looked at the PNG: everything is readable. The landlord lane is the busiest, with Search's edges added, but no labels overlap.
- Docs: `ASSIGNMENT_NAV.md` (the screen table regenerated from the map, structure, counts, header buttons, tabs and drawer, the `expenseId` param), `ASSIGNMENT_STRUCTURE.md` (the drawer lists only), README (new feature section, screen table, drawer table), `docs/DESIGN.md` (Search, Calendar, the add sheet, the lock screen, Security), `CLAUDE.md`.
- Sweep for draft, rewrite, own words, his own, for Christian, TODO, FIXME, placeholder, coming soon: nothing unfinished in any text. Reported only, not edited (code comments): `navigation/navigationMap.js` line 27 says stub means "placeholder for the assignment, real version coming later".
- Checks: lint 13 (known), 608 tests in 56 suites, Prettier clean, iOS bundle with `--clear` (1899 modules).
