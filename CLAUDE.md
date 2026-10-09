@AGENTS.md
# Rent Well (mobile app)

React Native (Expo) property management app for small landlords (1 to 10 units) who manage rentals on the side. One app, two roles: landlord and tenant. It is Christian's project for his Mobile Development course (IS course, runs through December 2026). The landlord side is built first, the tenant side comes after.

The code so far was written in an earlier chat session and has been run only partly. Expect small bugs. Verify imports, exports, and file names before assuming something works.

## Stack
- Expo, React Native, plain JavaScript (no TypeScript)
- React Navigation native stack, `react-native-safe-area-context`
- AsyncStorage for saving, `expo-image-picker`, `expo-file-system` and `expo-sharing` (CSV export, documents), `expo-document-picker`, `@react-native-community/datetimepicker`, `@expo/vector-icons` (Ionicons)
- Inter fonts from `@expo-google-fonts/inter`, loaded in `App.js`
- Run with `npx expo start -c` (clear the cache after adding or renaming files)

## Layout (project root)
- `App.js`: font loading, `WorkOrdersProvider`, navigator. Header is hidden, every screen draws its own `ScreenTitle`.
- `theme.js`: `COLORS`, `SPACING`, `FONT_SIZES`, `FONTS`
- `context/WorkOrdersContext.js`: all shared data and actions (see below)
- `screens/`: Welcome, Dashboard, WorkOrders, WorkOrderDetail, NewWorkOrder, Expenses, Mileage, YearEndReport, Messages (placeholder), Documents, Checklist (placeholder)
- `components/`: ScreenTitle (shimmer card title), Card, PrimaryButton, WorkOrderCard, ExpenseDetailsModal, AddExpenseModal (full expense form), TripModal, BudgetsModal, RecurringModal, DateField, DemoBanner, DocumentDetailModal, DocumentFormModal
- `utils/`: formatDate.js (formatDate, todayString), dateInput.js, recurring.js (addPeriod), expenseStats.js, exportExpenses.js, documentFiles.js (pick, save, delete, open document files)
- `data/`: workOrders.js, expenses.js, expenseOptions.js, expenseExtras.js, documents.js, documentOptions.js (mock and seed data)

## How the data works
- `WorkOrdersContext` holds orders, expenses, trips, recurring rules, budgets, and the mileage rate. Screens read it with `useWorkOrders()`.
- Orders and expenses are separate lists. An expense links to an order with `work_order_id`. The context builds `order.expenses` (a small legacy shape: id, amount, description, photo_uri) so work order screens keep working.
- Saved to AsyncStorage under `rent_well_work_orders`, `rent_well_expenses`, `rent_well_extras`, `rent_well_documents`. Nothing saves until the first load finishes.
- Demo mode: `startDemo()` resets everything to seed data and turns saving off, `exitDemo()` restores saved data first and then turns demo off. Any future network call must be skipped while `demo_mode` is true.
- Expense fields: id, amount, category (IRS Schedule E style), date (YYYY-MM-DD), property, vendor, payment_method, is_capital, billed_to_tenant, recovered, notes, receipts (array of uris), work_order_id, optional recurring_id and split_group.
- Capital improvements are kept out of the deductible total and category bars on purpose.
- Order fields: id, title, description, property, tenant, status (Open, In Progress, Resolved), priority (Emergency, Normal, Low), created_at, started_at, resolved_at, notes, contractor, estimate, photo (a `{ uri }` object or a require).
- Document fields: id, name, category, property, tenant (optional), stored_name, file_name, mime_type, size, added_at, expires_on (optional, Lease and Addendum only), notes, shared_with_tenant (flag only, nothing reads it yet), sample (true only for seed entries with no file).
- Document files: save only `stored_name`, never a full URI. iOS changes the app container path between launches and updates, so always rebuild the URI with `getDocumentUri` from `utils/documentFiles.js`. Real files live in `documents/` in the document directory, demo files in `demo_documents/` in the cache, which is cleared when a demo starts and exits.

## Code conventions (Christian's)
- Function names in camelCase, variables in snake_case with descriptive names. Components are `function Name(props)` and read `props.something`.
- Comments are casual, first person, short. Keep every existing comment word for word when editing a file.
- Change only what was asked. No extra features, no refactors, no renaming that wasn't requested.
- `StyleSheet.create` goes at the bottom of the file.
- Date text is always YYYY-MM-DD. Money display goes through `formatMoney`.
- No em dashes in any text you write for him.

## Colors rule
All colors must come from `theme.js`. When touching a file, use theme tokens. Never add a new hex value to a component. (`'transparent'` is a keyword and stays inline.)
- Base: `primary`, `background`, `text`, `muted`, `title`, `title_text`
- Actions and states: `success` (green), `action` (blue), `accent` (purple), `highlight` (yellow), `warning` (orange), `danger` (red), `secondary` (grey)
- Text on colored buttons: `text_light`, `text_dark`
- Surfaces: `surface_light`, `toast_background`, `backdrop` (modal overlay), `photo_backdrop`, `shadow`, `shimmer_edge`, `shimmer_peak`
- Priority: `priority_emergency`, `priority_low` (Normal uses `secondary`). Status and priority maps live in `WorkOrderCard.js` and point at these tokens.
- Expense tags: `tag_billed`, `tag_recurring`, `tag_missing_receipt`

