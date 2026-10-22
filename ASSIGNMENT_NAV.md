# Navigation assignment: stack, tabs, and drawer

Branch: `tabs-drawer` (made from `master`). The first part of this assignment (the stack skeleton, id params, headers, and the first diagram) was built on `navigation-assignment` and is merged into `master`. This week added a bottom tab navigator and a drawer on top of that stack. The short explanation of the structure is in `ASSIGNMENT_STRUCTURE.md`.

Diagram: `assignment/navigation/navigation-diagram.pdf` (also `.png` and `.svg`). It is one page with a swimlane per role (signed out, landlord, tenant), the tab bar and drawer drawn as labeled groups, and the id param on every arrow into a detail screen. It is drawn from `navigation/navigationMap.js` by `npm run diagram`, so it can't drift from the code.

## 0. The navigator structure

```
NavigationContainer
  Root native stack (initialRouteName: Welcome, Login, or Main)
    Welcome, Pick a Demo Role, Log In, Landlord Sign Up, Tenant Sign Up
    Main: drawer (initialRouteName: Tabs)
      Tabs: bottom tabs (initialRouteName: the role's home)
        landlord: Home, Payments, Work Orders, Messages
        tenant:   My Home, Payments, Repairs, Messages
      landlord drawer: Properties, Tenants, Leases, Expenses, Mileage Log, Profit, Documents, Checklists, Settings
      tenant drawer:   Past Requests, Settings
    every detail screen (Work Order, Tenant Profile, Property Overview, Rent Ledger, Payment Record,
      Conversation, Add a Work Order, Invite a New Tenant, Checklist, Year-End Tax Report, Request, Lease and Documents)
    sheets over a screen, no route: Set or Edit Lease, Renew Lease, Send Reminder, Tax Summary, and the forms
```

- All three navigators use the dynamic API: `createNativeStackNavigator`, `createDrawerNavigator`, and `createBottomTabNavigator`, with `Navigator` and `Screen` components in `App.js`.
- The drawer also lists the four tabs at the top of the menu (a "Main" section), so a drawer screen can always get back to a tab.
- One header per screen: the root stack draws the header for the signed-out and detail screens and hides it for `Main`, the drawer draws it for drawer screens and hides it for `Tabs`, and the tab navigator draws it for each tab. Tab and drawer headers have a menu button on the left, detail screens keep the stack's back arrow.
- The root stack's router is wrapped by `navigation/hubRouter.js`, so `navigate('Payments')` from a detail screen, a push tap, or a socket handler still lands in the right tab or drawer screen (it pops back to `Main` and opens the screen inside it). No screen had to change how it navigates.
- Back: the tabs use `backBehavior="firstRoute"` (Android back from any tab goes to the home tab, then leaves the app), the drawer uses `backBehavior="history"` (back returns to the section you came from). Picking something from the menu clears that history, so its header shows the menu button; a link inside a section (Expenses to Mileage Log, Tenants to Properties) keeps it, so that screen gets a back arrow instead.
- The drawer swipe only starts within 24 points of the left edge. The iOS back swipe belongs to the root stack's detail screens, which sit above the drawer, so the two gestures never compete (the chat screen is a detail screen too).
- On a screen 768 wide or more (an iPad), the drawer stays open on the side and the menu button hides.
- Badges: an unread count on Messages, a terracotta dot on Payments when anything is overdue, and (landlord) a dot on Work Orders while any order is still Open. Each tab's screen reader label says it, like "Messages, 3 unread".
- The demo and a role change remount the navigator (`navigator_key` includes the demo side and the role), so Switch view and Exit Demo Mode land on the right home with no leftover history.

## 1. Screen list

### Where the screens live

Every screen is its own component in its own file, inside a `screens/` folder for its feature: `features/<feature>/screens/<Name>Screen.js`. For example, `features/workOrders/screens/WorkOrderDetailScreen.js`. Grouping by feature keeps each screen next to its own components and helpers.

