# Progress log, week 10 (branch `week10-work-order-form`)

Assignment 10A: one validated form in the lecture's structure (Input, ExpenseForm, ManageExpense), for
work orders, create and edit.

## Setup

- `week9-shared-state` was not in master yet, so I merged it first (`--no-ff`).
- One test broke on the date, not on the merge: `expensesRealMode.test.js` counted the old phone
  expenses, and the seed water bill rule (`next_date` 2026-11-01) came due on 2026-11-04, adding one.
  The test now pins today to 2026-10-15. The app itself is unchanged.
- `@react-native-community/datetimepicker` was already installed at 9.1.0, which is what
  `npx expo install` picks for SDK 57, so nothing new was added.

## Phase 1: the form

- `components/forms/Input.js`: the lecture's Input (label, style, invalid, textInputConfig) plus
  errorText, counter, helperText, and an accessory slot. `ChoiceChips.js` and `DateInput.js` sit next to it.
- `features/workOrders/utils/workOrderValidation.js`: every rule as a pure function giving back
  `{ isValid, errorText }`, and `validateWorkOrder` checking only the fields the form shows and can change.
- `features/workOrders/components/WorkOrderForm.js`: the lecture's ExpenseForm (inputs, inputChangeHandler,
  submitHandler, the xIsValid booleans, formIsInvalid), with `WorkOrderPlaceFields` and `WorkOrderPhotos`
  split out.
- `NewWorkOrderScreen.js` is now the lecture's ManageExpense: `workOrderId` (optional) means edit. The
  route name stays `NewWorkOrder`, so the header buttons, push taps and the map still find it.
- `updateWorkOrder` added to the local context and to the real-mode provider (optimistic, rolled back by
  `changeOrder` on a failure). `services/api.js` got `updateWorkOrderFields` (one PATCH for priority,
  contractor, estimate), and the owner create now sends contractor and estimate, which the server already
  takes.
- Edit buttons on Work Order Detail and Request Detail, with `EditNote` showing the reason when editing is off.
- Map: `NewWorkOrder` takes `workOrderId`, has `edit_title`, and two new Edit edges. The diagram labels
  a header arrow with an id as "Edit: workOrderId".

## Phase 2: tests

- `workOrderValidation.test.js`: every rule with its message, the limits on both sides, trimming,
  decimals, and the dates (leap days, a day that doesn't exist, past only when creating, one year out).
- `workOrderHelpers.test.js`: `editRuleFor` for both roles and both modes.
- `WorkOrderForm.test.js`: empty submit, each rule past required, typing clears one field, the summary
  line, one onSubmit call with whole cents, Add versus Update with pre-filled values, the read-only
  real-mode edit, the counter turning amber at 450, the picker and typed date, return keys moving focus,
  the dirty flag, and both themes.
- `navigation/workOrderForm.test.js` (the real App): the tenant's request reaches the landlord's list, Home
  count and badge, edits show on the detail, list and the other side, the tenant's edit locks once work
  starts, bad input never reaches the store, and the discard prompt on Cancel and back.
- `NewWorkOrderScreen.test.js` (real mode with the store mocked): a failed save keeps the form and the
  values, a good one goes back with no prompt, and an owner's edit only sends priority, contractor and estimate.
- 623 tests before, 675 after.

## Phase 3: visual QA

- Rendered the form on the web in a scratch copy outside the repo (react-native-web there only), at
  360x640, 390x844 and 820 wide, light and dark: empty, errors, filled, edit, counter near the limit, the
  tenant version, and the real-mode edit with read-only fields.
- Fixed: on the web a text box in a row could be wider than the screen, so `Input` got `minWidth: 0`.
- Fixed: the property chips sat above the Property label, they're under the box now.
- Contrast: every new text and background pair is AA in both themes (`formContrast.test.js`).
- Not fixed: on the web a long description scrolls inside its box instead of growing, phones grow it.

## Phase 4: docs

- `ASSIGNMENT_FORM.md` (what the form collects, the rules with their limits, one state object, add and edit),
  a README section pointing to it, and a Forms section in `docs/DESIGN.md` (Input with the inline error,
  ChoiceChips, DateInput, the counter).
- `ASSIGNMENT_NAV.md`: NewWorkOrder's params, the two new Edit arrows, the two pencil header buttons, and
  the `workOrderId` note. Still 35 screens, so `ASSIGNMENT_STRUCTURE.md` didn't change.
- Sweep for draft, rewrite, own words, for Christian, TODO, FIXME, coming soon and placeholder labels:
  nothing unfinished in any text people read. In code, `draft` is the message composer's variable in
  `MessageThreadScreen.js` (that's its real name, left alone).
