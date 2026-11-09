# Milestone 2 progress log: Firebase Realtime Database as the only backend

Branch `milestone-2-firebase`, off `master` at `3b4dc69`. Newest phase at the bottom.

## Phase 0: baseline and setup

- `master` was clean and level with `origin/master`.
- Baseline on master: 63 test suites, 693 tests passing. Format check clean. iOS bundle
  (`npx expo export --platform ios --clear`) exported. Lint had the 12 known problems (7 errors,
  5 warnings), so lint was red.
- Fixed the red lint on this branch (not on master):
  - Six `react-hooks/set-state-in-effect` errors in `context/WorkOrdersContext.js` and the
    Documents, Add Expense, Budgets, and Trip modals. Each one fills or reloads state when the
    screen or modal opens, which is what it's meant to do, so each gets a one line
    `eslint-disable-next-line` with that reason instead of a rewrite that could change behavior.
  - One unescaped apostrophe in `AddExpenseModal.js` (`today&apos;s`).
  - The 5 `exhaustive-deps` warnings are left alone (adding those dependencies would change when
    the effects run). Lint now exits 0.
- `.gitignore` now ignores `.env` (it only ignored `.env*.local` before). The Firebase URL lives
  only in the git-ignored `.env`. `git check-ignore -v .env` confirms it, and every commit on this
  branch goes through a staged diff check for the project id before it's made.

## Phase 1: folders and metadata

- Moved with `git mv` (34 files), then rewrote every relative import, `require`, and `jest.mock`
  path (190 files) with a script that resolves each path from the file's old location:
  - `utils/*` to `util/*`.
  - `services/appLock.js`, `navigationRef.js`, `systemPickers.js` to `util/`.
  - `services/config.js` to `constants/config.js` (phase 3 rewrites it there, so it lands in its
    final folder now instead of a stop in `util/`).
  - `theme.js` and `theme.test.js` to `constants/`.
  - `context/ThemeContext.js`, `context/WorkOrdersContext.js`, and every feature's `context/`
    folder (auth, expenses, messages, payments, security, tenants, workOrders) to `store/`, with
    their tests.
  - `services/attachmentUrls.js` stays where it is: it only serves API uploads, and it goes away
    with the rest of the API code in phase 4.
- `navigationCalls.test.js` skips `util/navigationRef.js` now (it was `services/`).
- Metadata:
  - `package.json`: name `rent-well`, a description, author Christian Sperry.
  - `app.json`: name `Rent Well`, a description, author Christian Sperry. `expo config` accepts both
    keys.
  - The slug stays `rent-well-mobile`. Expo Go keys local storage by slug, so renaming it would hide
    data already saved on the phone. There are no bundle ids to keep.
- Living docs (CLAUDE.md, README, ASSIGNMENT files, DESIGN.md, shared-state.md) point at the new
  paths. CLAUDE.md has a course folder map. The historical progress logs are left as written.
- Checks: lint 0 errors (5 known warnings), 693/693 tests, format clean, iOS bundle with `--clear`
  exported.

## Phase 2: data model

- A second session was writing to the repo at the same time (it left an untracked
  `util/data/model.js`). Christian stopped it, and that file was deleted unused.
- `scripts/dataModel.mjs` is the one list of nodes, keys, fields, and references. `npm run data-model`
  (`scripts/buildDataModelDiagram.mjs`) draws `docs/data-model.svg` and `.png` from it with elkjs and
  headless Chrome. The first two drafts were too small to read (one tall column, every `ownerId`
  arrow drawn). The final one runs top down, leaves out the `ownerId` arrows (the subtitle says so),
  and fits one landscape page with readable field names.
- `docs/data-model.md`: design rules, the annotated JSON tree, who reads and writes each node, what
  stays on the phone, and the rent catch-up.
- `database.rules.json`: test mode (`.read` and `.write` true), no `.indexOn`, since the app filters
  on the phone instead of using REST queries.
- `docs/API.md` is now a short note pointing to the data model, so the code comments that cite it
  still lead somewhere.
- Decision: rent and late fee charge ids stay the ledger's existing deterministic ids
  (`rent-{tenancyId}-{yyyy-mm}`, `late-rent-...`) instead of a new format, so the ledger math and
  its parity tests keep working unchanged.

## Phase 3: util/http.js and test infrastructure

