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
