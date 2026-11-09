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