- `util/http.js` is the single entry point: `request` (10 second AbortController limit), `getNode`,
  `putNode`, `patchNode` (multi-path at any parent), `pushNode`, `deleteNode`, `createIfAbsent`
  (`if-match: null_etag`, gives back false on 412), and one `ApiError` per failure (`NOT_CONFIGURED`,
  `NETWORK_ERROR`, `TIMEOUT`, `PERMISSION_DENIED`, `NOT_FOUND`, `BAD_REQUEST`, `SERVER_ERROR`).
  It re-exports the resource modules in `util/data/`: session, users, properties, tenants, invites,
  workOrders, expenses, mileage, ledger, leases, messages, reminders, checklists, documents, settings,
  plus the shared `records.js` (keyed objects, field-level multi-path patches) and `pushId.js`.
- Decision: the data modules that replace server routes (work orders, expenses, messages) hand back the
  same camelCase shapes the old API sent, so the existing `fromApi*` mappers and providers keep working.
  Tenants and the ledger load in the demo's own shape, so the demo's rule functions (`demoTenants.js`,
  `demoLeases.js`, `demoLedger.js`) make every change and only the difference is written. No tenancy,
  lease, or money rule is written a second time.
- `services/apiHelpers.js` moved to `util/apiHelpers.js` (pure, still used by the demo rules).
- `constants/config.js` reads `EXPO_PUBLIC_FIREBASE_DB_URL` and `EXPO_PUBLIC_FIREBASE_API_KEY` (optional,
  unused until Auth). `.env.example` has placeholders only.
- `scripts/fakeDatabase.js` is the in-memory REST core (GET, PUT, PATCH with multi-path and the overlap
  rule, POST push ids, DELETE, null for missing, empty objects pruned, arrays to numbered keys,
  `if-match`). `scripts/fakeFirebase.mjs` (`npm run firebase:fake`) serves it over `node:http` with
  CORS, `--delay`, and `/__delay`, `/__fail`, `/__reset` switches for visual QA. The tests use the same
  core behind a fake `fetch` (`scripts/testing/fakeFirebase.js`).
