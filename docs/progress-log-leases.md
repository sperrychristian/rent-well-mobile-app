# Leases, expenses, and onboarding: progress log

Branch `leases-expenses-onboarding`, made from `master` (which already had `ledger-real-mode` merged in). Not merged.

## Phases 1 to 3: waiting on the backend

`docs/API.md` and `../rent-well-api` don't have leases, expenses, `POST /expenses/import`, or `GET /reports/profit` yet. As Christian asked, nothing for those is built, and there's no placeholder UI or route for them. They'll be done when `docs/API.md` has the real contract.

## Phase 4: onboarding and empty states (done)

- **Setup checklist** (`features/home/components/OnboardingCard.js`):
  - It shows on the Dashboard for a signed-in landlord only, never in the demo or for a tenant, and only once their tenants and ledgers have loaded.
  - It has three steps:
    - Add a property: opens Your Properties.
    - Invite a tenant: opens Invite a New Tenant. It waits on a property.
    - Set the rent: opens the existing Rent Schedule sheet right on the Dashboard for the first current tenancy with no schedule, and saves with `setRentSchedule`. It waits on a tenant who has joined.
  - A progress line shows how many are done.
  - It disappears when every step is done, or when the landlord taps "Hide this for good", which is saved per account.
  - The step rules are pure functions in `features/home/utils/onboarding.js`.
- **Navigation:** two new edges, Dashboard → Properties and Dashboard → InviteTenant, for owners. The map, the diagram (redrawn and checked), and the `ASSIGNMENT_NAV.md` table are updated. There are no new screens or params.
- **Demo tour:**
  - `DemoTourSheet` is a bottom sheet with four things to try, one list per demo side.
  - `useDemoTour` opens it once on the first Dashboard or My Home in the demo, and remembers that under the device-level key `rent_well_demo_tour_seen`.
  - Settings has a "Take the tour" row (demo only) that opens it again.
  - Real mode never shows it.
- **Empty-state audit:** every list now has a Fraunces title, one muted sentence, and one primary action where an action exists.
  - **Properties:** Add Property. It used to point at the retired `house_mark` drawing.
  - **Tenants:** Invite a Tenant.
  - **Work Orders:** Add a Work Order.
  - **My Requests:** Report an Issue.
  - **Messages:** Invite a Tenant for owners. Tenants get a sentence and no button.
  - **Expenses:** Add Expense.
  - **Documents:** Add Document.
  - **Checklist:** New Checklist, with a real title and sentence. It used to cram the instruction into the title.
  - **Mileage:** Add Trip, with its own car icon.
  - **Past Requests:** a title and sentence. It's read only, so there's no button.
  - **Payments:** already had both, and the tenant side stays without a button.
  - **No Leases screen:** that's waiting on the backend.
- **Skeletons:** every list that loads from the server already had the shared SkeletonList, which matches the ruled rows. Expenses, Documents, Checklist, and Mileage are on-phone data with no loading wait, so they need none.
- **Tests:**
  - `features/home/utils/onboarding.test.js`: 6 tests.
  - `features/home/components/onboarding.test.js`: 8 tests. They cover the checklist's steps and navigation, the schedule sheet save, hiding per account, demo, tenant, and all-done, the tour opening once and reopening, and the empty-state action.
  - `features/settings/screens/SettingsScreen.test.js`: 2 tests.
- **Visual QA** (web render in the scratch copy at 390, 360 by 640, and 820 by 1180):
  - Looked at: the tour on both demo sides, the checklist at 0, 1, and 2 of 3, Settings with the tour reopened, and the Documents and Expenses empty states.
  - No page errors.
  - Fixed: "Hide this for good" sat indented from the rows. It's lined up now.
  - The checklist only renders in real mode, so for QA the scratch copy forced it on with empty data. That change never touched the repo.
- **Checks:**
  - Lint: the 13 known problems.
  - Tests: listed in the next line.
  - Format: clean.
  - iOS export with `--clear`: OK.
  - Tests: 400 passed, 400 total.