Where a screen shows up in the navigators is a separate question from where its file lives: `navigation/navigationMap.js` gives every screen a `place` (`auth`, `tab`, `drawer`, or `drill`), and `App.js` registers it on that navigator. The table below says where each one lives.

There's also a top-level `screens/index.js` that re-exports all 33 screen components from those files, so the whole list is in one `screens` folder. The files didn't move, and `App.js` still imports them from the feature folders, so nothing changed at runtime. `navigation/screensIndex.test.js` checks that `screens/index.js` lists exactly the screens in the navigation map.

### Where the list came from

The project proposal's screen inventory had 12 entries: Login / Role Detection, Owner Dashboard, Tenant Dashboard, Work Orders List, Work Order Detail / New Work Order, Messages (Thread List), Message Thread, Documents, Expenses, Move-In / Move-Out Checklist, Property & Tenant Management, and Profile / Settings.

Building the app showed I needed more than that:

- Login turned into five screens: Welcome (pick demo or account), Pick a Demo Role (landlord or tenant demo), Log In, Landlord Sign Up, and Tenant Sign Up (invite code).
- Work orders split into the owner list and detail, the tenant's own list and detail (My Repair Requests, Request), and one form for new ones.
- Property & Tenant Management turned into Tenants, Tenant Profile, Your Properties, Invite a New Tenant, and Past Repair Requests (for a tenant whose rental ended).
- Expenses grew a Mileage Log and a Year-End Tax Report.
- Checklists have a list and a detail screen.
- New for this assignment (stubs): Payments and Rent, Payment Record, Settings and Profile, Property Overview, and Lease and Documents.

### Audit before the changes (Step 1)

This is how the app looked at the start of the branch, after the two merges. Every screen already existed in its own file in a `screens` folder and was registered in one native stack.

| Route | File | Header title | Reached from | Params it received | Notes |
| --- | --- | --- | --- | --- | --- |
| Welcome | `features/home/screens/WelcomeScreen.js` | none (header hidden) | start, Log Out, Exit Demo | none | |
| Login | `features/auth/screens/LoginScreen.js` | none | Welcome, sign up links | `expired` (not an id) | |
| RegisterOwner | `features/auth/screens/RegisterOwnerScreen.js` | none | Welcome, Login | none | |
| RegisterTenant | `features/auth/screens/RegisterTenantScreen.js` | none | Login, RegisterOwner | none | |
| Dashboard | `features/home/screens/DashboardScreen.js` | none | start (owner, demo), login | none | |
| WorkOrders | `features/workOrders/screens/WorkOrdersScreen.js` | none | Dashboard, Tenant Detail | `search` (a name, not an id) | |
| WorkOrderDetail | `features/workOrders/screens/WorkOrderDetailScreen.js` | none | Work Orders, Expenses, push | `order_id` | id, but not an Id-style name |
| NewWorkOrder | `features/workOrders/screens/NewWorkOrderScreen.js` | none | Dashboard (demo), tenant home, My Requests | none | |
| MyRequests | `features/workOrders/screens/MyRequestsScreen.js` | none | tenant home | none | |
| RequestDetail | `features/workOrders/screens/RequestDetailScreen.js` | none | My Requests, push | `order_id` | |
| Messages | `features/messages/screens/MessagesScreen.js` | none | Dashboard, tenant home, work order Message buttons | `tenant` (a name, not an id) | |
| MessageThread | `features/messages/screens/MessageThreadScreen.js` | none | Messages, Tenant Detail, push | `conversation_id` | |
| InviteTenant | `features/invites/screens/InviteTenantScreen.js` | none | Tenants, Messages | none | |
| Tenants | `features/tenants/screens/TenantsScreen.js` | none | Dashboard, push | none | |
| TenantDetail | `features/tenants/screens/TenantDetailScreen.js` | none | Tenants, push | `tenant_id` | |
| Properties | `features/tenants/screens/PropertiesScreen.js` | none | Tenants | none | |
| PastRequests | `features/tenants/screens/PastRequestsScreen.js` | none | tenant home (no rental) | none | |
| Documents | `features/documents/screens/DocumentsScreen.js` | none | Dashboard | none | |
| Checklist | `features/checklist/screens/ChecklistScreen.js` | none | Dashboard | none | |
| ChecklistDetail | `features/checklist/screens/ChecklistDetailScreen.js` | none | Checklist, itself, Tenant Detail | `checklist_id` | |
| Expenses | `features/expenses/screens/ExpensesScreen.js` | none | Dashboard | none | |
| Mileage | `features/mileage/screens/MileageScreen.js` | none | Expenses | none | |
| YearEndReport | `features/expenses/screens/YearEndReportScreen.js` | none | Expenses | `year` | |
| TenantHome | `features/home/screens/TenantHomeScreen.js` | none | start (tenant), login | none | |

