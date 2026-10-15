# Rent Well: NewWorkOrderScreen audit

Mobile Development assignment. I audited the tenant "Report an Issue" screen (`screens/NewWorkOrderScreen.js`) on two device sizes and in two orientations, then fixed what broke.

## Devices tested
- Small phone: iPhone 18 Pro (iOS simulator)
- Tablet: iPad (iOS simulator)
- Portrait and landscape on each

## What I found and fixed

### 1. Safe area insets
The app hides the navigation header, so nothing kept the screen clear of the notch, status bar, or home indicator, and the title was pressed against the top. I used `useSafeAreaInsets` from `react-native-safe-area-context` and added each inset to the screen's normal padding. The top and bottom insets clear the status bar and home indicator, and the left and right insets keep content away from the notch in landscape.

### 2. Keyboard handling
The form was a plain `View`, so the keyboard could cover the Details field and the Submit button with no way to scroll to them. I wrapped the form in a `KeyboardAvoidingView` with a `ScrollView` inside, so the screen makes room for the keyboard and every field can be reached. `keyboardShouldPersistTaps="handled"` lets a tap on a chip or button work on the first try while the keyboard is open.

### 3. Layout with useWindowDimensions
On the iPad the form stretched edge to edge, and in landscape on the iPhone 18 Pro the photo preview took up most of the short screen. I capped the form at 600 wide and centered it so it reads like a phone layout on a tablet. I used `useWindowDimensions` to check whether the screen is wider than it is tall, and in that case the photo preview shrinks from 160 to 120 tall.

### Platform.OS
I used `Platform.OS` for the `KeyboardAvoidingView` behavior. iOS does not resize the app when the keyboard opens, so it needs `padding`, while Android already moves the content up on its own, so the behavior is left unset there (this follows the Expo keyboard handling guide).

### Other changes
Before these three fixes, I made two smaller changes: a first version of the top inset fix for the title, and a fix for the property chip row, which was stretching to fill the spare height and making the chips too tall (setting `flexGrow: 0` on it keeps it only as tall as the chips).

## Screenshots

| Condition | Before | After |
| --- | --- | --- |
| Phone portrait | ![](assignment/screenshots/before/phone-portrait.png) | ![](assignment/screenshots/after/phone-portrait.png) |
| Phone landscape | ![](assignment/screenshots/before/phone-landscape.png) | ![](assignment/screenshots/after/phone-landscape.png) |
| iPad portrait | ![](assignment/screenshots/before/ipad-portrait.png) | ![](assignment/screenshots/after/ipad-portrait.png) |
| iPad landscape | ![](assignment/screenshots/before/ipad-landscape.png) | ![](assignment/screenshots/after/ipad-landscape.png) |

## Run it
```bash
npm install
npx expo start -c
```

## Running against the local backend
The demo works with no backend. Logging in, signing up, messages, and work orders need the API from the `rent-well-api` repo running on your computer.

1. In `rent-well-api`, start Postgres and the server (first time: `npm install`, `cp .env.example .env`, then `npm run migrate` and `npm run seed`):
   ```bash
   docker compose up -d
   npm run dev
   ```
   Check it with `curl http://localhost:4000/health`.
2. In this repo, start the app with `npx expo start -c`.
   - iOS simulator: works as is (`http://localhost:4000`).
   - Android emulator: works as is (`http://10.0.2.2:4000`).
   - Physical phone: open `services/config.js`, set `lan_api_url` to your computer's address, like `'http://192.168.1.20:4000'` (find it with `ipconfig getifaddr en0`). The phone and computer need to be on the same wifi.
