# Navigation skeleton assignment (draft)

Draft for Christian to rewrite in his own words. Branch: `navigation-assignment` (made from `master`, with `work-orders-api` and `tenant-management` merged in so every screen in the real app is part of the map).

Diagram: `assignment/navigation/navigation-diagram.pdf` (also `.png` and `.svg`). It is drawn from `navigation/navigationMap.js` by `npm run diagram`, so it can't drift from the code.

## 1. Screen list

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

30 screens. "Reached from" lists every screen with an arrow into it, with the id param in brackets. [header] means a header button, [reset] means the history is cleared (log in, log out, exit demo), and [demo] is a demo-only way in (a demo choice or the banner's switch, which also clear the history). "Reachable in" is the `reachable_in` field: the situations that can open the screen without logging in or out or leaving the demo (signed out, owner, tenant, demo owner, demo tenant).

| Route | File | Header title | Role | Status | Params | Reached from | Reachable in | Later |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Welcome | `features/home/screens/WelcomeScreen.js` | Welcome to Rent Well | auth | built | none | Dashboard [reset], TenantHome [reset], Settings [reset] | signed out |  |
| DemoChooser | `features/home/screens/DemoChooserScreen.js` | Pick a Demo Role | auth | built | none | Welcome | signed out |  |
| Login | `features/auth/screens/LoginScreen.js` | Log In to Rent Well | auth | built | none | Welcome, RegisterOwner, RegisterTenant | signed out |  |
| RegisterOwner | `features/auth/screens/RegisterOwnerScreen.js` | Landlord Sign Up | auth | built | none | Welcome, Login | signed out |  |
| RegisterTenant | `features/auth/screens/RegisterTenantScreen.js` | Tenant Sign Up | auth | built | none | Login, RegisterOwner | signed out |  |
| Dashboard | `features/home/screens/DashboardScreen.js` | Landlord Dashboard | owner | built | none | DemoChooser [demo], Login [reset], RegisterOwner [reset], TenantHome [demo] | owner, demo owner | tab (owner) |
| WorkOrders | `features/workOrders/screens/WorkOrdersScreen.js` | All Work Orders | owner | built | tenantId, propertyId | Dashboard, TenantDetail (tenantId), PropertyDetail (propertyId) | owner, demo owner | tab (owner) |
| WorkOrderDetail | `features/workOrders/screens/WorkOrderDetailScreen.js` | Work Order #(short workOrderId) | owner | built | workOrderId | WorkOrders (workOrderId), Expenses (workOrderId) | owner, demo owner |  |
| Tenants | `features/tenants/screens/TenantsScreen.js` | Your Tenants | owner | built | propertyId | Dashboard, PropertyDetail (propertyId) | owner, demo owner | tab (owner) |
| TenantDetail | `features/tenants/screens/TenantDetailScreen.js` | Tenant Profile | owner | built | tenantId | Tenants (tenantId) | owner, demo owner |  |
| TenantLease | `features/tenants/screens/TenantLeaseScreen.js` | Lease and Documents | owner | stub | tenantId | TenantDetail (tenantId) | owner, demo owner |  |
| Properties | `features/tenants/screens/PropertiesScreen.js` | Your Properties | owner | built | none | Tenants | owner, demo owner | drawer (owner) |
| PropertyDetail | `features/tenants/screens/PropertyDetailScreen.js` | Property Overview | owner | stub | propertyId | TenantDetail (propertyId), Properties (propertyId) | owner, demo owner |  |
| InviteTenant | `features/invites/screens/InviteTenantScreen.js` | Invite a New Tenant | owner | built | none | Tenants [header], Messages [header] | owner, demo owner |  |
| Documents | `features/documents/screens/DocumentsScreen.js` | Document Storage | owner | built | none | Dashboard, TenantLease | owner, demo owner | drawer (owner) |
| Checklist | `features/checklist/screens/ChecklistScreen.js` | Condition Checklists | owner | built | none | Dashboard | owner, demo owner | drawer (owner) |
| ChecklistDetail | `features/checklist/screens/ChecklistDetailScreen.js` | Checklist #(short checklistId) | owner | built | checklistId | TenantDetail (checklistId), Checklist (checklistId), ChecklistDetail (checklistId) | owner, demo owner |  |
| Expenses | `features/expenses/screens/ExpensesScreen.js` | Property Expenses | owner | built | none | Dashboard | owner, demo owner | drawer (owner) |
| Mileage | `features/mileage/screens/MileageScreen.js` | Mileage Log | owner | built | none | Expenses, Settings | owner, demo owner |  |
| YearEndReport | `features/expenses/screens/YearEndReportScreen.js` | Year-End Tax Report #(short yearId) | owner | built | yearId | Expenses (yearId) | owner, demo owner |  |
| TenantHome | `features/home/screens/TenantHomeScreen.js` | My Home | tenant | built | none | DemoChooser [demo], Login [reset], RegisterTenant [reset], Dashboard [demo] | tenant, demo tenant | tab (tenant) |
| MyRequests | `features/workOrders/screens/MyRequestsScreen.js` | My Repair Requests | tenant | built | none | TenantHome, NewWorkOrder | tenant, demo tenant | tab (tenant) |
| RequestDetail | `features/workOrders/screens/RequestDetailScreen.js` | Request #(short workOrderId) | tenant | built | workOrderId | MyRequests (workOrderId) | tenant, demo tenant |  |
| PastRequests | `features/tenants/screens/PastRequestsScreen.js` | Past Repair Requests | tenant | built | none | TenantHome | tenant, demo tenant |  |
| NewWorkOrder | `features/workOrders/screens/NewWorkOrderScreen.js` | Add a Work Order | shared | built | none | Dashboard, WorkOrders [header], TenantHome, MyRequests [header] | owner, tenant, demo owner, demo tenant |  |
| Messages | `features/messages/screens/MessagesScreen.js` | Message Inbox | shared | built | none | Dashboard, TenantHome | owner, tenant, demo owner, demo tenant | tab (owner), tab (tenant) |
| MessageThread | `features/messages/screens/MessageThreadScreen.js` | Conversation | shared | built | conversationId | WorkOrders (conversationId), WorkOrderDetail (conversationId), TenantDetail (conversationId), Messages (conversationId) | owner, tenant, demo owner, demo tenant |  |
| Payments | `features/payments/screens/PaymentsScreen.js` | Payments and Rent | shared | stub | none | Dashboard, TenantHome | owner, tenant, demo owner, demo tenant |  |
| PaymentDetail | `features/payments/screens/PaymentDetailScreen.js` | Payment Record #(short paymentId) | shared | stub | paymentId | Payments (paymentId) | owner, tenant, demo owner, demo tenant |  |
| Settings | `features/settings/screens/SettingsScreen.js` | Settings and Profile | shared | stub | none | Dashboard [header], TenantHome [header] | owner, tenant, demo owner, demo tenant | drawer (owner) |

## 2. Requirement checklist

| # | Requirement | How it's met | Files |
| --- | --- | --- | --- |
| 1 | Every screen listed | The tables above and `navigation/navigationMap.js`, which lists all 30 with title, role, feature, params, arrows, and where each one is reachable | `navigation/navigationMap.js` |
| 2 | React Navigation and the native stack installed | `@react-navigation/native` and `@react-navigation/native-stack` were already there. `@react-navigation/elements` is now listed directly for `useHeaderHeight` | `package.json` |
| 3 | One component per screen in its own file in a screens folder | Every screen lives in `features/<feature>/screens/`. The 5 new stubs use Card, PrimaryButton, and theme tokens, say what the real screen will do, and say "Coming soon" | `features/payments/screens/`, `features/settings/screens/`, `features/tenants/screens/PropertyDetailScreen.js`, `features/tenants/screens/TenantLeaseScreen.js` |
| 4 | Every screen registered in a stack in a NavigationContainer with initialRouteName | One `Stack.Navigator` with `initialRouteName={first_route}`. `first_route` is Welcome when signed out, Dashboard for owners and the landlord demo, TenantHome for tenants and the tenant demo, and Login after a session runs out | `App.js` |
| 5 | Every screen reachable and Back works | Every screen has a way in from a button, card, link, or header button. A test walks the map from each of the five starting situations (signed out, owner, tenant, demo landlord, demo tenant) and checks the result against each screen's `reachable_in`. Native stack Back works on every pushed screen; log in, log out, and starting or leaving the demo clear the history on purpose | `navigation/navigationMap.test.js` |
| 6 | One-page diagram | `assignment/navigation/navigation-diagram.pdf` (tabloid landscape, one page) with `.png` and `.svg`. A test fails if the diagram is older than the map | `scripts/buildNavigationDiagram.mjs` |
| T1 | createNativeStackNavigator, Stack.Navigator, Stack.Screen | Used exactly that way | `App.js` |
| T2 | An id param read from route.params and displayed | See section 3 | |
| T3 | Meaningful header titles, one shared style through screenOptions with theme colors | `shared_screen_options` sets the header background, tint, title style, and content background from `theme.js`. Each screen's title comes from the map, and screens whose title depends on a param use the options function form | `navigation/screenOptions.js`, `App.js` |
| T4 | A useful headerRight or headerLeft button | Seven, see section 4 | `navigation/headerButtons.js` |
| T5 | Stack only, future tabs and drawer marked on the diagram | TAB and DRAWER tags on the diagram, from the `future` field in the map | `navigation/navigationMap.js` |

## 3. The id params

Every param in the app is now an id with a name ending in `Id`: `workOrderId`, `conversationId`, `checklistId`, `tenantId`, `propertyId`, `paymentId`, and `yearId` (a year-end report is identified by its tax year). No navigation passes a whole object, and a test searches the source to keep it that way.

The main example:

- Passed: `WorkOrdersScreen.js` calls `props.navigation.navigate('WorkOrderDetail', { workOrderId: item.id })` when a card's Details button is tapped.
- Read: `WorkOrderDetailScreen.js` does `props.route.params.workOrderId` and looks the order up with `getOrder` (in real mode it asks the server when the order isn't loaded yet, the same path push notifications use).
- Shown: the header title is built with the options function form, `({ route }) => ({ title: headerTitle('WorkOrderDetail', route.params) })`, so it reads "Work Order #1" (or the first 8 characters of a server id).

The stub example: `PaymentsScreen.js` calls `navigate('PaymentDetail', { paymentId: payment.id })` and `PaymentDetailScreen.js` reads `props.route.params.paymentId` and shows it in a big "Payment ID" card and in the header ("Payment Record #pay-1001").

Other changes to keep params as ids:

- The Message buttons on work orders used to pass the tenant's name to Messages. They now find the conversation where the tap happens and pass `conversationId` to the thread. With no thread yet, an alert explains it and offers to open Messages.
- Tenant Profile used to pass `search` (a name) to Work Orders. It passes `tenantId`, and Work Orders looks the name up.
- Login used to get `expired` as a param. It reads `session_expired` from the auth context instead.
- The snake_case params (`order_id` and the rest) were renamed to the `Id` style.

## 4. Header buttons

| Screen | Button | What it does | Where |
| --- | --- | --- | --- |
| Landlord Dashboard | gear | Opens Settings and Profile | `SettingsHeaderButton` in `navigation/headerButtons.js` |
| My Home (tenant) | gear | Opens Settings and Profile | `SettingsHeaderButton` |
| All Work Orders | add | Opens the new work order form (local in the demo, the API in real mode, where owners can now add one) | `AddWorkOrderHeaderButton` |
| Your Tenants | person add | Opens Invite a New Tenant | `InviteHeaderButton` |
| Message Inbox | person add (owners and the landlord demo only) | Opens Invite a New Tenant | `InviteHeaderButton` |
| My Repair Requests | add (hidden when the rental has ended) | Opens Report an Issue | `AddRequestHeaderButton` |
| Your Properties | add | Opens the Add Property form on that screen | `PropertiesScreen.js` (set with `navigation.setOptions` because the form lives there) |

Every button uses Ionicons, `COLORS.title`, a hitSlop, and an accessibility label.

## 5. Future tabs and drawer

- Owner tabs: Landlord Dashboard, All Work Orders, Message Inbox, Your Tenants. These are what an owner checks every day.
- Owner drawer: Settings and Profile, Your Properties, Document Storage, Property Expenses, Condition Checklists. These matter but get opened less often, so they don't need a tab.
- Tenant tabs: My Home, My Repair Requests, Message Inbox. A tenant only needs these three.

They're marked with TAB and DRAWER tags on the diagram. The app stays a plain stack for now, as the assignment says.

## 6. Design decisions

- I upgraded the real app instead of building a separate skeleton, so the navigation map describes screens people can actually use.
- The navigation map is the single source of truth. App.js reads the header titles from it, the tests check it against App.js and the code, and the diagram is drawn from it.
- Headers: every screen shows one now, and it blends into the screen background (no shadow, small title, back arrow only). At first the shimmer ScreenTitle card stayed under it as the big title, but that just repeated the header, so the card now only stays as the hero banner on the Landlord Dashboard and My Home. Where the card showed a name (tenant, property, lease, checklist type, the other person in a conversation) that name stays as a plain line.
- The header now covers the notch, so screens dropped their own top padding, and the keyboard lift on forms counts the header's height.
- Titles describe the screen in plain words ("All Work Orders", "Property Expenses") instead of repeating the route name. Screens with an id param add a short id.
- The Dashboard and tenant home scroll now, since the header takes some room and there's a new Payments button.
- The stubs work in the demo too: they read local data or just show the id, and never call the server.
- Log Out stays where it was and also shows in Settings, so nothing moved yet.
- The diagram uses ELK for the layout (right-angle arrows, fewest crossings) and headless Chrome for the PNG and PDF, so nothing heavy had to be installed.

## 7. Demo roles

- "Try the Demo" on Welcome opens Pick a Demo Role, with two cards: Demo as Landlord and Demo as Tenant. Back returns to Welcome. One tap starts the demo on that side and the app opens on its home (Landlord Dashboard or My Home).
- The demo side lives in the local demo state (`demo_role` in `context/WorkOrdersContext.js`, next to `demo_mode`). App.js picks the first screen from it and keys the navigator on it, so starting a side or switching sides rebuilds the stack on that side's home.
- Guarded routes: in the demo, App.js only registers that side's screens (owner screens are left out of the tenant demo and tenant screens out of the landlord demo), so an owner screen can't be opened in the tenant demo even by name. A test checks that the two groups in App.js hold exactly the owner and tenant screens in the map.
- The demo banner has a Switch to Tenant view / Switch to Landlord view button next to Exit Demo Mode. Switching keeps all the demo data.
- Both sides share one copy of the demo data. The demo tenant is Sam Rivera at 123 Maple St, Unit 2, who is already on the sample work orders, checklists, documents, and message threads. A request Sam reports shows up for the landlord as Open, the landlord starting or resolving it changes its status on Sam's My Repair Requests, and Sam's messages land in the landlord's thread with Sam (and the other way around), with the fake reply coming from whoever is on the other side.
- Nothing in either demo side calls the server or reads or saves real account data, and everything resets when the demo exits.

