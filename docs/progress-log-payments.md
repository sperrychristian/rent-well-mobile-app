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