Requirements before the changes:

| Requirement | Before |
| --- | --- |
| Every screen listed | Partly (no list outside the code) |
| React Navigation and native stack installed | Yes |
| One file per screen in a screens folder | Yes |
| Registered in a stack inside a NavigationContainer with initialRouteName | Yes, picked from the saved session |
| Every screen reachable | Yes, but nothing checked it |
| One-page diagram | No |
| An id param read from route.params and shown | Ids were passed (`order_id` and others), but some params were names, and nothing showed an id |
| Meaningful header titles with one shared style | No, `headerShown: false` everywhere |
| A useful header button | No |
| Tabs and drawer marked | No |

### Final screen list (generated from the map)

33 screens. "Lives in" is the navigator that shows the screen, from the map's `place`. "Reached from" lists every screen with an arrow into it, with the id param in brackets. [header] means a header button, [reset] means the history is cleared (log in, log out, exit demo), and [demo] is a demo-only way in. Every tab and drawer screen can also be reached from any other one through the tab bar or the menu. Forms that fit a sheet (Set and Renew Lease, Send Reminder, Tax Summary, and the older ones) open over their screen and have no route.

| Route | Header title | Lives in | Role | Params | Reached from (besides the tab bar and drawer) | File |
| --- | --- | --- | --- | --- | --- | --- |
| Welcome | Welcome to Rent Well | root stack (signed out) | auth | none | Dashboard [reset], TenantHome [reset], Settings [reset] | `features/home/screens/WelcomeScreen.js` |
| DemoChooser | Pick a Demo Role | root stack (signed out) | auth | none | Welcome | `features/home/screens/DemoChooserScreen.js` |
| Login | Log In to Rent Well | root stack (signed out) | auth | none | Welcome, RegisterOwner, RegisterTenant | `features/auth/screens/LoginScreen.js` |
| RegisterOwner | Landlord Sign Up | root stack (signed out) | auth | none | Welcome, Login | `features/auth/screens/RegisterOwnerScreen.js` |
| RegisterTenant | Tenant Sign Up | root stack (signed out) | auth | none | Login, RegisterOwner | `features/auth/screens/RegisterTenantScreen.js` |
| Dashboard | Landlord Dashboard | landlord tab 1 "Home" | owner | none | DemoChooser [demo], Login [reset], RegisterOwner [reset], TenantHome [demo] | `features/home/screens/DashboardScreen.js` |
| WorkOrders | All Work Orders | landlord tab 3 "Work Orders" | owner | tenantId, propertyId | Dashboard, TenantDetail (tenantId), PropertyDetail (propertyId) | `features/workOrders/screens/WorkOrdersScreen.js` |
| WorkOrderDetail | Work Order #(short workOrderId) | root stack (detail, pushes over the tabs) | owner | workOrderId | WorkOrders (workOrderId), Expenses (workOrderId) | `features/workOrders/screens/WorkOrderDetailScreen.js` |
| Tenants | Your Tenants | landlord drawer "Tenants" | owner | propertyId | Dashboard, Leases, PropertyDetail (propertyId) | `features/tenants/screens/TenantsScreen.js` |
| TenantDetail | Tenant Profile | root stack (detail, pushes over the tabs) | owner | tenantId | Tenants (tenantId) | `features/tenants/screens/TenantDetailScreen.js` |
| TenantLease | Lease and Documents | root stack (detail, pushes over the tabs) | owner | tenancyId, tenantId | Dashboard (tenancyId), TenantDetail (tenantId), Leases (tenancyId) | `features/tenants/screens/TenantLeaseScreen.js` |
| Leases | Leases | landlord drawer "Leases" | owner | none | Dashboard | `features/leases/screens/LeasesScreen.js` |
| Properties | Your Properties | landlord drawer "Properties" | owner | none | Dashboard, Tenants | `features/tenants/screens/PropertiesScreen.js` |
| PropertyDetail | Property Overview (stub) | root stack (detail, pushes over the tabs) | owner | propertyId | TenantDetail (propertyId), Properties (propertyId) | `features/tenants/screens/PropertyDetailScreen.js` |
| InviteTenant | Invite a New Tenant | root stack (detail, pushes over the tabs) | owner | none | Dashboard, Tenants [header], Messages [header] | `features/invites/screens/InviteTenantScreen.js` |
| Documents | Document Storage | landlord drawer "Documents" | owner | none | Dashboard, TenantLease | `features/documents/screens/DocumentsScreen.js` |
| Checklist | Condition Checklists | landlord drawer "Checklists" | owner | none | Dashboard | `features/checklist/screens/ChecklistScreen.js` |
| ChecklistDetail | Checklist #(short checklistId) | root stack (detail, pushes over the tabs) | owner | checklistId | TenantDetail (checklistId), Checklist (checklistId), ChecklistDetail (checklistId) | `features/checklist/screens/ChecklistDetailScreen.js` |
| Expenses | Property Expenses | landlord drawer "Expenses" | owner | none | Dashboard | `features/expenses/screens/ExpensesScreen.js` |
| Profit | Profit | landlord drawer "Profit" | owner | none | Dashboard | `features/profit/screens/ProfitScreen.js` |
| Mileage | Mileage Log | landlord drawer "Mileage Log" | owner | none | Expenses, Settings | `features/mileage/screens/MileageScreen.js` |
| YearEndReport | Year-End Tax Report #(short yearId) | root stack (detail, pushes over the tabs) | owner | yearId | Expenses (yearId) | `features/expenses/screens/YearEndReportScreen.js` |
| TenantHome | My Home | tenant tab 1 "My Home" | tenant | none | DemoChooser [demo], Login [reset], RegisterTenant [reset], Dashboard [demo] | `features/home/screens/TenantHomeScreen.js` |
| MyRequests | My Repair Requests | tenant tab 3 "Repairs" | tenant | none | TenantHome, NewWorkOrder | `features/workOrders/screens/MyRequestsScreen.js` |
| RequestDetail | Request #(short workOrderId) | root stack (detail, pushes over the tabs) | tenant | workOrderId | MyRequests (workOrderId) | `features/workOrders/screens/RequestDetailScreen.js` |
| PastRequests | Past Repair Requests | tenant drawer "Past Requests" | tenant | none | TenantHome | `features/tenants/screens/PastRequestsScreen.js` |
| NewWorkOrder | Add a Work Order | root stack (detail, pushes over the tabs) | shared | none | Dashboard, WorkOrders [header], TenantHome, MyRequests [header] | `features/workOrders/screens/NewWorkOrderScreen.js` |
| Messages | Message Inbox | landlord tab 4 "Messages", tenant tab 4 "Messages" | shared | none | Dashboard, TenantHome | `features/messages/screens/MessagesScreen.js` |
| MessageThread | Conversation | root stack (detail, pushes over the tabs) | shared | conversationId | WorkOrders (conversationId), WorkOrderDetail (conversationId), TenantDetail (conversationId), Messages (conversationId) | `features/messages/screens/MessageThreadScreen.js` |
| Payments | Payments and Rent | landlord tab 2 "Payments", tenant tab 2 "Payments" | shared | none | Dashboard, TenantHome, MessageThread | `features/payments/screens/PaymentsScreen.js` |
| TenantLedger | Rent Ledger | root stack (detail, pushes over the tabs) | owner | tenancyId | TenantDetail (tenancyId), Payments (tenancyId), PaymentDetail (tenancyId) | `features/payments/screens/TenantLedgerScreen.js` |
| PaymentDetail | Payment Record #(short paymentId) | root stack (detail, pushes over the tabs) | shared | paymentId | Payments (paymentId), TenantLedger (paymentId) | `features/payments/screens/PaymentDetailScreen.js` |
| Settings | Settings and Profile (stub) | landlord drawer "Settings", tenant drawer "Settings" | shared | none | Dashboard [header], TenantHome [header] | `features/settings/screens/SettingsScreen.js` |