3. Log in with a seed account (password `password1234`): `owner@example.com` (landlord), `tenant@example.com` (tenant), `roommate@example.com` (shares Tara's unit), or `former@example.com` (a former tenant, read only). To try tenant sign up, use invite code `WELCOME2`. Run `npm run seed` in the API repo again to reset the seed data.

Tenant management, as the landlord: Dashboard, then Tenants. Tenants are grouped by property and unit, with pending invites (Resend, Revoke) and Past Tenants underneath. Tap a tenant to message, move, assign, or end their tenancy. Properties is in the Tenants header. Changes show up live on other devices signed in to the same account.

As `former@example.com` the home says "No Active Rental" and messages are read-only. If the landlord assigns them to a property again, the normal home comes back without logging out.

What to try once you're signed in:
- As the landlord: Work Orders loads from the server. Pull down to refresh, start or resolve an order, and edit priority, notes, contractor, and estimate on its detail screen. The Dashboard badge counts orders nobody has started.
- As the tenant: My Requests on the home screen lists your requests, and Report an Issue sends one with up to 5 photos. Changes the landlord makes show up live.
- Expenses on work orders still save on the phone only.

If the server stops, the work order list keeps showing the last copy it loaded with a note at the top, and pulling down tries again.

Push notifications need a development build with an EAS project id. In Expo Go or the simulator the app skips push and logs why.

## Payments and rent

A rent ledger for each tenancy, in both roles. Rent Well never takes payments: tenants pay the landlord directly (Zelle, check, and so on) and the app keeps the record.

- **Landlord:**
  - Payments and Rent shows a month at a time: collected against expected, overdue charges, claims to confirm or reject right from the list, and every tenant's balance.
  - A tenant's Rent Ledger has the balance, the next rent, the deposit held, and charges and payments by month. From there the landlord can record a payment or refund, add a charge, set the rent schedule (amount, due day, grace days, late fee, start date), and void with a reason.
  - Payment Record shows a timeline, the receipt photo, and Share Receipt (a text receipt).
  - Payment instructions live on Property Overview.
- **Tenant:**
  - What's due and the next rent date.
  - The landlord's payment instructions, with Copy.
  - "I Paid" sends a claim with an optional receipt photo. It shows "Waiting for confirmation" until the landlord confirms it, or shows the reason if they reject it.
  - History. Former tenants get it read only.
- **Both home screens** show a live line: "1 overdue" or "Rent due Nov 1: $1,450.00".
- **Money** is whole cents everywhere, so there's no float math.

Try it in the demo: as the landlord, open Payments and Rent, confirm Jordan's $75 claim, then open Sam's ledger and record a payment. As the tenant (Sam), tap I Paid. Then switch to the landlord view and confirm it.

Real mode uses the backend's rent ledger (the Rent ledger section of `docs/API.md`). The server works out every status and balance, and the app shows them as is. New rent from a schedule shows up after the server's ledger job runs (hourly, or `npm run ledger:run` in `rent-well-api`).

| Landlord | Rent Ledger | Tenant | Payment Record |
| --- | --- | --- | --- |
| ![Payments](docs/screenshots/payments.png) | ![Rent ledger](docs/screenshots/rent_ledger.png) | ![Tenant payments](docs/screenshots/payments_tenant.png) | ![Payment record](docs/screenshots/payment_record.png) |

## The look

The app uses the Hearth design:
- warm paper and ink with one forest green for actions
- big Fraunces numbers
- hairline rows instead of cards

The full guide is in `docs/DESIGN.md`.

| Landlord home | Tenant home | Work orders | Messages |
| --- | --- | --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Tenant home](docs/screenshots/tenant_home.png) | ![Work orders](docs/screenshots/work_orders.png) | ![Thread](docs/screenshots/thread.png) |

## Navigation (course assignment)

**How to run:** `npm install`, then `npx expo start -c`, and open it in Expo Go or a simulator. With no backend running, tap **Try the Demo**, then **Demo as Landlord** or **Demo as Tenant**. Every screen on that side is reachable by tapping, and the back arrow returns.

**The diagram** (one page, drawn from `navigation/navigationMap.js` with `npm run diagram`):
- image: `assignment/navigation/navigation-diagram.png`
- PDF: `assignment/navigation/navigation-diagram.pdf`
- The diagram has one box per screen and one arrow per navigation. Arrows that pass a param are labeled with its name, and TAB and DRAWER badges mark the future tabs and drawer.
- `ASSIGNMENT_NAV.md` has the full write-up.

**Code:**
- Everything is in one native stack in `App.js`. The header titles and the shared header style are in `navigation/screenOptions.js`.
- Every screen is exported from `screens/index.js`. The files themselves live in `features/<feature>/screens/`.

**Screens** (31). Every param is an id, never an object:

| Header title | Route | Who | Params |
| --- | --- | --- | --- |
| Welcome to Rent Well | `Welcome` | Signed out | none |
| Pick a Demo Role | `DemoChooser` | Signed out | none |
| Log In to Rent Well | `Login` | Signed out | none |
| Landlord Sign Up | `RegisterOwner` | Signed out | none |
| Tenant Sign Up | `RegisterTenant` | Signed out | none |
| Landlord Dashboard | `Dashboard` | Landlord | none |
| All Work Orders | `WorkOrders` | Landlord | `tenantId`, `propertyId` |
| Work Order | `WorkOrderDetail` | Landlord | `workOrderId` |
| Your Tenants | `Tenants` | Landlord | `propertyId` |
| Tenant Profile | `TenantDetail` | Landlord | `tenantId` |
| Lease and Documents | `TenantLease` | Landlord | `tenantId` |
| Your Properties | `Properties` | Landlord | none |
| Property Overview | `PropertyDetail` | Landlord | `propertyId` |
| Invite a New Tenant | `InviteTenant` | Landlord | none |
| Document Storage | `Documents` | Landlord | none |
| Condition Checklists | `Checklist` | Landlord | none |
| Checklist | `ChecklistDetail` | Landlord | `checklistId` |
| Property Expenses | `Expenses` | Landlord | none |
| Mileage Log | `Mileage` | Landlord | none |
| Year-End Tax Report | `YearEndReport` | Landlord | `yearId` |
| My Home | `TenantHome` | Tenant | none |
| My Repair Requests | `MyRequests` | Tenant | none |
| Request | `RequestDetail` | Tenant | `workOrderId` |
| Past Repair Requests | `PastRequests` | Tenant | none |
| Add a Work Order | `NewWorkOrder` | Both | none |
| Message Inbox | `Messages` | Both | none |
| Conversation | `MessageThread` | Both | `conversationId` |
| Payments and Rent | `Payments` | Both | none |
| Rent Ledger | `TenantLedger` | Landlord | `tenancyId` |
| Payment Record | `PaymentDetail` | Both | `paymentId` |
| Settings and Profile | `Settings` | Both | none |

