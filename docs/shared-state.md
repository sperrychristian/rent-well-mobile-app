# Work order shared state: who changes it and who shows it

One store, `WorkOrdersProvider` in `context/WorkOrdersContext.js`, wrapped around the whole navigator in `App.js`. In real mode `RemoteWorkOrdersProvider` (inside it) swaps in the server's orders and actions with the same shape. Every screen below reads it through `useWorkOrders()`.

## Screens that change work orders

| Screen | What it changes |
| --- | --- |
| Work Order Detail (landlord) | Start Work, Mark Resolved, priority, notes, contractor and estimate, expenses on the order |
| Report an Issue (`NewWorkOrder`) | adds a request (tenant), or a work order (landlord, real mode) |
| Request Detail (tenant, real mode) | adds photos while the request is Open |

## Screens that show work orders

| Screen | What it shows |
| --- | --- |
| Home (`Dashboard`) | "N open, M in progress" on the Work orders row |
| Tab bar | the Work Orders dot, "N need you" for a screen reader |
| Work Orders | the list with filters, search, sort, and counts |
| Work Order Detail | the order itself |
| Tenant Profile (`TenantDetail`) | open count and the tenant's recent orders |
| My Home (`TenantHome`) | the active request count on the Repairs row |
| Repairs (`MyRequests`) | the tenant's own requests |
| Request Detail | one request with the landlord's notes |
| Past Requests | a former tenant's requests, read only |
| Search | work order results (see Search in `docs/DESIGN.md`) |
| Calendar | work order dates on the month grid |

## Changes in this pass

- Past Requests used to fetch its own copy from the server, and Tenant Profile kept the recent orders from its own fetch. Both read the shared store now.
- `useWorkOrders()` throws a clear error when a screen is outside the provider, instead of failing on `null`.

## How it's proven

- `navigation/sharedState.test.js` renders the real App and navigators: Start Work on the detail updates the list row, the Home subtitle, and the tab badge; a tenant's request shows on the landlord side; switching demo sides keeps one store; Tenant Profile follows a status change; a screen outside the provider throws.
- `features/workOrders/context/remoteWorkOrders.test.js` covers real mode: the change shows on every reader before the server answers, a failed change rolls back everywhere, and a new request from the socket lands in the list and the badge.