## 2. Requirement checklist

| # | Requirement | How it's met | Files |
| --- | --- | --- | --- |
| 1 | Every screen listed | The tables above and `navigation/navigationMap.js`, which lists all 33 with title, role, feature, params, arrows, and where each one is reachable | `navigation/navigationMap.js` |
| 2 | React Navigation and the native stack installed | `@react-navigation/native` and `@react-navigation/native-stack` were already there. `@react-navigation/elements` is now listed directly for `useHeaderHeight` | `package.json` |
| 3 | One component per screen in its own file in a screens folder | Every screen lives in `features/<feature>/screens/`. The 5 new stubs use Card, PrimaryButton, and theme tokens, say what the real screen will do, and say "Coming soon". Later, the payments work turned Payments and Rent and Payment Record into real screens and added Rent Ledger | `features/payments/screens/`, `features/settings/screens/`, `features/tenants/screens/PropertyDetailScreen.js`, `features/tenants/screens/TenantLeaseScreen.js` |
| 4 | Every screen registered in a NavigationContainer with initialRouteName | The root `Stack.Navigator` starts on Welcome, Login (after a session runs out), or `Main`. The drawer's `initialRouteName` is `Tabs`, and the tabs start on the role's home (Dashboard or TenantHome) | `App.js` |
| 5 | Every screen reachable and Back works | A test walks the map from each of the five starting situations (signed out, owner, tenant, demo landlord, demo tenant), counting the tab bar and drawer as hubs, and checks the result against each screen's `reachable_in`. Another checks that from every screen a situation reaches there's a way back to where it started. Render tests press every tab and drawer item, drill into a detail screen and go back, and check one header on each screen | `navigation/navigationMap.test.js`, `navigation/appNavigation.test.js` |
| 6 | One-page diagram | `assignment/navigation/navigation-diagram.pdf` (tabloid landscape, one page, swimlanes by role) with `.png` and `.svg`. A test fails if the diagram is older than the map | `scripts/buildNavigationDiagram.mjs` |
| T1 | Dynamic component API | `createNativeStackNavigator`, `createDrawerNavigator`, and `createBottomTabNavigator`, each used as `Navigator` and `Screen` components | `App.js` |
| T2 | An id param read from route.params and displayed | See section 3 | |
| T3 | Meaningful header titles, one shared style through screenOptions with theme colors | `shared_screen_options` (stack), `shared_tab_options` (tab bar and tab headers), and `shared_drawer_options` (drawer and drawer headers) all take their colors, fonts, and sizes from `theme.js`. Each screen's title comes from the map, and screens whose title depends on a param use the options function form | `navigation/screenOptions.js`, `App.js` |
| T4 | A useful headerRight or headerLeft button | Eight on the right and the menu button on the left, see section 4 | `navigation/headerButtons.js` |
| T5 | A tab navigator, a drawer, or both, with titles and icons | Both. Every tab and drawer item has a short label and an outline icon from the map (`nav_label`, `nav_icon`), see section 5 | `App.js`, `navigation/DrawerContent.js` |
| T6 | Drill-down screens keep working, no duplicate headers, Back as expected | Detail screens live in the root stack and push over the tabs and drawer, see section 0 | `App.js`, `navigation/hubRouter.js` |
| T7 | A short explanation of the structure | `ASSIGNMENT_STRUCTURE.md` | |

