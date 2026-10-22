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