## Gotchas
- Metro file names are case sensitive. Past errors came from `FormatDate.js` vs `formatDate.js`, `MilageScreen`, and `BudgetModal`. Check names and import paths after creating files.
- Screen names in `navigate('X')` must match the `Stack.Screen name` in `App.js`.
- `PrimaryButton` accepts `title`, `icon`, `style` (overrides), `text_color`, `onPress`.
- `Card` has `width: '90%'` and `alignSelf: 'center'` may be needed depending on the parent.

## Current status
- Landlord side done: Work Orders (list, filters, search, sort, detail, expenses per order, notes, contractor and estimate, priority, message button), Expenses (totals, categories, vendors, budgets, recurring, split, billback, receipts, mileage log, year-end report, CSV export, undo delete), Documents (per-property storage, add, scan, search, sort, lease expiry tags, detail with image preview, open and share, edit, delete with file), demo mode.
- `NewWorkOrderScreen` (tenant "Report an Issue") was just added. Check that `addWorkOrder` exists in the context, that `App.js` registers `NewWorkOrder`, `WorkOrderDetail`, `Mileage`, and `YearEndReport`, and that `WorkOrderCard` and `WorkOrderDetailScreen` show `order.description`.
- Still placeholders: Messages, Checklist. No tenant dashboard or role routing yet (login goes straight to the landlord Dashboard, and the Dashboard has a temporary "New Work Order" button).

## Course assignment (submitted)
The device audit of `screens/NewWorkOrderScreen.js` is submitted. The submitted state is tagged `assignment-submission`. `NewWorkOrderScreen.js` is no longer frozen. Leave `README.md`, `ASSIGNMENT_NOTES.md`, and the screenshots alone unless Christian asks.

## Refactor (branch `refactor` only)
On the `refactor` branch, the "no refactors, no renaming that wasn't requested" rule is lifted for the approved phases. It still applies on `master` and everywhere else. Never merge into `master` unless Christian says so.
- Goal: professional structure with no change in behavior and no change in how anything looks. Stay in JavaScript, don't change navigation.
- Comments: keep every comment word for word and move it with its code. When copies are merged into shared code, keep one word-for-word copy there, and list every dropped duplicate in the phase report.
- Touch targets: use `hitSlop`, never resize. Chips get vertical hitSlop only (about 8 top and bottom).
- Bugs or UX issues found during the refactor get listed at the end of the phase report, not fixed.
- Ask before installing any package.
- One phase at a time. After each: re-check imports and file name capitalization, bundle check (`npx expo export --platform ios` into a temp folder), lint and tests once they exist, list files created, moved, and changed, give simulator test steps, update this file if the structure changed, then stop for review and a commit.

Phases:
1. Tooling: ESLint via `npx expo lint`, a Prettier config matching the current style, Jest with jest-expo for the pure utils (expenseStats, recurring.addPeriod, formatDate, document helpers). Pure document helpers move to `documentHelpers.js`, and `daysUntil` and `expiryTag` take an optional `today`.
2. Feature folders: `git mv` only, no code changes except import paths. Target: `features/{home,workOrders,tenant,expenses,mileage,documents}` with `screens/`, `components/`, `hooks/`, `utils/` inside, shared pieces in `components/`, `components/ui/`, `utils/`, `data/`, `theme.js`.
3. UI primitives in `components/ui/` (Screen, Chip, ChipRow, SegmentedControl, SearchInput, SummaryCard, Tag, BarRow, SectionHeader, EmptyState, FormField, SettingRow, ModalSheet, ReceiptThumb, MoneyText), swapped in one screen at a time. Chips on screens use `COLORS.muted`, chips in cards and modals use `COLORS.background`. Keyboard behavior stays per screen.
4. Filter, sort, and form hooks (useExpenseFilters, useWorkOrderFilters, useDocumentFilters, form hooks for the big modals).
5. Split the big screens into thin screens plus row and section components, with `React.memo` rows and `useCallback` handlers.
6. Split `WorkOrdersContext` into domain providers plus an app mode provider for demo mode, with `usePersistedState`. Keep `useWorkOrders()` as a compatibility hook until every screen moves, then remove it. Jest tests with mocked AsyncStorage for the old-expense migration and for demo data never being saved over real data.
7. Quality: error boundary at the root, accessibilityRole and accessibilityLabel on every pressable, hitSlop, constants for statuses and priorities, JSDoc on shared component props.

## Parked for later (needs a backend)
Bank feed import and matching, receipt scanning that fills in amount, date, and vendor, rent income and profit per property, depreciation schedules for capital improvements, durable receipt storage, document encryption, cloud storage for documents, tenant access to shared documents, e-signatures.

## Next up
1. Tenant side: tenant home screen, role routing, tenant's own work order list.
2. Messages and Checklist screens.

## Working with Christian
- He is a student learning this. Keep replies short and in bullets, explain the why in a sentence, and don't pad.
- For changes across several files, use plan mode first and wait for approval.
- After editing, re-check imports, exports, and prop names across files.
- Tell him what to run to test, and name the exact files you changed.
- Not tax advice: expense categories follow Schedule E, but he should have an accountant confirm them. The mileage rate is a value he sets himself.