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
