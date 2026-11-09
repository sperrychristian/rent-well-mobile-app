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