## 3. The id params

Every param in the app is now an id with a name ending in `Id`: `workOrderId`, `conversationId`, `checklistId`, `tenantId`, `propertyId`, `paymentId`, `tenancyId` (added with the rent ledger), and `yearId` (a year-end report is identified by its tax year). No navigation passes a whole object, and a test searches the source to keep it that way.

The main example:

- Passed: `WorkOrdersScreen.js` calls `props.navigation.navigate('WorkOrderDetail', { workOrderId: item.id })` when a card's Details button is tapped.
- Read: `WorkOrderDetailScreen.js` does `props.route.params.workOrderId` and looks the order up with `getOrder` (in real mode it asks the server when the order isn't loaded yet, the same path push notifications use).
- Shown: the header title is built with the options function form, `({ route }) => ({ title: headerTitle('WorkOrderDetail', route.params) })`, so it reads "Work Order #1" (or the first 8 characters of a server id).

The stub example (now a real screen): `PaymentsScreen.js` calls `navigate('PaymentDetail', { paymentId: payment.id })` and `PaymentDetailScreen.js` reads `props.route.params.paymentId`, shows it in the header ("Payment Record #demo-pay"), and looks the payment up in the ledger store (or asks the server, for a push tap). The rent ledger added one more: a tenant row on Payments and the Rent Ledger link on Tenant Profile pass `tenancyId` to `TenantLedgerScreen.js`.

Other changes to keep params as ids:

- The Message buttons on work orders used to pass the tenant's name to Messages. They now find the conversation where the tap happens and pass `conversationId` to the thread. With no thread yet, an alert explains it and offers to open Messages.
- Tenant Profile used to pass `search` (a name) to Work Orders. It passes `tenantId`, and Work Orders looks the name up.
- Login used to get `expired` as a param. It reads `session_expired` from the auth context instead.
- The snake_case params (`order_id` and the rest) were renamed to the `Id` style.

## 4. Header buttons

| Screen | Button | What it does | Where |
| --- | --- | --- | --- |
| Every tab and drawer screen (left) | menu | Opens the drawer (hidden on an iPad, where the drawer stays open) | `HeaderMenuButton` in `navigation/headerButtons.js` |
| A drawer screen opened by a link from another section (left) | back arrow | Goes back to that section | `DrawerHeaderLeft` |
| Landlord Dashboard | gear | Opens Settings and Profile | `SettingsHeaderButton` in `navigation/headerButtons.js` |
| My Home (tenant) | gear | Opens Settings and Profile | `SettingsHeaderButton` |
| All Work Orders | add | Opens the new work order form (local in the demo, the API in real mode, where owners can now add one) | `AddWorkOrderHeaderButton` |
| Your Tenants | person add | Opens Invite a New Tenant | `InviteHeaderButton` |
| Message Inbox | person add (owners and the landlord demo only) | Opens Invite a New Tenant | `InviteHeaderButton` |
| My Repair Requests | add (hidden when the rental has ended) | Opens Report an Issue | `AddRequestHeaderButton` |
| Your Properties | add | Opens the Add Property form on that screen | `PropertiesScreen.js` (set with `navigation.setOptions` because the form lives there) |
| Rent Ledger | add | Opens the Record Payment form on that screen | `TenantLedgerScreen.js` (set with `navigation.setOptions`, like Properties) |
| Rent Ledger | more | Opens the More sheet: Send Reminder, Add Charge, the rent schedule, and Void | `TenantLedgerScreen.js` |

Every button uses Ionicons, `COLORS.title`, a hitSlop, and an accessibility label.

## 5. Tabs and drawer

| Role | Tabs (bottom, in order) | Drawer (menu) |
| --- | --- | --- |
| Landlord | Home (Landlord Dashboard), Payments (Payments and Rent), Work Orders (All Work Orders), Messages (Message Inbox) | Rentals: Properties, Tenants, Leases. Money: Expenses, Mileage Log, Profit. Records: Documents, Checklists. Account: Settings |
| Tenant | My Home, Payments, Repairs (My Repair Requests), Messages | Repairs: Past Requests. Account: Settings |

- The tabs are what each role opens most days. The drawer holds what they open now and then. Last week's plan had Tenants as a landlord tab; Payments took that spot because rent is the thing a landlord checks most, and Tenants moved into the drawer next to Properties.
- Leases and Profit (added after the tabs went in) are drawer sections, not tabs: a landlord checks them now and then, and the tab bar stays at four. Leases sits with Properties and Tenants under Rentals, Profit with Expenses and the Mileage Log under Money. Tenants see their own lease on My Home, so they have no new drawer item.
- The tenant drawer only has what a tenant can reach today (Past Requests and Settings). Tenants don't have Documents or Checklists yet, so those aren't in it.
- Labels are short so four fit on a small phone ("Repairs" instead of "My Repair Requests"). The header still shows the full title.
- The drawer's top section repeats the four tabs, so a drawer screen like Settings can get back to a tab without the hardware back button.

## 6. Design decisions

- I upgraded the real app instead of building a separate skeleton, so the navigation map describes screens people can actually use.
- The navigation map is the single source of truth. App.js reads the header titles from it, the tests check it against App.js and the code, and the diagram is drawn from it.
- Headers: every screen shows one now, and it blends into the screen background (no shadow, small title, back arrow only). At first the shimmer ScreenTitle card stayed under it as the big title, but that just repeated the header, so the card now only stays as the hero banner on the Landlord Dashboard and My Home. Where the card showed a name (tenant, property, lease, checklist type, the other person in a conversation) that name stays as a plain line.
- The header now covers the notch, so screens dropped their own top padding, and the keyboard lift on forms counts the header's height.
- Titles describe the screen in plain words ("All Work Orders", "Property Expenses") instead of repeating the route name. Screens with an id param add a short id.
- The Dashboard and tenant home scroll now, since the header takes some room and there's a new Payments button.
- The stubs work in the demo too: they read local data or just show the id, and never call the server.
- Log Out stays where it was and also shows in Settings.
- With the tabs and drawer, the home screens kept their rows to other sections (a tab or drawer screen is one tap away either way), so nothing on a screen had to change.
- The diagram uses ELK for the layout (right-angle arrows, fewest crossings) and headless Chrome for the PNG and PDF, so nothing heavy had to be installed.

## 7. Demo roles

- "Try the Demo" on Welcome opens Pick a Demo Role, with two cards: Demo as Landlord and Demo as Tenant. Back returns to Welcome. One tap starts the demo on that side and the app opens on its home (Landlord Dashboard or My Home).
- The demo side lives in the local demo state (`demo_role` in `context/WorkOrdersContext.js`, next to `demo_mode`). App.js picks the first screen from it and keys the navigator on it, so starting a side or switching sides rebuilds the stack, drawer, and tabs on that side's home.
- Guarded routes: App.js only registers the current side's screens in all three navigators (owner screens are left out for a tenant and tenant screens for an owner, in the demo and for real accounts), so an owner screen can't be opened by a tenant even by name. A test checks that the guarded blocks in App.js hold exactly the owner and tenant screens in the map.
- The demo banner has a Switch to Tenant view / Switch to Landlord view button next to Exit Demo Mode. Switching keeps all the demo data.
- Both sides share one copy of the demo data. The demo tenant is Sam Rivera at 123 Maple St, Unit 2, who is already on the sample work orders, checklists, documents, and message threads. A request Sam reports shows up for the landlord as Open, the landlord starting or resolving it changes its status on Sam's My Repair Requests, and Sam's messages land in the landlord's thread with Sam (and the other way around), with the fake reply coming from whoever is on the other side.
- Nothing in either demo side calls the server or reads or saves real account data, and everything resets when the demo exits.

