@AGENTS.md
# Rent Well (mobile app)

React Native (Expo) property management app for small landlords (1 to 10 units) who manage rentals on the side. One app, two roles: landlord and tenant. It is Christian's project for his Mobile Development course (IS course, runs through December 2026). The landlord side is built first, the tenant side comes after.

The code so far was written in an earlier chat session and has been run only partly. Expect small bugs. Verify imports, exports, and file names before assuming something works.

## Stack
- Expo, React Native, plain JavaScript (no TypeScript)
- React Navigation: native stack, bottom tabs, and drawer (`@react-navigation/bottom-tabs`, `@react-navigation/drawer`, with `react-native-gesture-handler` and Reanimated 4, no babel config needed on SDK 57), `react-native-safe-area-context`
- AsyncStorage for saving, `expo-image-picker`, `expo-file-system` and `expo-sharing` (CSV export, documents), `expo-document-picker`, `@react-native-community/datetimepicker`, `@expo/vector-icons` (Ionicons)
- Fraunces and DM Sans from `@expo-google-fonts/fraunces` and `@expo-google-fonts/dm-sans`, loaded in `App.js` behind the splash (Inter and the pixel font are gone)
- `react-native-svg`, `expo-splash-screen` (the splash through its config plugin, held in `App.js` until the fonts load), `expo-status-bar`
- Backend (real mode only): `expo-secure-store` (tokens), `socket.io-client` (realtime), `expo-notifications` (push). The API is the sibling repo `rent-well-api`, contract in `docs/API.md`.
- Run with `npx expo start -c` (clear the cache after adding or renaming files)
- Checks: `npm run lint` (whole project), `npm test` (runs once, `npm run test:watch` to watch), `npm run format:check`. Format with `npx prettier --write <files>`. Prettier keeps quoted keys as written (`quoteProps: preserve`). Lint has 13 known problems in existing code (it was 16, the design pass fixed ScreenTitle's three), listed in the Phase 1 report, left alone during the refactor.

## Layout (project root)
- `App.js`: font loading, then `AuthProvider` > `AccountData` (`WorkOrdersProvider` keyed by the signed-in user id, then `RemoteWorkOrdersProvider`, then `MessagesProvider`, then `TenantsProvider`) > navigator. It waits for the saved session, then starts on the role's home (`Dashboard` for owners, `TenantHome` for tenants), the demo side's home (`Dashboard` or `TenantHome`), `Login` after a session ran out, or `Welcome`. The keyed providers remount the navigator whenever the mode or account changes, and the `NavigationContainer` is also keyed on the demo side (`navigator_key`), so the start screen has to match the mode. In the demo only that side's screens are registered (`shows_owner` and `shows_tenant` wrap the owner and tenant `Stack.Group`s). Every screen shows a header with one shared style (`shared_screen_options`) and its title from the navigation map. The homes open with a greeting and an indigo `SummaryBlock` (the fintech pass), the `ScreenTitle` card is left only on the tenant's "No Active Rental" home, and screens that showed a name in it (tenant, property, lease, checklist type, conversation) keep it as a plain `name_line` text.
- Navigator structure (branch `tabs-drawer`): `GestureHandlerRootView` around everything. The root native stack (with `UNSTABLE_router={hubRouter}`) holds the signed-out screens, `Main` (header off), and every detail screen. `Main` is `MainDrawer` (`backBehavior="history"`, `drawerContent` is `navigation/DrawerContent.js`, permanent at 768 and wider), whose first screen `Tabs` (header off) is `MainTabs` (`backBehavior="firstRoute"`, badges from `navigation/tabBadges.js`). `shows_owner`/`shows_tenant` come from `useAppRole()` in all three navigators, so each role (demo or real) only registers its own screens; signed out registers both. `navigator_key` includes the demo side and the role. One header per screen: tabs and drawer screens use their navigator's header with the menu button, detail screens the stack's.
- `navigation/`: `navigationMap.js` is the single source of truth for screens: route name, header title, role, feature, file, params (all ids ending in `Id`), outgoing edges (`demo: true` for demo-only ones), stub or built, `place` (auth, tab, drawer, or drill) with `nav_label` and `nav_icon` for tabs and drawer items, the `hubs` table (tab order and drawer sections per role, `parentsOf` for the nested names), and `reachable_in` (the situations that can open it: signed_out, owner, tenant, demo_owner, demo_tenant, defined in `situations`). `screenOptions.js` (shared header style, `optionsFor(route)` reads titles from the map, adding a short id where the title depends on a param, plus `shared_tab_options`, `shared_drawer_options`, `tabOptionsFor`, `drawerOptionsFor`), `headerButtons.js` (Settings gear, Add work order, Invite, Add request, `HeaderMenuButton`, `DrawerHeaderLeft`), `hubRouter.js` (wraps a navigate, push, replace, or reset to a tab or drawer name in `Main` and `Tabs`, so every existing call by name works), `DrawerContent.js`, `tabBadges.js`. Tests: `navigationMap.test.js` (App.js and the map match, each screen on the navigator its place says, tab order and drawer contents per role, reachability for all five situations with the tabs and drawer as hubs checked against `reachable_in`, a way back from every screen, the demo chooser and switch edges, the App.js role groups, id params, the diagram is current) and `navigationCalls.test.js` (no navigation call passes an object or a non-id param, every reset goes to a registered screen with no params). `hubRouter.test.js` (the router override, drawer history, badges) and `appNavigation.test.js` (renders the real App in both demo sides: every tab and drawer item, drill-down and back, role switch, one header per screen). Add a screen: register it in `App.js` on the navigator its `place` says, add it to the map with its edges (and to `hubs` for a tab or drawer item), then run `npm run diagram`.
- `scripts/buildAppAssets.mjs` (`npm run assets`): draws the app icon, Android adaptive icon layers, splash image, and favicon (`assets/hearth-*.png`) as a green line house on paper with headless Chrome and points `app.json` at them, colors from `theme.js`.
- `scripts/buildNavigationDiagram.mjs` (`npm run diagram`): draws `assignment/navigation/navigation-diagram.svg/.png/.pdf` and `navigation.mmd` from the map with elkjs and headless Chrome, as swimlanes (signed out, landlord, tenant) with the tab bar and drawer as groups.
- `services/`: `config.js` (API base URL, with the marked spot for the LAN IP on a physical phone), `apiHelpers.js` (pure: `ApiError`, `parseApiError`, `createSingleFlight`, `buildQuery`), `apiClient.js` (client factory: token attach, 401 refresh and retry, single-flight refresh, session events), `api.js` (the shared client plus one function per endpoint: auth, properties, invites, tenants, tenancies, messages, work orders, uploads, push tokens), `attachmentUrls.js` (short-lived download URL cache), `tokenStorage.js` (SecureStore), `socket.js` (one socket, `onSocketEvent` lets other features listen on it), `push.js` (message, work order, and tenancy taps), `navigationRef.js` (navigate from outside screens, `navigateWhenReady` for cold-start push taps). `apiClient.js` emits a `read_only` session event on any `NO_ACTIVE_TENANCY` error.
- `theme.js`: `COLORS`, `SPACING`, `FONT_SIZES`, `FONTS`
- `context/WorkOrdersContext.js`: all shared data and actions (see below)
- `features/`: one folder per feature, each with `screens/`, and `components/` or `utils/` when it has them. Tests sit next to the module they test (`name.test.js`).
  - `payments/`: the rent ledger (branch `payments-ledger-app`). The context `LedgerContext.js` gives `LedgerProvider` and `useLedger()`.
    - Screens: PaymentsScreen (a switch between components OwnerPaymentsView and TenantPaymentsView), TenantLedgerScreen (owner, `tenancyId`), PaymentDetailScreen (`paymentId`, read only for tenants).
    - Components: FormSheet, FormBits (Field, MoneyField, ChipPicker, ReceiptPicker), PaymentFormModal (record, or a tenant's "I Paid" claim), ChargeFormModal, ScheduleFormModal, ReasonModal (reject and void), InstructionsModal, LedgerRows (ChargeRow, PaymentRow, ClaimRow, ProgressBar).
    - Hook: useLedgerReview (confirm, reject, void, with toasts).
    - Utils:
      - ledgerMath.js (pure, integer cents: rent charges, late fees, allocation, `deriveLedger`, `monthSummary`, `syncLedger`)
      - ledgerVectors.js (shared hand-worked vectors)
      - ledgerHelpers.js (pills, labels, `groupByMonth`, form checks, `buildReceiptText`, `upcomingRent`, the home lines)
      - ledgerApi.js (camelCase mapping)
      - demoLedger.js (the demo's version of every action, with the real server's rules and error codes)
      - shareReceipt.js
    - Data: sampleLedger.js (demo only, dated from today).
  - `settings/`: SettingsScreen (stub: profile, mileage rate with a link to the Mileage Log, Log Out)
  - `home/`: WelcomeScreen, DemoChooserScreen (Demo as Landlord or Demo as Tenant, calls `startDemo(role)`), DashboardScreen (owner, with Tenants and Payments buttons), TenantHomeScreen (Messages and Report an Issue cards, or the "No Active Rental" home when the tenant is read-only)
  - `tenants/`: TenantsContext (`useTenants()`), TenantsScreen (by property and unit, pending invites with Resend and Revoke, folded Past Tenants), TenantDetailScreen (contact, current homes, work orders, history, Message, Move, Assign, End), PropertiesScreen (add, edit, delete), PastRequestsScreen (former tenant, read only), PropertyDetailScreen and TenantLeaseScreen (stubs, read `propertyId` and `tenantId`), components PlaceModal (move and assign), EndTenancyModal, PropertyFormModal, utils tenantHelpers.js (pure: API mapping, grouping, active and past, move and assign checks, end date rules, finding the signed Move-In) and demoTenants.js (pure: the demo's version of every action with the server's rules and error codes), data sampleTenants.js (demo only)
  - `auth/`: AuthContext (`useAuth()`: user, role, login, registerOwner, registerTenant, logout, and `homeRouteFor(user)`), hooks/useAppRole.js (the demo side while the demo runs, else the account's role), LoginScreen, RegisterOwnerScreen, RegisterTenantScreen, components AuthLayout, SubmitButton, LogoutButton, utils authValidation.js (pure: email, password, name, invite code checks and `normalizeInviteCode`)
  - `invites/`: InviteTenantScreen (owner: pick or add a property, create an invite, share the code, pending list, reads and writes through `useTenants()` so it works in the demo), utils inviteHelpers.js (pending uses the invite's `status`)
  - `workOrders/`: WorkOrdersScreen, WorkOrderDetailScreen (owner), NewWorkOrderScreen (tenant "Report an Issue"), MyRequestsScreen and RequestDetailScreen (tenant, real mode), WorkOrderCard (also exports `status_colors` and `priority_colors`), context RemoteWorkOrdersProvider and remoteWorkOrdersContext.js, utils workOrderHelpers.js (pure: API to app shape, merge, status moves, photo limits, counts)
  - `expenses/`: ExpensesScreen, YearEndReportScreen, AddExpenseModal (full expense form, also used by the work order screens), ExpenseDetailsModal, RecurringModal, BudgetsModal, utils expenseStats.js and exportExpenses.js
  - `mileage/`: MileageScreen, TripModal (uses expenseStats from expenses)
  - `documents/`: DocumentsScreen, DocumentDetailModal, DocumentFormModal, utils documentFiles.js (pick, save, delete, open document files) and documentHelpers.js (pure helpers: icons, names, sizes, daysUntil and expiryTag with an optional today)
  - `checklist/`: ChecklistScreen (list), ChecklistDetailScreen (rooms and items), components NewChecklistModal, ChecklistItemModal, SignOffModal, NameModal (add room or item), ProgressBar, utils checklistHelpers.js (pure: template copy, move-out from move-in, progress, worse condition, text summary), checklistPhotos.js (save, delete, rebuild photo URIs), exportChecklist.js (share a .txt summary), data checklistTemplates.js and sampleChecklists.js (demo only)
  - `messages/`: MessagesContext (`useMessages()`), MessagesScreen (inbox), MessageThreadScreen, components ConversationRow, MessageBubble, AttachmentImage, ImageViewerModal, UnreadBadge, utils messageHelpers.js (pure: merge and de-dupe, inbox updates from socket events, unread total, seen marker, time labels), data sampleThreads.js (demo only)
- `components/ui/`: the design system primitives (see Design system below)
- `components/` (shared): HeaderIconButton (44pt icon button for headerRight), ScreenTitle (indigo shimmer hero card, only on the tenant's "No Active Rental" home now), Card (the old card, now full width with a top margin and drawn by `ui/Card`, screens bring their own side padding), PrimaryButton (wraps `ui/Button`, plain variant by default), DateField, DemoBanner (Switch to Tenant or Landlord view, and Exit Demo Mode), TextField (label, input, inline error), ErrorState (message and Try Again, for offline or server down), RemoteImage (shows an uploaded photo from its key). `components/ui/Toast.js`: `ToastProvider` at the root, `useToast().show(text, icon)`
- `utils/` (shared): formatDate.js (formatDate, todayString), dateInput.js, recurring.js (addPeriod, used by the context and documents), storageKeys.js (per-account AsyncStorage keys), haptics.js (`hapticSuccess`, only on confirm and save), formatCurrency.js (also `formatCents`, `parseAmountToCents`, `centsToInputText` for whole cents)
- `data/`: workOrders.js, expenses.js, expenseOptions.js, expenseExtras.js, documents.js, documentOptions.js (mock and seed data)

## How the data works
- Two modes, picked at Welcome. Demo is fully local and offline: no network request, no account, sample data, nothing saved. Real mode signs in to the backend for accounts, messages, work orders, tenants, properties, and invites. Expenses, mileage, documents, and checklists are still local in both modes (they move to the server in later phases).
- Accounts: `AuthContext` restores the saved session on launch (signs in with the saved user right away so it works offline, then refreshes in the background). Tokens and the user live in SecureStore, never AsyncStorage. Refresh tokens are single use, so `apiClient.js` shares one in-flight refresh across parallel 401s and saves the new refresh token before retrying. A dead refresh token clears the session and sends the user to Login.
- Tenants: `TenantsProvider` gives one interface (`tenants`, `properties`, `invites`, `refresh`, `fetchTenantDetail`, `addProperty`, `updateProperty`, `deleteProperty`, `createInvite`, `revokeInvite`, `resendInvite`, `assignTenant`, `moveTenancy`, `endTenancy`). Real owners load `GET /tenants`, `GET /properties`, and `GET /invites` together and reload quietly on `tenancy:updated`, a socket reconnect, or after a change. The demo keeps `demo_tenant_data` in `WorkOrdersContext` (set by `startDemo`, cleared by `exitDemo`, never saved) and runs the pure `demoTenants.js` actions on it, so errors read the same as the server's. It isn't keyed, server data is tagged with the account it belongs to instead.
- Rent ledger: `LedgerProvider` (in `App.js` inside `TenantsProvider`) remounts on a mode or account change.
  - Demo: five sample ledgers live in memory, built when the demo starts and shared by both demo sides. Every change runs a pure `demoLedger.js` action and then `syncLedger`, so new rent and late fees appear. They're never saved, and they reset on exit.
  - Real mode: the routes in the Rent ledger section of `docs/API.md` (a copy of `../rent-well-api/API.md`).
    - Loads: owners load `GET /tenants`, then `GET /tenancies/:id/ledger` for each tenancy, plus `GET /ledger/summary`. Tenants load `GET /me/ledger`.
    - The server's statuses and balances are the truth: `fromApiLedger` puts them in `ledger.server`, which `deriveLedger` hands back as is.
    - Every action answers with one row, then that tenancy is refetched.
    - Cache: per account, `rent_well_ledger_cache_<user id>` (version 2).
    - `ledger:updated` refetches the tenancy and any open payment. A reconnect reloads everything.
    - Push taps: `payment:*` opens Payment Record, `ledger:reminder` opens Payments (the owner's Rent Ledger when it's for one tenancy), `ledger:overdue_digest` opens Payments.
  - Payment statuses are the server's: `pending_confirmation` (a claim), `succeeded`, `rejected`, `voided`, and the provider ones `pending`, `processing`, `failed`, `returned`.
  - Charge statuses add `due_soon`.
  - The demo's local math is a port of the server's (`features/payments/utils/ledgerMath.js`), and `backendVectors.js` holds the backend's own test cases, run against it in `backendParity.test.js`.
  - Money is integer cents only, and balances always come from `deriveLedger`. Only confirmed payments count. Claims stay pending until the landlord confirms them.
- Former tenants: for a tenant, `TenantsProvider` reads `GET /me` (`activeTenancies`, `endedTenancies`) and sets `is_read_only` when there's no active one, only once that's confirmed. `tenancy:updated`, a reconnect, or any `NO_ACTIVE_TENANCY` error rechecks it, so the home and the message composer switch live without logging out.
- Messages: `MessagesContext` remounts whenever the mode or user changes. Real mode loads `GET /conversations`, opens one socket (personal room for inbox updates, `conversation:join` while a thread is open, leave on close or background), and registers for push. Demo mode uses `sampleThreads.js` with a fake read receipt and reply. Screens call the same functions in both modes. The demo store keeps its key when the demo switches sides, so both sides share the threads: they're stored from the landlord's side, and the tenant side gets only Sam's thread with the two read times and unread counts swapped (`otherUnreadCount` keeps the tenant's unread). The fake reply comes from whoever is on the other side (`demo_replies` or `demo_landlord_replies`).
- Work orders: in real mode `RemoteWorkOrdersProvider` (keyed by user) loads every page of `GET /work-orders`, shows the cached copy first (`rent_well_work_orders_cache_<user id>`), listens for `workorder:new` and `workorder:updated` (full order, replaced by id), and reloads quietly after a socket reconnect. `useWorkOrders()` returns its value when there is one, which is the local value with orders, properties, and the work order actions swapped for API versions, plus real-mode extras (`is_remote`, `role`, `orders_status`, `orders_error`, `orders_from_cache`, `refreshOrders`, `ensureOrder`, `addOrderPhotos`, `open_count`, `active_count`). Changes show right away and roll back if the request fails, the actions return promises and throw an `ApiError`. Screens check `is_remote` and otherwise behave the same in both modes. API orders are mapped to the local shape by `fromApiWorkOrder` (dates become local YYYY-MM-DD, `created_at_iso` keeps the full time, `photos` is a list of upload keys, `tenant` is `""` when there's none).
- Expenses on server work orders stay local: they're in the account's own expenses list and link by `work_order_id` (the server's UUID), so the detail screen and Add Expense work the same.
- `WorkOrdersContext` holds orders, expenses, trips, recurring rules, budgets, the mileage rate, documents, and checklists. Screens read it with `useWorkOrders()`.
- Orders and expenses are separate lists. An expense links to an order with `work_order_id`. The context builds `order.expenses` (a small legacy shape: id, amount, description, photo_uri) so work order screens keep working.
- Saved to AsyncStorage under `rent_well_work_orders`, `rent_well_expenses`, `rent_well_extras`, `rent_well_documents`, `rent_well_checklists`. In real mode each key gets `_<user id>` added (`storageKey` in `utils/storageKeys.js`) so accounts on a shared phone never see each other's data. With no user (demo, or signed out) the original keys are used, so data saved before accounts existed is still there, untouched. Nothing saves until the load for the current user finishes.
- Demo mode: `startDemo(role)` resets everything to seed data, sets `demo_role` (`owner` or `tenant`), and turns saving off, `switchDemoRole(role)` changes only the side, `exitDemo()` restores saved data first and then turns demo off (and the side back to owner). Any future network call must be skipped while `demo_mode` is true.
- Demo roles: the demo tenant is Sam Rivera at 123 Maple St, Unit 2 (`demo_tenant` in `features/tenants/data/sampleTenants.js`), the landlord Sam talks to is `demo_landlord` in `sampleThreads.js`. Both sides share every list: Sam's reports go into the local orders (property from Sam's active demo tenancy, one local photo), My Repair Requests and Past Repair Requests filter the local orders with `ordersForTenant`, and Sam's rental and read-only state come from the demo tenant data (`TenantsProvider` with `demo_role` tenant). Ending Sam's tenancy on the landlord side turns the tenant side read-only.
- Expense fields: id, amount, category (IRS Schedule E style), date (YYYY-MM-DD), property, vendor, payment_method, is_capital, billed_to_tenant, recovered, notes, receipts (array of uris), work_order_id, optional recurring_id and split_group.
- Capital improvements are kept out of the deductible total and category bars on purpose.
- Order fields: id, title, description, property, tenant, status (Open, In Progress, Resolved), priority (Emergency, Normal, Low), created_at, started_at, resolved_at, notes, contractor, estimate, photo (a `{ uri }` object or a require).
- Document fields: id, name, category, property, tenant (optional), stored_name, file_name, mime_type, size, added_at, expires_on (optional, Lease and Addendum only), notes, shared_with_tenant (flag only, nothing reads it yet), sample (true only for seed entries with no file).
- Checklist fields: id, property, type (Move-In, Move-Out), tenant, created_at, move_in_id (set when a move-out was started from a signed move-in), completed, signed_by, signed_on, rooms. Room: id, name, items. Item: id, name, done, condition (Good, Fair, Poor, or null), note, photos (array of stored names), move_in_condition and move_in_note (copied from the move-in, used for the "changed since move-in" flag).
- Checklists: real data starts empty, the samples only load in demo mode. Signing sets `completed`, which locks rooms and items (the context ignores edits to a completed checklist). Delete still works. Photos follow the document rule: only the stored name is saved, `checklist_photos/` in the document directory, demo photos in `demo_checklist_photos/` in the cache.
- Document files: save only `stored_name`, never a full URI. iOS changes the app container path between launches and updates, so always rebuild the URI with `getDocumentUri` from `features/documents/utils/documentFiles.js`. Real files live in `documents/` in the document directory, demo files in `demo_documents/` in the cache, which is cleared when a demo starts and exits.

## Code conventions (Christian's)
- Function names in camelCase, variables in snake_case with descriptive names. Components are `function Name(props)` and read `props.something`.
- Comments are casual, first person, short. Keep every existing comment word for word when editing a file.
- Change only what was asked. No extra features, no refactors, no renaming that wasn't requested.
- `StyleSheet.create` goes at the bottom of the file.
- Date text is always YYYY-MM-DD. Money on screen goes through `formatCurrency` (`utils/formatCurrency.js`) with `NUMBERS` (tabular digits), or `MoneyText`. `formatMoney` is only for the CSV export now.
- No em dashes in any text you write for him.

## Colors rule
All colors must come from `theme.js`. When touching a file, use theme tokens. Never add a new hex value to a component. (`'transparent'` is a keyword and stays inline.)

The app is light and warm (the Hearth pass, see the Design system section): paper, ink, hairlines, forest green for actions, and terracotta for overdue. `theme.test.js` checks every text and surface pair, every state on its tint, and every fill for WCAG AA, `components/ui/stylePairs.test.js` checks every style block's text and background pair, and `components/ui/hearth.test.js` checks the Hearth pairs. Run them after changing a color.
- Base: `background` (cool gray page), `surface` and `muted` (white cards), `text` and `title` (ink), `text_muted` (slate), `primary` and `cta` (the indigo brand, white text on it), `cta_pressed`, `on_cta`, `on_brand_muted` (quiet text on the indigo card), `brand_tint`, `focus`
- Surfaces and lines: `surface_raised` (rows inside cards, pressed states), `surface_sunken` (text boxes), `border` (hairlines), `border_strong` (outlined buttons and inputs), `on_light` (ink text on yellow or orange)
- States as fills (white text): `success`, `action`/`info`, `accent`, `danger`, `secondary`, plus `warning` and `highlight` (ink text). Green is only for positive money and success, amber only for warnings, red for danger and overdue
- States as text or icons on white or gray: `success_text`, `info_text`, `accent_text`, `warning_text`, `danger_text`
- Soft tints for pills and banners, with the matching `_text` color on them: `success_tint`, `info_tint`, `accent_tint`, `warning_tint`, `danger_tint`, `neutral_tint`, `brand_tint`
- Other: `text_light`, `text_dark`, `surface_light`, `toast_background`, `skeleton`, `skeleton_shine`, `priority_emergency`, `priority_low`, the `tag_` colors, `backdrop`, `photo_backdrop`, `shadow`, `shimmer_edge`, `shimmer_peak`, and `hairline` (the pixel colors are gone with the pixel art)

## Design system: Hearth (branch `hearth-redesign`, full guide in `docs/DESIGN.md`)
- **The look:** warm and quiet, more like an editorial page than a dashboard.
  - Paper background (`#F7F3EC`), ink text (`#2A2520`), muted `#6B6259`, hairlines `#E4DCCF`.
  - Forest green `#2F5D4A` for actions and good news, terracotta `#A8442A` for overdue or urgent, amber `#83560F` for waiting.
  - No cards around lists, no pills, no icon circles. Shadows only on sheets.
  - The token names stayed the same, so old styles picked up the new colors.
- **Fonts:** Fraunces (400, 500) for the wordmark, hero numbers, and names. DM Sans (400, 500, 600) for everything else.
  - `App.js` holds the splash until they load, and the app falls back to the system font if they fail.
  - Inter is gone.
- **Tokens in `theme.js`:**
  - `TYPE`: the old keys, plus `hero` (58), `number` (30), `name`, `empty_title`, `wordmark`.
  - `SPACING` adds `xxxl` (64), and `RADIUS.button` is 26 (every button is a pill).
  - `SIZES` adds `screen_padding` (24), `row_min_height` (64), `row_icon`, `chevron`, `progress`, `header_avatar`. Buttons are 52 tall.
  - `SHADOWS.low` and `medium` are flat.
  - `COLORS.hairline`.
- **Primitives in `components/ui/`:**
  - `Button`: pills. Primary green, secondary see-through with an outline, tertiary green text, destructive terracotta outline.
  - `ListRow` (the Row): 64 tall, a hairline on top, a line under the last one, a 24 green line icon, `subtitle_tone`, and a `detail` node.
  - `StatusLabel`: an icon and colored words. It replaces StatusPill.
  - `SummaryBlock`: the hero amount, no card.
  - `ProgressLine`, `ActionSheet`.
  - `KpiTile`: plain figures.
  - `IconCircle`: now just the line icon.
  - `Avatar`: a hairline ring.
  - `Chip`, `SegmentedControl` (underline tabs), `EmptyState` (a muted line icon, a Fraunces title, a green pill), `Toast` (an ink pill), `Wordmark` (Fraunces and a green line house, `align`), `lineIcon` (filled to outline), `sheet.js` (12 corners), `listStyles.js`, `FadeInView`, `useReduceMotion`, `Skeleton`, `Badge`, `MoneyText`, `CurrencyInput`, `ModalCard`.
  - Removed: FeatureTile, QuickAction, StatTile, Sparkline, the pixel folder and its colors, ScreenTitle, and StatusPill.
- **Homes:** `features/home/components/HomeTopBar` and `HeroNote`.
- **Onboarding** (branch `leases-expenses-onboarding`):
  - `OnboardingCard` is the real-mode landlord's setup checklist on the Dashboard. Its steps come from `features/home/utils/onboarding.js`.
  - "Set the rent" opens `ScheduleFormModal` for the first tenancy with no schedule.
  - Hiding it is saved per account under `rent_well_onboarding_dismissed_<user id>` (`hooks/useOnboardingDismissed.js`).
  - `DemoTourSheet` and `hooks/useDemoTour.js` show four tips the first time someone enters the demo, saved under the device-level key `rent_well_demo_tour_seen`, which is not account data. Settings has a "Take the tour" row in the demo.
  - Every list's EmptyState has a title, a sentence, and one action.
- **Icons:** Ionicons outline only, which a sweep enforces.
- **Brand assets:** `npm run assets` draws the green line house on paper (`assets/hearth-*.png`).
- **Accessibility:**
  - Every pressable has a role.
  - Touch targets are 44 (rows 64).
  - Text is AA (`theme.test.js`, `stylePairs.test.js`, `components/ui/hearth.test.js`).
  - Status is never color only.
  - Hero numbers cap font scaling at 1.2 and shrink to fit.
  - Sheets and toasts check Reduce Motion.
- **Headers** keep one shared style in `navigation/screenOptions.js`: a paper bar with no line or shadow, a DM Sans 600 title, and an ink back chevron.
- **Visual QA:** the demo can be rendered on the web in a scratch copy outside the repo (react-native-web plus small mocks for the native modules). Never add web packages to this repo.

## Gotchas
- Metro file names are case sensitive. Past errors came from `FormatDate.js` vs `formatDate.js`, `MilageScreen`, and `BudgetModal`. Check names and import paths after creating files.
- Screen names in `navigate('X')` must match the `Stack.Screen name` in `App.js`.
- `PrimaryButton` accepts `title`, `icon`, `style` (overrides), `text_color`, `onPress`.
- `Card` has `width: '90%'` and `alignSelf: 'center'` may be needed depending on the parent.

## Current status
- Landlord side done: Work Orders (list, filters, search, sort, detail, expenses per order, notes, contractor and estimate, priority, message button), Expenses (totals, categories, vendors, budgets, recurring, split, billback, receipts, mileage log, year-end report, CSV export, undo delete), Documents (per-property storage, add, scan, search, sort, lease expiry tags, detail with image preview, open and share, edit, delete with file), Checklist (move-in and move-out from built-in templates, done, condition, note, up to 3 photos per item, custom rooms and items, progress per room and overall, move-out from a signed move-in with a "changed since move-in" flag, sign-off that locks it, text summary export), demo mode.
- `NewWorkOrderScreen` (tenant "Report an Issue") was just added. Check that `addWorkOrder` exists in the context, that `App.js` registers `NewWorkOrder`, `WorkOrderDetail`, `Mileage`, and `YearEndReport`, and that `WorkOrderCard` and `WorkOrderDetailScreen` show `order.description`.
- Backend connected: login, owner and tenant sign up, role routing, tenant home, log out, owner invites, messages with realtime, photos, seen receipts, unread badges, and push. Demo mode messages use local sample threads.
- Work orders on the API: owner list with pull to refresh, live updates, cached list when offline, start and resolve, priority, notes, contractor and estimate, photos, open count badge on the Dashboard. Tenant Report an Issue posts to the API (property and unit come from the tenancy, up to 5 photos), My Requests list and detail with live status, landlord notes, and add photos while Open. Push taps open the order (owner) or request (tenant).
- Payments and rent ledger (branch `payments-ledger-app`, not merged): owner Payments and Rent (month, collected against expected, overdue, claims queue, tenants), Rent Ledger (record payment or refund, add charge, rent schedule, void with a reason), Payment Record (timeline, receipt, share), payment instructions on Property Overview, tenant Payments ("I Paid" claims, instructions with Copy, history, read only for former tenants), and live lines on both homes. Full in the demo. Real mode is wired to a draft API the backend doesn't have yet.
- Tenant management: Tenants and Properties screens, tenant detail, move, assign, end with a Move-Out checklist offer, invite revoke and resend, read-only mode for former tenants. Works offline in the demo on sample data, including a past tenant. The tenant detail's open count and recent orders come from `GET /tenants/:id`, and its Work Orders link opens the list searched by name.
- Tabs and drawer (branch `tabs-drawer`, not merged): the structure above, `ASSIGNMENT_STRUCTURE.md` (the short explanation), `ASSIGNMENT_NAV.md` final, and the swimlane diagram.
- Navigation assignment (branch `navigation-assignment`, merged, built from master with `work-orders-api` and `tenant-management` merged in): every screen has a header, all route params are ids, header buttons on the Dashboard, tenant home, Work Orders, Tenants, Messages, My Requests, and Properties, stubs for Payments, Payment Detail, Settings, Property Detail, and Lease, a diagram in `assignment/navigation/`, and the write-up in `ASSIGNMENT_NAV.md`. Owners can add work orders in real mode now (the Work Orders Add button). The duplicate title cards are gone, and the demo has two sides (Pick a Demo Role screen, banner switch, guarded routes, shared demo data).
- Design pass (branch `design-polish`, not merged): navy base with a sunrise amber call to action, rebuilt Welcome, a shared lockup on the chooser and auth screens, dashboards with a summary row and feature grid, pixel art empty states, and generated icons and splash.
- Hearth redesign (branch `hearth-redesign`, built on `payments-ledger-app`, not merged): the warm editorial look above across every screen, both homes rebuilt as a hero number plus rows, the Rent Ledger with a More action sheet, and regenerated icons. Visual only, no route, data, or logic changes.
- Fintech pass (branch `fintech-polish`, built on `design-polish`, not merged): light theme with an indigo brand, the design system above, overview dashboards with a monthly spending sparkline, `formatCurrency` everywhere money shows, segmented controls, tinted pills, `$` money inputs, a slim demo banner, regenerated icons, and the audit in `docs/design-audit.md`.
- The Dashboard still has a temporary "New Work Order" button in the demo (hidden in real mode). Push needs a development build with an EAS project id, it logs and does nothing in Expo Go or the simulator.

## Course assignment (submitted)
The device audit of `screens/NewWorkOrderScreen.js` (now `features/workOrders/screens/`) is submitted. The submitted state is tagged `assignment-submission` (local only), and the pushed final state with the fixed README screenshots is tagged `assignment-final`. `NewWorkOrderScreen.js` is no longer frozen. Leave `README.md`, `ASSIGNMENT_NOTES.md`, and the screenshots alone unless Christian asks.

## Refactor (branch `refactor` only)
On the `refactor` branch, the "no refactors, no renaming that wasn't requested" rule is lifted for the approved phases. It still applies on `master` and everywhere else. Never merge into `master` unless Christian says so.
- Goal: professional structure with no change in behavior and no change in how anything looks. Stay in JavaScript, don't change navigation.
- Comments: keep every comment word for word and move it with its code. When copies are merged into shared code, keep one word-for-word copy there, and list every dropped duplicate in the phase report.
- Touch targets: use `hitSlop`, never resize. Chips get vertical hitSlop only (about 8 top and bottom).
- Bugs or UX issues found during the refactor get listed at the end of the phase report, not fixed.
- Ask before installing any package.
- One phase at a time. After each: re-check imports and file name capitalization, bundle check (`npx expo export --platform ios` into a temp folder), lint and tests once they exist, list files created, moved, and changed, give simulator test steps, update this file if the structure changed, then stop for review and a commit.

Phases:
1. Done. Tooling: ESLint via `npx expo lint`, a Prettier config matching the current style, Jest with jest-expo for the pure utils (expenseStats, recurring.addPeriod, formatDate, document helpers). Pure document helpers move to `documentHelpers.js`, and `daysUntil` and `expiryTag` take an optional `today`.
2. Done. Feature folders with `git mv` only, no code changes except import and require paths. Actual map: `features/{home,workOrders,expenses,mileage,documents,messages,checklist}` (NewWorkOrderScreen went into workOrders instead of a separate tenant folder). Shared pieces stay in `components/`, `utils/`, `data/`, `context/`, `theme.js`. `components/ui/` and feature `hooks/` folders get created when Phases 3 and 4 need them.
3. UI primitives in `components/ui/` (Screen, Chip, ChipRow, SegmentedControl, SearchInput, SummaryCard, Tag, BarRow, SectionHeader, EmptyState, FormField, SettingRow, ModalSheet, ReceiptThumb, MoneyText), swapped in one screen at a time. Chips on screens use `COLORS.muted`, chips in cards and modals use `COLORS.background`. Keyboard behavior stays per screen.
4. Filter, sort, and form hooks (useExpenseFilters, useWorkOrderFilters, useDocumentFilters, form hooks for the big modals).
5. Split the big screens into thin screens plus row and section components, with `React.memo` rows and `useCallback` handlers.
6. Split `WorkOrdersContext` into domain providers plus an app mode provider for demo mode, with `usePersistedState`. Keep `useWorkOrders()` as a compatibility hook until every screen moves, then remove it. Jest tests with mocked AsyncStorage for the old-expense migration and for demo data never being saved over real data.
7. Quality: error boundary at the root, accessibilityRole and accessibilityLabel on every pressable, hitSlop, constants for statuses and priorities, JSDoc on shared component props.

## Parked for later (needs a backend)
Bank feed import and matching, receipt scanning that fills in amount, date, and vendor, rent income and profit per property, depreciation schedules for capital improvements, durable receipt storage, document encryption, cloud storage for documents, tenant access to shared documents, e-signatures.

## Next up
1. Review and merge `tabs-drawer` (tabs and drawer, built: owner tabs Home, Payments, Work Orders, Messages; owner drawer Properties, Tenants, Expenses, Mileage Log, Documents, Checklists, Settings; tenant tabs My Home, Payments, Repairs, Messages; tenant drawer Past Requests, Settings). `leases-expenses-onboarding` is still unmerged and separate.
2. Fill in the stubs: Settings, Property Detail, and Lease.
3. Move expenses, mileage, documents, and checklists to the backend, one at a time.

## Working with Christian
- He is a student learning this. Keep replies short and in bullets, explain the why in a sentence, and don't pad.
- For changes across several files, use plan mode first and wait for approval.
- After editing, re-check imports, exports, and prop names across files.
- Tell him what to run to test, and name the exact files you changed.
- Not tax advice: expense categories follow Schedule E, but he should have an accountant confirm them. The mileage rate is a value he sets himself.