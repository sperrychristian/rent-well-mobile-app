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
