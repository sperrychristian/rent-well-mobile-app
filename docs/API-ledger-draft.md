# Rent ledger API (DRAFT)

Status: draft. `rent-well-api` has no ledger yet (its migrations end at `009_tenant_management.sql`). The app's real mode calls these endpoints; the demo runs the same rules locally in `features/payments/utils/demoLedger.js`. When the backend is built, it should follow this file and pass the shared vectors in `features/payments/utils/ledgerVectors.js`.

No payment processing. Nothing here moves money. A payment is a record of money that went from tenant to landlord some other way (Zelle, check, cash, and so on).

Same conventions as `docs/API.md`: JSON in camelCase, `Authorization: Bearer <access token>`, errors as `{ error: { code, message, details } }`.

## Money and dates

- Every amount is an integer number of cents (`amountCents: 120000` is $1,200.00). The server rejects anything that isn't a safe integer from 1 to 10,000,000.
- `dueDate`, `paidOn`, and `startDate` are `YYYY-MM-DD` with no time zone. `createdAt`, `voidedAt`, and event `at` are ISO timestamps.

## Shapes

```json
Ledger {
  "tenancyId": "uuid", "tenancyStatus": "active" | "ended",
  "tenantId": "uuid", "tenantName": "Sam Rivera",
  "propertyId": "uuid", "propertyName": "123 Maple St", "unitLabel": "Unit 2",
  "paymentInstructions": "Zelle to ...",
  "schedule": RentSchedule | null,
  "charges": [Charge], "payments": [Payment]
}
RentSchedule { "amountCents": 120000, "dueDay": 1, "graceDays": 5, "lateFeeCents": 5000, "startDate": "2026-08-01" }
Charge {
  "id": "string", "kind": "rent" | "late_fee" | "deposit" | "other", "description": "Rent",
  "amountCents": 120000, "dueDate": "2026-10-01", "createdAt": "...",
  "voidedAt": null | "...", "voidReason": ""
}
Payment {
  "id": "uuid", "amountCents": 120000,
  "method": "bank_transfer" | "zelle" | "venmo" | "check" | "cash" | "other",
  "paidOn": "2026-10-02", "appliesTo": "rent" | "deposit", "isRefund": false,
  "note": "", "receiptKey": null | "uploads/...",
  "status": "pending" | "confirmed" | "rejected" | "voided",
  "source": "owner" | "tenant", "rejectReason": "", "voidReason": "", "createdAt": "...",
  "events": [{ "type": "recorded" | "claimed" | "confirmed" | "rejected" | "voided", "at": "...", "byRole": "owner" | "tenant", "reason": "" }]
}
```

The client derives balances itself (`deriveLedger` in `features/payments/utils/ledgerMath.js`). The server stores charges and payments and creates rent charges and late fees.

## Ledger math (both sides must match)

- Rent charges: one per month from the schedule's start month, on `dueDay` (1 to 28), only when the due date is on or after `startDate` and on or before today. Id `rent-<tenancyId>-<YYYY-MM>`, so a month is never charged twice. A schedule change only adds future months; months already charged keep their amount. Ended tenancies get no new charges.
- Late fees: when `lateFeeCents > 0`, a rent charge that still has money owed more than `graceDays` after its due date gets one late fee, id `late-<chargeId>`, due on `dueDate + graceDays + 1`. Fees never get fees.
- Only `confirmed` payments count. A refund (`isRefund`) counts as negative.
- Allocation is oldest due date first (ties by id). Rent money (`appliesTo: rent`, net of refunds) pays rent, late fees, and other charges. Deposit money pays deposit charges, counting only confirmed non-refund deposit payments, so returning a deposit never makes the deposit owed again.
- Charge status: `voided`, else `paid` (nothing left), else `overdue` (more than `graceDays` past due), else `partial`, else `upcoming` (due after today) or `due`.
- Balance = active non-deposit charges minus net confirmed rent money. Positive is owed, negative is a credit. Deposit held = net confirmed deposit money, never below 0.

## Endpoints

| Method and path | Who | Body | Answer |
| --- | --- | --- | --- |
| `GET /ledgers` | owner: every tenancy on their properties; tenant: their own, current and past | | `{ ledgers: [Ledger] }` |
| `GET /ledgers/:tenancyId` | owner of the property, or that tenant | | `{ ledger }` |
| `PUT /tenancies/:tenancyId/rent-schedule` | owner | `RentSchedule` | `{ ledger }` |
| `POST /tenancies/:tenancyId/charges` | owner | `{ kind, description, amountCents, dueDate }` | `201 { ledger }` |
| `POST /charges/:chargeId/void` | owner | `{ reason }` (3 to 300 chars) | `{ ledger }` |
| `POST /tenancies/:tenancyId/payments` | owner (confirmed right away) or that tenant (a claim, `pending`) | `{ amountCents, method, paidOn, appliesTo, isRefund, note, receiptKey? }` | `201 { ledger }` |
| `GET /payments/:paymentId` | owner or that tenant | | `{ ledger, paymentId }` |
| `POST /payments/:paymentId/confirm` | owner, pending only | | `{ ledger }` |
| `POST /payments/:paymentId/reject` | owner, pending only | `{ reason }` | `{ ledger }` |
| `POST /payments/:paymentId/void` | owner, confirmed only | `{ reason }` | `{ ledger }` |
| `PATCH /properties/:propertyId` | owner | adds `paymentInstructions` (up to 1000 chars) to the existing fields | `{ property }` |

`receiptKey` comes from the existing `POST /uploads/sign` flow.

Rules: `paidOn` can't be after today. A tenant can't set `isRefund` (`400 REFUND_NOT_ALLOWED`). A former tenant can read their ledgers but can't claim (`403 NO_ACTIVE_TENANCY`). Charges and schedules on an ended tenancy return `409 TENANCY_ENDED`.

## Errors

| Code | Status | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | bad field, with `details[].path` |
| `REFUND_NOT_ALLOWED` | 400 | tenant sent `isRefund: true` |
| `NO_ACTIVE_TENANCY` | 403 | former tenant tried to claim |
| `NOT_FOUND` | 404 | unknown id, or not yours |
| `PAYMENT_NOT_PENDING` | 409 | confirm or reject on a non-pending payment, void on a non-confirmed one |
| `PAYMENT_VOIDED` | 409 | void twice |
| `CHARGE_VOIDED` | 409 | void a charge twice |
| `TENANCY_ENDED` | 409 | charge or schedule on an ended tenancy |
| `NO_RENT_SCHEDULE` | 409 | reserved for later |

## Realtime and push

- Socket event `ledger:updated` `{ tenancyId, ledger? }` to the owner's and the tenant's personal rooms after any change. The app swaps in `ledger` when it's there, otherwise it reloads `GET /ledgers/:tenancyId`.
- Push data:
  - `{ type: "payment:claimed", paymentId }` to the owner
  - `{ type: "payment:confirmed" | "payment:rejected", paymentId }` to the tenant
  - `{ type: "ledger:updated", tenancyId }` for new charges
- A tap opens Payment Detail (`paymentId`), or the owner's Rent Ledger (`tenancyId`), or the tenant's Payments screen.
