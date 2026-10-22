# Progress log: leases, profit, reminders, dark mode (branch `leases-profit-reminders-dark`)

## Phase 0: setup

- `git checkout master` and `git pull origin master` (already up to date). `git branch --no-merged master` listed `leases-expenses-onboarding` and `tabs-drawer`: neither was merged yet.
- The branch is made from `master`. The course structure (tabs and drawer) and the "previous merge" this work builds on only existed on those two branches, so I merged both into this branch first (`--no-ff`). Master itself isn't touched until the end.
  - Conflicts: `docs/DESIGN.md` (kept both sections), `ASSIGNMENT_NAV.md`, `README.md`, and the diagram files (took the tabs-drawer side, then regenerated the diagram from the merged map and added back the onboarding README section).
- `docs/API.md` had your uncommitted update with the new contract (leases, expenses, reports, reminders). It's committed first, since everything here follows it. It matches `../rent-well-api/API.md` exactly.
- The gated items from the last merge's report (`leases-expenses-onboarding`, `docs/progress-log-leases.md`): leases, expenses on the server, `POST /expenses/import`, and `GET /reports/profit` were waiting on the backend. All four are in `docs/API.md` now, so they're built in this branch.
- `screens/index.js` has your uncommitted one-line comment deletion. I keep it out of my commits: it's saved as a patch, my export lines are added to the committed version, and your change goes back on top after each commit.

## Phase 1: leases

- **Data:**
  - `features/leases/utils/leaseHelpers.js` (pure): `deriveLease` with the server's exact rules (none, month_to_month, active, expiring_soon with both ends of the notice window included, expired), the api mapping both ways, the form checks, and the words on screen.
  - Every tenancy carries `lease` now: `fromApiTenancy` maps the server's block, and the demo works it out from its stored fields.
  - Demo: `features/leases/utils/demoLeases.js` runs PUT and renew with the server's rules and error codes (`TENANCY_ENDED`, `NO_LEASE`, `INVALID_LEASE_DATES`, `NO_RENT_SCHEDULE`, `VALIDATION_ERROR`) and the event timeline (set, changed, renewed, nothing written when a save changes nothing).
  - Demo leases match the backend seed story: Sam ends in 25 days (expiring soon), Jordan in 70 days (active), Priya month to month, Morgan (moved out) expired, Alex none.
  - `TenantsProvider` adds `fetchLease`, `setLease`, `renewLease`, and `findTenancy`. Real mode calls `GET/PUT /tenancies/:id/lease` and `POST .../lease/renew`, then reloads the tenants quietly. `tenancy:updated` already reloads them.
  - `useLeaseActions` (renew): in the demo a new rent also moves the demo rent schedule, starting the first month not billed yet (the server does both in one step).
- **Screens and sheets:**
  - `Leases` (new, landlord drawer, Rentals section): current tenancies sorted by end date, then a "Moved out" section, each row with a StatusLabel, the end date, and the days left. A row opens `TenantLease` by `tenancyId`.
  - `TenantLease` (was a stub, now built): reads `tenancyId` (Leases, the Dashboard line, push taps) or `tenantId` (Tenant Profile). It shows the lease block, Set or Edit and Renew (current tenancies only), the history timeline, and the existing Open Documents button.
  - Sheets (no routes): `LeaseFormSheet` (start, end, a month-to-month switch, renewal notice days, notes) and `RenewLeaseSheet` (new end date, optional new rent).
