# Ledger real mode: progress log

Branch `ledger-real-mode`, made from `hearth-redesign`. Not merged.

- **The contract:**
  - `docs/API.md` here was older than the backend's, and had no Rent ledger section. I copied `../rent-well-api/API.md` over it, so it matches the backend again.
  - The real API wins over `docs/API-ledger-draft.md` on every difference, so the draft doc is deleted.
- **Real mode uses the server's math:** `fromApiLedger` stores the server's statuses and balances in `ledger.server`, and `deriveLedger` returns those as is. Every action answers with one row, and then that tenancy is refetched.
- **Demo mode keeps its local math, now ported from the backend's `src/ledger`:**
  - The server's payment status names.
  - The `due_soon` charge status.
  - Grace days only on rent.
  - The rent balance only counts what's due by today.
  - Credit and debt.
  - Refunds reopen the newest paid charge.
  - The server's `next_due`.
  - No late fee while a rent claim is waiting.
  - The backend's own ledger math tests are copied into `backendVectors.js` and run in `backendParity.test.js` (29 tests).
- **Checks:**
  - Lint: the 13 known problems.
  - Tests: 384 passed in 32 suites.
  - Format: clean.
  - iOS export with `--clear`: OK.
  - The navigation map, App.js, and the diagram are unchanged.
