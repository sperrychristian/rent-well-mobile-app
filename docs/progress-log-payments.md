# Payments and rent ledger: progress log

Branch `payments-ledger-app`, made from `fintech-polish` because there's no `polish-2` branch. Not merged.

## Before Phase 1: what was missing and what I chose

- `docs/API.md` and `../rent-well-api` have no ledger at all (the backend migrations end at `009_tenant_management.sql`). Christian picked "build demo-first": I wrote a draft contract in `docs/API-ledger-draft.md`, wrote my own pure math and hand-worked vectors, built every screen on a full local demo ledger, and wired real mode to the draft endpoints.
- New dependencies (Christian approved them): `expo-haptics` and `expo-clipboard` through `npx expo install`, and `@testing-library/react-native` plus `react-test-renderer@19.2.3` as dev dependencies. The renderer is pinned to exactly 19.2.3 to match React 19.2.3, because 19.3.x wants a newer React.
- `jest.setup.js` mocks the icon font, AsyncStorage, haptics, and clipboard so screen tests can render.
- I fixed one test that was already failing before I started: `demoTenants.test.js` depended on the real date. It now checks the relative order of the two invites instead.

## Phase 1: data layer (done)

- **Money:** whole cents everywhere. `utils/formatCurrency.js` gained `formatCents`, `parseAmountToCents` (dollars and cents are read as two separate integers, never a float), `centsToInputText`, and `isCents`.
- **`features/payments/utils/ledgerMath.js`** (pure):
  - Rent due dates and missing rent charges.
  - Late fees.
  - Allocation, oldest charge first. Deposit money only pays deposit charges, and a refunded deposit never makes the deposit owed again.
  - Charge status.
  - `deriveLedger`: balance, due now, overdue, deposit held, pending, next due, and row status.
  - `monthSummary`, `collectedShare`, and `syncLedger`.
- **`ledgerVectors.js`:** hand-worked vectors the backend should also pass.
- **`ledgerHelpers.js`** (pure):
  - Status pills (always words plus an icon), method and kind labels, and `formatBalance`.
  - `monthTitle`, `shortDate`, and `groupByMonth`.
  - Form checks for payments, claims, charges, schedules, and reasons.
  - `buildReceiptText` and `timelineFor`.
- **`ledgerApi.js`:** camelCase to snake_case and back, `replaceLedger`, and `findPayment`.
- **`demoLedger.js`:** the demo's version of every action, with the same rules and error codes as the draft.
- **`data/sampleLedger.js`:** five demo ledgers dated from today. The tests check that the story holds on any date:
  - Sam is overdue with a late fee and has a rejected claim.
  - Jordan has a claim waiting.
  - Priya is partly paid and still inside her grace days.
  - Alex has a credit and one voided duplicate.
  - Morgan has moved out and got the deposit back.
- **`context/LedgerContext.js`:** `LedgerProvider` and `useLedger()`, with one interface for both modes.
  - Demo: memory only, built when the demo starts and shared by both demo sides. It starts fresh after an exit, and no storage key is ever touched.
  - Real: `GET /ledgers` with a per-account cache (`rent_well_ledger_cache_<user id>`), an offline flag, `ledger:updated` and reconnect reloads, and push taps.
- **`services/api.js`:** one function per draft endpoint. `apiHelpers.js` has friendly messages for the new error codes. `push.js` has `listenForLedgerTaps`.
- **`App.js`:** `LedgerProvider` sits inside `TenantsProvider`.
- **Small fix:** `eslint.config.js` now knows the Jest globals in `jest.setup.js`.
- **Decision:** the owner's ledger push opens Payments for now and will switch to the Rent Ledger screen in Phase 2, once that route exists. The navigation test turns away unregistered routes.
- **Checks:**
  - Lint: 13 problems, the same known baseline.
  - Tests: 314 passed in 28 suites.
  - Format: clean.
  - `npx expo export --platform ios --clear`: OK.

## Phase 2: owner screens (done)

- New shared pieces:
  - `components/ui/Toast.js`: `ToastProvider` is mounted once in `App.js`, and screens call `useToast().show(text, icon)`. It announces to screen readers and skips the fade when Reduce Motion is on.
  - `utils/haptics.js`: `hapticSuccess` and `hapticWarning`.
- **Payments and Rent** (`PaymentsScreen` → `components/OwnerPaymentsView.js`) has:
  - a month picker with 44pt arrows that stop at the first month with charges and at next month
  - property segments (chips once there are more than 3 properties)
  - an indigo summary: collected in the month, of what was expected, what's still out, and a progress bar
  - KPI tiles: overdue now, and claims to confirm
  - the claims queue, with Confirm and Reject on each row
  - tenant rows with a balance and a status pill, worst first, then folded past tenants
  - a skeleton, an error state, an empty state, the offline banner, and pull to refresh
- **Rent Ledger** (new route `TenantLedger`, param `tenancyId`) has:
  - the balance or credit with its pill
  - an overdue banner, and an ended-tenancy note
  - KPI tiles for next due and deposit held
  - Record Payment (primary), Add Charge, and Set or Edit Rent, with the schedule in one line under them
  - claims to review
  - charges and payments grouped by month
  - a header add button set with `navigation.setOptions`, like Properties
  - Tapping a charge offers Void Charge.
- **Forms** (`features/payments/components/`) share `FormSheet` and `FormBits`. Each one has inline errors under its field, return keys that move to the next field, and Cancel on the left with the action on the right.
  - `PaymentFormModal` (it also serves the tenant claim in Phase 3), `ChargeFormModal`, `ScheduleFormModal`, and `InstructionsModal`.
  - `ReasonModal` handles reject and both voids. A void asks "are you sure" a second time.