- `scripts/seedData.js` builds the seed from the demo's own data (tenant data, sample ledgers, threads,
  work orders, expenses, trips, budgets, checklists, documents) through the same `toDb` functions the
  app saves with. Additions: a roommate (Riley Park in Sam's unit), an expired invite, a second landlord
  with no data (Jamie Ortiz, for empty screens), a reminder from three days ago, and a second expense
  linked to a work order. `scripts/seedFirebase.mjs` (`npm run firebase:seed`, `--reset`,
  `npm run firebase:check`) only writes to the `.env` database or a local address and never prints the
  address. `scripts/appModules.mjs` is a small resolve hook so node can import the app's extensionless
  modules.
- Real database: reachable from this machine (`GET /.json` answered 200 with `null`). Seeded and
  checked: all 18 nodes PASS. A scratch probe confirmed the conditional PUT: 200 the first time, 412 the
  second, value unchanged, scratch path deleted.
- A bug the tests caught: the first seed keyed messages `m001`, which sorts after real push ids, so a new
  message would have shown as the oldest. Seed messages now get push ids from their own timestamps.
- Tests: `util/http.test.js` (14) and `util/data/*.test.js` (34): users and both sign ups, work orders
  (scoping, tenant report, edit, statuses, delete and unlink), expenses (CRUD, validation, import per
  row and no doubles), ledger (scoping, catch-up twice, two phones at once, grace days, claim and
  confirm, schedule change), tenants (view, properties, invites, move as one write, end, leases),
  messages (sides, send, read, metadata), and the list modules.
- Checks: lint 0 errors (5 known warnings), 71 suites and 741 tests passing, format clean, iOS bundle
  with `--clear` exported.

## Phase 4: mode, auth stand-in, and providers

- "Real" mode is Firebase now. The demo is untouched and still fully local.
- `store/AuthContext.js`: the test accounts stand-in. Log In lists `users` (landlords, then tenants) and
  keeps only the picked account (id plus a copy for offline) in AsyncStorage under
  `rent_well_test_account`. On launch it opens signed in from that copy, then re-reads the record; a
  record that's gone (database reset) goes back to Log In with a note. `homeRouteFor` and role routing
  are unchanged. The data modules read the signed-in user from `util/data/session.js`, which the auth
  context sets.
- Log In (`LoginScreen`, same route name) is the labeled "Test accounts" picker with loading, error,
  and empty states. Both register screens (same route names) lost their password fields and show a one
  line note that real sign in comes with Firebase Auth. Tenant sign up checks the invite in `invites`,
  then writes the user, the tenancy, the conversation, and the used invite in one multi-path PATCH.
- Providers keep their public hook shapes and their demo halves:
  - Work orders: `RemoteWorkOrdersProvider` on `util/http.js`, optimistic with rollback, plus a new
    `deleteWorkOrder` (also added to the local context for the demo). The form edits every field for a
    landlord and a tenant edits their own while Open (`editRuleFor` lost its real-mode tenant limit).
    The preferred date is saved on the record.
  - Expenses: same provider on Firebase, optimistic with rollback and an alert, import in one write.
  - Tenants, properties, invites, leases: the Firebase bundle runs the demo's rule functions, shows the
    result right away, writes the difference in one PATCH, and rolls back on failure. Move and end are
    atomic. A tenant's own rentals and read-only state come from the same bundle.
  - Ledger: one ledger per tenancy in the demo's shape, every change is a `demoLedger.js` action
    written with `saveLedgerChange`, rollback on failure. The landlord's load and every pull to refresh
    run `catchUpLedgers` (rent and late fees with `createIfAbsent`). A tenant's phone works this month's
    charges out on screen without writing them. Month summaries use `monthSummary`, like the demo.
  - Messages: Firebase conversations and messages, `lastReadAt` and `unreadCount` per user, an 8 second
    check while a thread is open (started and stopped by focus, blur, and the app going to the
    background), read writes only when something is unread.
  - Reminders: the demo's preview and send rules on the saved log, the message goes in the conversation
    with `metadata.type: rent_reminder`, then the reminder record is saved.
  - Profit and the tax summary: worked out on the phone with `profitMath.js` in both modes, loading and
    error from the expense and ledger stores.
  - The landlord's trips, documents, checklists, mileage rate, and budgets: `WorkOrdersContext` loads them
    from Firebase after the phone copy (which stays as an offline cache) and writes each change as a
    field-level multi-path PATCH, rolling back with an inline message on failure.
- No uploads in Firebase mode, and nothing left that looks like it would upload: the message camera
  button, the request Photos card, the work order form's photos, the payment receipt photo, expense
  receipts and Scan Receipt, the document file picker and Scan, and checklist item photos are hidden
  outside the demo. Firebase documents are records ("Record only", no Open / Share).
- Refresh without sockets: `navigation/useRefreshOnFocus.js` reloads the stores a screen shows, quietly,
  when it comes back into view. Every data screen uses it. Pull to refresh and the reload after every
  write stay.
- Work Order Detail has a confirmed Delete Work Order (destructive button, the expenses stay unlinked).
- Removed: `services/` (api, apiClient and its test, attachmentUrls, push, socket, tokenStorage), the
  `expo-secure-store` config plugin, and the packages `socket.io-client`, `expo-notifications`, and
  `expo-secure-store` (`npm uninstall`, nothing added). `RemoteImage` shows the key as a uri now.
- Tests removed because they only tested the Express API: `services/apiClient.test.js`,
  `store/remoteWorkOrders.test.js`, `store/expensesRealMode.test.js`,
  `features/payments/screens/paymentRealMode.test.js`, `features/realModeScreens.test.js`. Rewritten:
  `NewWorkOrderScreen.test.js` (Firebase rules, every field editable, tenant edit while Open) and one
  `editRuleFor` case. The secure store and notifications mocks came out of seven navigation tests.
- New: `store/firebaseProviders.test.js` (19: test accounts, sign ups, each store's load, optimistic
  change, rollback, error state, refresh, the 8 second check, the cloud lists) and
  `navigation/firebaseFlows.test.js` (10 flows on the real App: Log In picker, landlord add, edit,
  delete with Home count and badge, tenant report seen by the landlord, record payment, claim and
  confirm, end tenancy turns the tenant read only, expense and Profit, message send and receive, light
  and dark).
- Comments removed because their code is gone (everything else kept word for word, and four comments I
  had reworded were put back with a new line under them instead):
  - `App.js`: the push banner setup.
  - `store/AuthContext.js`: the refresh token and push token comments.
  - `store/RemoteWorkOrdersProvider.js`: photo upload, socket, reconnect, and push tap comments, plus
    the owner-only Update steps and the old Report an Issue note.
  - `store/ExpensesContext.js`: receipt upload and socket reconnect.
  - `store/TenantsContext.js`: the server loads, socket and push taps, `GET /me`, and the old lease and
    detail notes.
  - `store/LedgerContext.js`: every comment inside the old server store (details, socket, push, upload).
  - `store/MessagesContext.js`: push tap, attachment url cache, socket, upload, and join and leave.
  - `features/profit/hooks/useProfitReport.js`: the server report, socket reload, and server tax export.
  - `features/workOrders/screens/NewWorkOrderScreen.js`: the photo list, `GET /me`, the server date, and
    the photo-on-detail notes.
  - `features/workOrders/utils/workOrderHelpers.js`: the real-mode tenant limit.
  - `features/tenants/screens/TenantLeaseScreen.js`: the `tenancy:updated` listener.
  - every comment in the deleted `services/` files.

## Phase 5: loading, error, and empty states

- New shared pieces in `components/ui/`:
  - `ScreenState`: loading (spinner and a label, a still icon with Reduce Motion), error (the message
    and Try Again), and empty (the existing EmptyState). Loading and error are announced to screen
    readers and use live regions.
  - `InlineError`: a small banner (words and an icon, never color only, 44pt Retry or OK) for a
    refresh that failed over older data or a save that didn't go through.
  - `DataScreen.js` (`withDataScreen(Screen, { stores, label })`) and `store/useScreenData.js`: one
    answer for "is this screen's data ready" across the stores it reads. The wrapped screen always
    stays in the same place in the tree, so a banner never resets a form.
- `components/ErrorState.js` now draws `ScreenState`, so every existing error looks and reads the same.
- Wrapped: Dashboard, Tenant Home, Tenant Lease, Property Overview, Tenant Profile, Documents,
  Checklists, Checklist, Mileage, Year-End Report, Rent Ledger, Payment Record, Calendar, Search, and
  the work order form. Bare spinners on Work Order, Request, Tenant Profile, Invite Tenant, and the
  message thread became labeled `ScreenState`s. Settings shows a save banner but never blocks, so Log
  Out is always reachable.
- Fixed while testing: the skeleton loader had `accessibilityRole="progressbar"` but wasn't
  `accessible`, so screen readers never heard "Loading". It is now.
- `navigation/screenCoverage.js` is the coverage matrix (below). `navigation/screenCoverage.test.js`
  checks it lists every screen in the navigation map, then opens each data screen on the real App in
  Firebase mode three ways: loading (the database never answers), error (no connection), and empty (an
  account with nothing yet). 75 cases, all passing.

### Screen coverage matrix

`*` = fully implemented: it reads or writes Firebase and handles loading and error.

| Screen | Reads | Writes | Loading | Error | Empty |
| --- | --- | --- | --- | --- | --- |
| Welcome | static | - | - | - | - |
| DemoChooser | static | - | - | - | - |
| Login * | users | - | spinner | error with Try Again (and the setup message when .env has no address) | no test accounts yet, with the seed command |
| RegisterOwner * | users | users | busy button | inline error, the form keeps its values | - |
| RegisterTenant * | invites, users | users, tenancies, conversations, invites | busy button | inline error, the form keeps its values | - |
| Dashboard * | orders, ledger, tenants, messages, expenses | charges (the rent catch-up) | spinner | error with Try Again, banner when a refresh fails | zero counts and the setup checklist |
| WorkOrders * | orders | - | skeleton | error with Try Again, banner over the saved list | no work orders, with Add |
| WorkOrderDetail * | orders, expenses, messages | workOrders (start, resolve, priority, notes, contractor, delete), expenses | spinner | error with Try Again, an alert when a save fails | - |
| Tenants * | tenants | invites (resend, revoke) | skeleton | error with Try Again, banner over the saved list | no tenants, with Invite |
| TenantDetail * | tenants, orders, messages | tenancies (move, assign, end) | spinner | error with Try Again, inline error in the move and end forms | - |
| TenantLease * | tenants, ledger | leases, leaseEvents, rentSchedules (renew with new rent) | spinner | error with Try Again, inline error in the lease forms | no lease yet, with Set Lease |
| Leases * | tenants | - | skeleton | error with Try Again | no leases, with Tenants |
| Properties * | tenants | properties (add, edit, delete) | skeleton | error with Try Again, banner, inline error in the form | no properties, with Add |
| PropertyDetail * | tenants, ledger | properties (payment instructions) | spinner | error with Try Again | - |
| InviteTenant * | tenants | invites, properties | spinner | error with Try Again, inline error in the form | no pending invites |
| Documents * | cloud | documents (records only) | spinner | error with Try Again, banner when a save fails | no documents, with Add |
| Checklist * | cloud | checklists (new, delete) | spinner | error with Try Again, banner when a save fails | no checklists, with New |
| ChecklistDetail * | cloud | checklists (items, rooms, sign) | spinner | error with Try Again, banner when a save fails | - |
| Expenses * | expenses, cloud | expenses (add, edit, delete, import), ownerSettings (budgets) | skeleton | error with Try Again, banner over the saved list, an alert when a save fails | no expenses, with Add |
| Profit * | expenses, ledger, tenants | - | skeleton | error with Try Again | nothing for the year yet |
| Mileage * | cloud | mileage | spinner | error with Try Again, banner when a save fails | no trips, with Add |
| YearEndReport * | expenses, cloud | - | spinner | error with Try Again | zero totals for the year |
| TenantHome * | tenants, ledger, orders, messages | - | spinner | error with Try Again | No Active Rental (read only) for a former tenant |
| MyRequests * | orders | - | skeleton | error with Try Again, banner over the saved list | no requests, with Report an Issue |
| RequestDetail * | orders | - | spinner | error with Try Again | - |
| PastRequests * | orders, tenants | - | skeleton | error with Try Again | no past requests |
| NewWorkOrder * | tenants, orders | workOrders (add, edit) | rental lookup spinner | inline error, the form keeps its values | - |
| Messages * | messages | - | skeleton | error with Try Again | no conversations |
| MessageThread * | messages | messages, conversations (send, read) | spinner | error with Try Again, the draft stays when a send fails | no messages yet |
| Payments * | ledger | payments (claims, confirm, reject), charges (catch-up) | skeleton | error with Try Again, banner over the saved ledgers | no tenants to collect from |
| TenantLedger * | ledger | payments, charges, rentSchedules, reminders, messages | spinner | error with Try Again, inline error in each form | nothing on the ledger yet |
| PaymentDetail * | ledger | payments (confirm, reject, void) | spinner | error with Try Again | - |
| Settings | cloud | ownerSettings (mileage rate) | - | banner when a save fails | - |
| Calendar * | orders, ledger, tenants | - | spinner | error with Try Again | nothing this month |
| Search * | orders, tenants, ledger | - | spinner | error with Try Again | no matches |

Fully implemented: 32 of 35 screens. Static: Welcome and Demo Chooser (the way in and the local demo). Settings is mostly device settings (appearance, Face ID, the demo tour), only the mileage rate saves to Firebase, so it is not counted.

## Visual QA

- Web render of the app in a scratch copy outside the repo (react-native-web and react-dom installed
  there only, plus a scratch-only global for the screenshot script), pointed at the fake Firebase server
  (`npm run firebase:fake`, seeded with `npm run firebase:seed -- --url=http://localhost:9000`). Shots
  were taken over the Chrome DevTools protocol.
- Covered: every landlord and tenant screen at 390x844 in light and dark, the busiest screens at 360x640
  and at tablet width (1024, the drawer stays open), the empty landlord (Jamie Ortiz) on every list,
  loading (the fake server's `/__delay`), and error (`/__fail?status=500`) on the Home, a list, a cloud
  screen, and Log In.
- Fixed:
  - Expenses offered to "Upload 1 expense from this phone" for a Firebase landlord, because the phone's
    sample recurring rule still made a local expense. The recurring catch-up is skipped for a Firebase
    landlord now (Recurring is hidden for them anyway).
  - An empty Firebase landlord saw the phone's sample property names (123 Maple St, Unit 1...) as
    filter chips on Documents and Expenses. The local property list leaves out the phone's own orders
    and expenses for a Firebase landlord now.
- Noted, not changed (outside this milestone or the same in the demo):
  - At 360 wide the Expenses quick action "Tax Summary" breaks inside the word. Same in the demo.
  - An empty Documents list says "No documents match" instead of a first-run message. Same in the demo.
  - Year-End Report still has a Receipts section that counts receipt photos, which a Firebase landlord
    can't add until Storage.
- The two journal screenshots (`docs/screenshots/m2-work-orders.png`, `m2-payments.png`) are stand-ins
  from this web render at 390x844, light theme.