- **Homes:** the Dashboard has a Leases row ("1 ending soon" or "All leases current") and a terracotta line only when a current lease ends within 30 days (it opens that lease). The tenant home shows "Your lease ends Jan 15" within 90 days, and a read-only "Your Lease" row.
- **Push:** `lease:reminder` taps open `TenantLease` by `tenancyId` for owners and My Home for tenants (`listenForLeaseTaps`).
- **API client:** new calls for every route in this phase and the next ones. `parseApiError` keeps an object `details` (`REMINDER_TOO_SOON`'s `canSendAt`) as `error.info`, the client has an `as_text` option for the tax CSV, and there are friendly messages for the new error codes.
- **Navigation:** `Leases` is in the map (drawer, owner) and registered once in `App.js` as a `Drawer.Screen`. New edges: Dashboard → Leases, Dashboard → TenantLease (`tenancyId`), Leases → TenantLease (`tenancyId`), Leases → Tenants. TenantLease's params are now `tenancyId` and `tenantId`. The diagram was regenerated.
- **Tests:** `features/leases/utils/leases.test.js` (14). Updated because they asserted the old state: the tenancy mapping test (now has the lease block), the drawer plan test (Leases added), and the title rule (Leases and Profit are named one-word exceptions, since you asked for those exact titles).
- **Checks:** lint 13 (known), 463 tests passing, format clean, iOS bundle exported with `--clear`.

## Phase 2: expenses on the backend

- **One interface:** `useExpenses()` (`features/expenses/context/ExpensesContext.js`) in both modes. For a real landlord, `ExpensesProvider` loads every page of `GET /expenses`, maps it to the app's existing expense shape (`features/expenses/utils/expenseApi.js`), and `useWorkOrders()` takes its expenses and expense actions. That's the same swap `RemoteWorkOrdersProvider` already does, so Expenses, Year-End, the Dashboard, and the work order screens' `order.expenses` all read the server's list with no screen rewrites. The demo, tenants, and signed out keep the phone's own list.
- **Field mapping:**
  - amount (dollars on screen) ↔ `amountCents`
  - the category label ↔ the server's 10 categories (the form shows only those in real mode, and the phone's 4 extra categories map to the closest one on import)
  - the property name ↔ `propertyId` (a unit after a comma still matches, a name that isn't one of yours is refused with a clear message, blank means a general expense)
  - the payment words ↔ the server's 8 methods
  - the "Capital improvement" switch ↔ `taxDeductible` (the form says "Tax deductible" in real mode)
  - notes ↔ `description` (required, so it falls back to the vendor, then the category)
  - the first receipt ↔ `receiptKey` through the existing upload flow
  - `work_order_id` ↔ `workOrderId`
- **Real-mode form:** the server's categories and payment methods, the Tax deductible switch, and your properties as the choices. Repeat and Billed to tenant are hidden because the server doesn't store them. Split still works (it makes one server expense per property). The Recurring button is hidden in real mode, since its rules make phone-only expenses.
- **Saves:** they show right away, then the server's copy replaces them. On failure they roll back and an alert says why (offline gives "Can't reach the server..."). Offline writes aren't queued, the alert says so instead. Delete asks first in real mode (the server has no undelete), and the demo keeps the undo bar.
- **Offline reads:** the last list is cached per account (`rent_well_expenses_cache_<user id>`), shown first, and labeled "Offline: showing the copy saved on this phone". A socket reconnect reloads it.
- **Receipts:** `components/ReceiptImage.js` draws an upload key (through `RemoteImage`) or a phone file. It's used on the list, the form, the detail sheet, and the work order detail's expense rows.
- **Migration:** `ImportExpensesCard` shows for a real landlord with expenses saved only on this phone (the per-account key, the fake `seed-` ones left out): "Upload 23 expenses from this phone".
  - It uploads each first receipt, then calls `POST /expenses/import` with the phone ids as `clientId`s, 500 at a time, with a progress line.
  - It clears each local copy only when the server says `created` or `existing`. Failed ones stay with the first reason shown and a Try Again button, and retrying never doubles anything (the server answers `existing`).
  - A property the server doesn't know and billback amounts are kept in the expense's notes, so nothing is lost.
  - If the whole call fails, nothing is cleared and an alert says why.
- **Tax summary:** `TaxSummarySheet` (year chips, Share CSV, Share as Text) is on Expenses now, next to the existing CSV export. Real mode uses `GET /reports/tax-summary` (CSV and JSON), the demo builds the same CSV locally (Phase 3's port).
- **Filters:** the existing year, property, and category filters work on the server list. The year is the date range.
- **Tests:** `features/expenses/utils/expenseApi.test.js` (9) and `features/expenses/context/expensesRealMode.test.js` (7, the api mocked as docs/API.md answers: every page, the offline copy, add with a work order link, rollback with an alert, an unknown property never sent, delete and a failed delete, the import clearing only what the server confirmed and retrying the rest, and a failed import clearing nothing).
- **Checks:** lint 13 (known), 478 tests passing, format clean, iOS bundle exported with `--clear`.

## Phase 3: profit

- **Math:** `features/profit/utils/profitMath.js` is a port of the server's `src/reports/profit.js` and `taxSummary.js`.
  - It uses the same input rows and one definition of rent collected: succeeded rent-pool payments, refunds taken off, deposits and claims left out, bucketed by `paid_on`.
  - Expenses count by `spent_on` whether or not they're deductible.
  - Every property gets a row, plus general and total. A one-property report drops general.
  - The tax summary uses Schedule E lines, deductible expenses only, with non-deductible on its own line. The CSV is byte for byte the server's format.
  - Adapters turn the demo ledgers and the app's expenses into server rows, and the server's camelCase responses into the same output.
- **Parity:** `features/profit/utils/profitParity.test.js` (12) runs the backend's own `tests/reportMath.test.js` cases against the port, the same way `backendParity.test.js` does for the ledger. It also checks that the demo's rent collected for this month equals the ledger month summary, and the response mapping.
- **`useProfitReport(year, property_id)`:** for a real landlord it calls `GET /reports/profit` and refetches on `ledger:updated` or a reconnect. Everywhere else it builds the report from the demo's tenants, ledgers, and expenses. `useTaxSummary()` gives CSV and text: the server's (`format=csv` and `json`) or the local port.
- **`Profit` screen** (new, landlord drawer, Money section, title "Profit"):
  - A year picker (`SegmentedControl`, this year and the two before).
  - The hero net profit in Fraunces (`SummaryBlock`), with muted "Rent collected" and "Expenses" lines.
  - `ProfitChart`: one set of forest green bars by month on the paper, hairline gridlines, a zero line with losses hanging under it, month initials, and a spoken summary.
  - "By property" as plain rows (name, net on the right, "$X in, $Y out"). Tapping a row puts that property in the chart, and "Show all" goes back. General expenses get their own row.
  - A Tax Summary button that opens the shared sheet.
- **Dashboard:** a Profit row with a live subtitle ("$2,340 net this month", terracotta when it's a loss).
- **Navigation:** `Profit` is in the map (drawer, owner, Money) and registered once as a `Drawer.Screen`, with a new edge Dashboard → Profit. The drawer plan test lists it, and the diagram was regenerated.
- **Checks:** lint 13 (known), 490 tests passing, format clean, iOS bundle exported with `--clear`.