- **`hooks/useLedgerReview.js`:** confirm, reject, void payment, and void charge, shared by all three owner screens. It adds the toasts, a success haptic on confirm, and a warning haptic on reject and void. Saving a payment or a schedule also buzzes.
- **Payment Record** (`PaymentDetail`) is a real screen now. It has:
  - the amount and status
  - reasons for a reject or a void
  - a facts list and a timeline
  - the receipt photo
  - Share Receipt, which writes a `.txt` to the cache and opens `expo-sharing`, like the expenses CSV
  - for owners: Confirm and Reject on a claim, Void on a confirmed payment, and a link to the ledger
  - In real mode, a payment that isn't loaded yet is fetched (for push taps).
- **Property Overview** has a Payment instructions card with Add or Edit.
- **Tenant Profile** has a Rent Ledger link under each current home.
- **Navigation:**
  - The map has `TenantLedger` with edges from Payments, Tenant Profile, and Payment Record. Payment Record is now `built`.
  - `App.js` registers TenantLedger in the owner group.
  - The ledger push opens the Rent Ledger for owners.
  - `ASSIGNMENT_NAV.md` has the table regenerated from the map (31 screens), the new header button, and `tenancyId` in the params list.
  - The diagram was redrawn and checked.
- **Tests:** `paymentScreens.test.js` renders Payments, the Rent Ledger, and Payment Record in the owner demo, confirms a claim from the list, and checks id-only navigation.
- **Checks:**
  - Lint: the 13 known problems.
  - Tests: 320 passed in 29 suites.
  - Format: clean.
  - iOS export with `--clear`: OK.

## Phase 3: tenant screens (done)

- **Payments and Rent for tenants** (`components/TenantPaymentsView.js`) has:
  - an indigo "You owe" card with due now, overdue, or a credit
  - an overdue banner
  - KPI tiles for next rent and deposit held
  - a large primary "I Paid" button
  - a "How to pay" card with the landlord's instructions, a Copy button (`expo-clipboard` and a toast), and a line that Rent Well doesn't take payments
  - claims waiting for confirmation
  - "Not accepted" claims from the last 60 days with the landlord's reason
  - charges and payments by month (two months, then "Show all history")
  - folded past rentals
  - a skeleton, an error state, an empty state, the offline banner, and pull to refresh
- **"I Paid"** reuses `PaymentFormModal` as a claim: amount (it starts on what's due now or the next rent), method, date, rent or deposit, note, and receipt. There's no refund switch. Sending gives a toast and a success haptic, and the claim shows "Waiting for confirmation" until the landlord acts.
- **Former tenants** (`is_read_only`) see an info banner and their history, with no "I Paid" button.
- **Payment Record** for tenants is read only. A pending claim shows a waiting banner, and a rejected or voided one shows the reason.
- **`PaymentsScreen`** is now a thin switch: tenant view or owner view. The map marks Payments `built`, the diagram was redrawn, and the `ASSIGNMENT_NAV.md` row was regenerated.
  - Dropped comments that described the removed sample payments: "a few made-up payment ids so the detail screen has something to open, the real ones will come from the server", "the pixel card stands in until real payments exist", and "each sample is a row now, tapping it opens the same detail the Open button did".
- **Visual QA** (web render in the scratch copy, 390 wide plus 360 by 640) found three things, all fixed and re-checked:
  - "Next due" showed the oldest unpaid charge (Sep 1, $450) and not the coming rent date. A new `upcomingRent` helper gives "Next rent Nov 1, $1,450.00".
  - The tenant card caption repeated the amount ("$2,000.00 of it is overdue"). It now says "Overdue" when all of it is.
  - "Save Payment" and "Send to Landlord" wrapped on a phone. They're now "Save" and "Send".
  - Nothing else stood out: no page errors, every pill has words and an icon, and the sheets fit at 390.
- **Tests:** tenant render tests for the view, Copy, and the read-only Payment Record, plus `upcomingRent`.
- **Checks:**
  - Lint: the 13 known problems.
  - Tests: 324 passed in 29 suites.
  - Format: clean.
  - iOS export with `--clear`: OK.

## Phase 4: dashboards and polish (done)

- **Landlord Dashboard:**
  - The Payments and Rent tile is live. It reads "1 overdue", "2 claims to review", "All paid up", or "Set up rent", with a matching tone and a badge for the claims count.
  - A new tappable "Collected in Oct" KPI tile shows rent collected this month against rent expected, and opens Payments.
  - Both come from `ownerPaymentsLine`, which reads the ledger already in memory.
- **My Home (tenant):**
  - The Payments and Rent tile reads "$2,000.00 overdue" (red, with an alert icon), "Rent due now: $580.00", or "Rent due Nov 1: $1,450.00". A credit comes off the next rent.
  - The read-only home has a new "Payment History, read only" card.
  - These lines come from `tenantRentLine`.
- **Haptics:** only on confirm and save (record a payment, save a schedule, send a claim, confirm a claim). I took the warning buzz off reject and void to match the brief, and `hapticWarning` is gone.
- **States and toasts:** empty, offline, and error states and toasts for routine success were already in from Phases 2 and 3.
- **Visual QA:** the first try of the Collected tile used `flex: 0` and collapsed on the web render. I fixed it by putting it in a row like the other KPI tiles, then re-checked it.
- **Checks:**
  - Lint: the 13 known problems.
  - Tests: 326 passed in 29 suites.
  - Format: clean.
  - iOS export with `--clear`: OK.
