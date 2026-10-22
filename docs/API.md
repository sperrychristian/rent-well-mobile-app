# Rent Well API Reference

This is the contract for the Rent Well mobile app. Every route, request and response shape, socket
event, and error code below matches the server exactly. If the server changes, this file changes in
the same commit.

- [Conventions](#conventions)
- [Errors](#errors)
- [Shared objects](#shared-objects)
- [Health](#health)
- [Auth](#auth)
- [Properties (owner only)](#properties-owner-only)
- [Invites (owner only)](#invites-owner-only)
- [Tenants (owner only)](#tenants-owner-only)
- [Tenancies (owner only)](#tenancies-owner-only)
- [Former tenants (read-only mode)](#former-tenants-read-only-mode)
- [Conversations and messages](#conversations-and-messages)
- [Work orders](#work-orders)
- [Rent ledger](#rent-ledger)
- [Leases (owner only)](#leases-owner-only)
- [Expenses (owner only)](#expenses-owner-only)
- [Reports (owner only)](#reports-owner-only)
- [Rent reminders (owner only)](#rent-reminders-owner-only)
- [Uploads (image attachments)](#uploads-image-attachments)
- [Push tokens](#push-tokens)
- [Socket.IO](#socketio)
- [Error code index](#error-code-index)

---

## Conventions

- **Base URL (dev):** `http://<host>:4000`. On a physical phone use your computer's LAN IP, not
  `localhost`.
- **JSON everywhere.** Send `Content-Type: application/json`. Request and response keys are
  **camelCase**. JSON request bodies are limited to 100 KB.
- **Auth:** protected routes need `Authorization: Bearer <accessToken>`.
- **IDs** are UUID strings.
- **Timestamps** are ISO 8601 strings in UTC with milliseconds, e.g. `"2026-10-11T23:12:27.844Z"`.
  Nullable timestamps are `null`, never missing.
- **Roles:** every user is either `"owner"` or `"tenant"`.
- **Money:** the [rent ledger](#rent-ledger) uses **integer cents** everywhere (fields end in
  `Cents`, e.g. `amountCents: 120000` = $1,200.00). The older work order `estimate` field is
  the exception: it's dollars with decimals. See [Money, dates, and the append-only
  rule](#money-dates-and-the-append-only-rule).
- **Scoping:** every list and lookup only returns data the signed-in user is part of. Anything that
  belongs to someone else returns `404 NOT_FOUND` (the same response as an id that doesn't exist).
  A route that requires a different role returns `403 FORBIDDEN`.
- **Notation:** in examples, `{ "...Message" }` means "a full [Message](#message) object here"
  (same for User, Property, Invite, Tenancy, Conversation, WorkOrder, and the ledger objects). It
  is not literal JSON.
- **Token lifetimes:** access token 15 minutes, refresh token 30 days. Refresh tokens are
  single use. See [POST /auth/refresh](#post-authrefresh).

---

## Errors

Every error response (4xx and 5xx, except `/health`) has this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request is invalid",
    "details": [
      {
        "location": "body",
        "path": "password",
        "message": "Password must be at least 10 characters"
      }
    ]
  }
}
```

| Field           | Type            | Notes                                                                                                                                       |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `error.code`    | string          | Stable, machine-readable. Branch on this, not on `message`.                                                                                 |
| `error.message` | string          | Human-readable. Fine to log; not localized.                                                                                                 |
| `error.details` | array \| object | **Only present for `VALIDATION_ERROR`** (an array, one entry per invalid field) **and `REMINDER_TOO_SOON`** (an object, `{ "canSendAt" }`). |

`details[]` entries:

| Field      | Type   | Notes                                                                      |
| ---------- | ------ | -------------------------------------------------------------------------- |
| `location` | string | `"body"`, `"query"`, or `"params"`                                         |
| `path`     | string | Dot path to the field, e.g. `"password"`. `""` if the whole part is wrong. |
| `message`  | string | What's wrong with it                                                       |

The full list of codes is in the [Error code index](#error-code-index).

---

## Shared objects

### User

```json
{
  "id": "4bdab3eb-e9cd-4b13-9854-c1e43f482553",
  "email": "tara@example.com",
  "name": "Tara Tenant",
  "role": "tenant",
  "createdAt": "2026-10-11T23:12:27.776Z"
}
```

### Session

Returned by register, login, and refresh.

```json
{
  "user": { "...User" },
  "tokens": {
    "accessToken": "eyJhbGciOi...",
    "accessTokenExpiresAt": "2026-10-11T23:27:27.000Z",
    "refreshToken": "kq3v...base64url, 64 chars",
    "refreshTokenExpiresAt": "2026-11-10T23:12:27.000Z"
  }
}
```

### Property

```json
{
  "id": "uuid",
  "name": "Maple Court",
  "address": "12 Maple St, Springfield",
  "paymentInstructions": "Zelle to owner@example.com or Venmo @olivia-rents",
  "timeZone": "America/Denver",
  "createdAt": "2026-10-11T23:12:27.776Z",
  "updatedAt": "2026-10-12T09:30:00.000Z",
  "tenancies": [
    {
      "id": "uuid",
      "unitLabel": "Unit 2B",
      "status": "active",
      "startedAt": "2026-10-11T23:12:27.776Z",
      "tenant": { "id": "uuid", "name": "Tara Tenant", "email": "tara@example.com" }
    }
  ]
}
```

- `tenancies` lists the **current residents only** (`status` is always `"active"` here), oldest
  first. Two tenancies can share a `unitLabel` (roommates). Past residents are in
  [GET /tenants](#get-tenants).
- `unitLabel` can be `null`.
- `updatedAt` changes on [PATCH /properties/:id](#patch-propertiesid). It starts equal to `createdAt`.
- `paymentInstructions` (string or `null`) is shown to tenants on their ledger, e.g. how to pay.
- `timeZone` is an IANA name (default `"UTC"`). It decides what "today" is for the ledgers at this
  property (what's due and what's overdue).

### Invite

```json
{
  "id": "uuid",
  "code": "K7M2QX9P",
  "propertyId": "uuid",
  "unitLabel": "Unit 2B",
  "tenantName": "Tara Tenant",
  "status": "pending",
  "expiresAt": "2026-10-18T23:12:27.776Z",
  "usedAt": null,
  "revokedAt": null,
  "createdAt": "2026-10-11T23:12:27.776Z"
}
```

`code` is 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L). `unitLabel` can be
`null`. Invites expire 7 days after creation and can be used once.

`status` is computed from the dates, checked in this order:

| `status`    | Meaning                                                                    |
| ----------- | -------------------------------------------------------------------------- |
| `"used"`    | A tenant signed up with it (`usedAt` set)                                  |
| `"revoked"` | The owner revoked it, resent it, or deleted its property (`revokedAt` set) |
| `"expired"` | `expiresAt` has passed                                                     |
| `"pending"` | Still usable                                                               |

### Tenancy

One tenant living at one property (and optionally one unit) for a period of time. Tenancy rows are
never deleted. Ending one sets `status` to `"ended"`.

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "property": { "id": "uuid", "name": "Maple Court", "address": "12 Maple St, Springfield" },
  "unitLabel": "Unit 2B",
  "status": "ended",
  "startedAt": "2025-09-01T15:04:05.000Z",
  "endedAt": "2026-10-31",
  "moveOutNote": "Carpet cleaning deducted from deposit",
  "lease": {
    "leaseStartOn": "2025-11-01",
    "leaseEndOn": "2026-10-31",
    "leaseTerm": "fixed",
    "renewalNoticeDays": 60,
    "daysRemaining": 16,
    "leaseStatus": "expiring_soon",
    "leaseNotes": "Renewal offered at $1,500"
  }
}
```

| Field         | Type           | Notes                                                                                             |
| ------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| `status`      | string         | `"active"` or `"ended"`                                                                           |
| `startedAt`   | string         | Full ISO timestamp                                                                                |
| `endedAt`     | string \| null | **A calendar date, `YYYY-MM-DD`** (not a timestamp). `null` while active.                         |
| `unitLabel`   | string \| null |                                                                                                   |
| `moveOutNote` | string \| null | **Owner only.** The key is absent in every tenant copy (`GET /me`, socket events).                |
| `lease`       | object         | The [lease block](#lease-block). Always present, `leaseStatus: "none"` when no lease is recorded. |

#### Lease block

Every tenancy carries its lease: `GET /me` (tenant), `GET /me/ledger`, `GET /tenants`,
`GET /tenants/:id`, the tenancy routes, `tenancy:updated` events, the owner ledger, and each
tenancy in `GET /properties`. `leaseStatus` and `daysRemaining` are worked out when you read
them, from the property's local date (its `timeZone`), never stored.

| Field               | Type           | Notes                                                                                                |
| ------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `leaseStartOn`      | string \| null | Calendar date `YYYY-MM-DD`                                                                           |
| `leaseEndOn`        | string \| null | Calendar date. Always `null` for month to month                                                      |
| `leaseTerm`         | string \| null | `"fixed"`, `"month_to_month"`, or `null` (no lease)                                                  |
| `renewalNoticeDays` | number         | Default `60`. Decides when `expiring_soon` starts and the owner's first reminder                     |
| `daysRemaining`     | number \| null | Days from today to `leaseEndOn`. `0` on the last day, negative once expired. `null` with no end date |
| `leaseStatus`       | string         | See below                                                                                            |
| `leaseNotes`        | string \| null | **Owner only.** The key is absent in every tenant copy                                               |

| `leaseStatus`    | When                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `none`           | No lease recorded                                                                                                                                      |
| `month_to_month` | Month to month, no end date                                                                                                                            |
| `active`         | Fixed lease with more than `renewalNoticeDays` days left                                                                                               |
| `expiring_soon`  | Fixed lease with 0 to `renewalNoticeDays` days left (both ends included, so it's `expiring_soon` exactly `renewalNoticeDays` out, and on the last day) |
| `expired`        | Fixed lease whose end date has passed (`daysRemaining < 0`)                                                                                            |

Tenants can read their lease block but can't change it. Every lease route is owner only.

### Message

```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "senderId": "uuid",
  "body": "The kitchen faucet is dripping.",
  "attachmentKey": null,
  "metadata": null,
  "createdAt": "2026-10-11T23:12:27.844Z"
}
```

`attachmentKey` is `null` or a key from [POST /uploads/sign](#post-uploadssign). To show the image,
exchange the key for a URL with [GET /uploads/url](#get-uploadsurl).

`metadata` is `null` for every ordinary message. A [rent reminder](#rent-reminders-owner-only) the
owner sent has `{ "type": "rent_reminder", "tenancyId": "uuid", "chargeId": "uuid" }`. Show those
with a "Pay now" button that opens Payments. Clients can't set `metadata`, it's only ever written by
the reminder route.

### Conversation (list item)

```json
{
  "id": "uuid",
  "otherUser": { "id": "uuid", "name": "Tara Tenant", "role": "tenant" },
  "lastMessage": { "...Message" },
  "unreadCount": 3,
  "lastReadAt": null,
  "otherUserLastReadAt": "2026-10-11T23:15:00.123Z",
  "createdAt": "2026-10-11T23:12:27.776Z"
}
```

| Field                 | Notes                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `otherUser`           | The other participant. For an owner this is the tenant, and the reverse for a tenant.                                                   |
| `lastMessage`         | Newest message, or `null` if the thread is empty.                                                                                       |
| `unreadCount`         | Messages **from the other person** newer than my `lastReadAt`. My own messages never count.                                             |
| `lastReadAt`          | When I last read this thread (`null` = never).                                                                                          |
| `otherUserLastReadAt` | When the other person last read it. Use it for "Seen" receipts on my messages: a message is seen if `createdAt <= otherUserLastReadAt`. |

Sending a message also moves the sender's own `lastReadAt` up to that message.

### WorkOrder

```json
{
  "id": "uuid",
  "title": "Kitchen faucet leaking",
  "description": "Drips constantly, worse at night.",
  "priority": "Normal",
  "status": "In Progress",
  "ownerNotes": "Plumber coming Thursday at 9am",
  "contractor": "Wasatch Plumbing",
  "estimate": 180,
  "property": { "id": "uuid", "name": "Maple Court", "address": "12 Maple St, Springfield" },
  "unitLabel": "Unit 2B",
  "tenantName": "Tara Tenant",
  "tenant": { "id": "uuid", "name": "Tara Tenant" },
  "ownerId": "uuid",
  "createdBy": "uuid",
  "photos": [
    {
      "id": "uuid",
      "key": "attachments/<uploader id>/<uuid>.jpg",
      "uploadedBy": "uuid",
      "createdAt": "2026-10-11T23:12:27.844Z"
    }
  ],
  "createdAt": "2026-10-08T23:12:27.844Z",
  "startedAt": "2026-10-09T15:02:11.120Z",
  "resolvedAt": null
}
```

| Field         | Type           | Notes                                                                                                                                |
| ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `priority`    | string         | Exactly `"Emergency"`, `"Normal"`, or `"Low"` (case sensitive)                                                                       |
| `status`      | string         | Exactly `"Open"`, `"In Progress"`, or `"Resolved"` (case sensitive, with the space)                                                  |
| `description` | string         | `""` when empty, never `null`                                                                                                        |
| `ownerNotes`  | string         | `""` when empty, never `null`. **Visible to the tenant too.**                                                                        |
| `contractor`  | string         | **Owner only.** `""` when not set. The key is **absent** (not `null`) in every tenant copy: HTTP responses and socket events.        |
| `estimate`    | number \| null | **Owner only.** Dollars, rounded to cents (e.g. `180`, `95.5`). `null` when not set. Absent for tenants, like `contractor`.          |
| `unitLabel`   | string \| null |                                                                                                                                      |
| `tenantName`  | string         | Display name. **Always a string**: `""` for owner-created orders with no tenant, never `null`.                                       |
| `tenant`      | object \| null | The linked tenant account. `null` for owner-created orders not linked to a tenant.                                                   |
| `createdBy`   | string \| null | User id of whoever filed it. Compare to `ownerId` to tell "owner logged" from "tenant reported". `null` if that account was deleted. |
| `photos`      | array          | Oldest first. 0 to 10 entries. Get a viewable URL from [GET /uploads/url](#get-uploadsurl) with `key`.                               |
| `startedAt`   | string \| null | Set when the status moves to In Progress. `null` while Open.                                                                         |
| `resolvedAt`  | string \| null | Set when the status moves to Resolved. `null` otherwise.                                                                             |

The dates always match the status: Open has neither date, In Progress has `startedAt` only, and
Resolved has both.

**Owner vs tenant copies:** owners get every field above. Tenants get the same object **without
the `contractor` and `estimate` keys**. That applies to every response and to the `workorder:new`
and `workorder:updated` socket payloads. Check `user.role` rather than testing for the keys.

#### Mapping from the app's current local work order shape

| Local field (`data/workOrders.js`)                       | API field                                                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`                                                     | `id` (now a UUID string)                                                                                          |
| `title`, `description`                                   | `title`, `description`                                                                                            |
| `status`, `priority`                                     | `status`, `priority` (same values)                                                                                |
| `property` (one display string)                          | `property.name` / `property.address` + `unitLabel`. Build the string, e.g. `` `${property.name}, ${unitLabel}` `` |
| `tenant`                                                 | `tenantName` (always a string, `""` when none)                                                                    |
| `notes`                                                  | `ownerNotes`                                                                                                      |
| `photo` (single `{ uri }`)                               | `photos[]`. Show `photos[0]` via `GET /uploads/url?key=...`                                                       |
| `created_at`, `started_at`, `resolved_at` (`YYYY-MM-DD`) | `createdAt`, `startedAt`, `resolvedAt` (full ISO timestamps)                                                      |
| `contractor`, `estimate`                                 | `contractor`, `estimate` (same types: string and number-or-null). **Owner only.** Not present in tenant copies.   |
| `expenses`                                               | **Not stored by the API yet.** Keep them local for now.                                                           |

---

## Health

### `GET /health`

No auth.

**200**

```json
{ "status": "ok", "database": "ok" }
```

**503** (database unreachable). This one does **not** use the standard error shape:

```json
{ "status": "degraded", "database": "unreachable" }
```

---

## Auth

All `/auth/*` routes are **rate limited per IP: 30 requests per 15 minutes** by default (the
server can change this). Going over returns `429 RATE_LIMITED`. Responses include the standard
`RateLimit` and `RateLimit-Policy` headers.

Field rules used below:

- `email`: valid email, max 254 chars. It's trimmed and lowercased, so `" Tara@Example.com"` and
  `"tara@example.com"` are the same account.
- `password` (when creating an account): **10 or more characters**, max 72 bytes (UTF-8).
- `name`: trimmed, 1 to 100 chars.

### `POST /auth/register-owner`

Creates an owner account and signs them in.

Request:

```json
{ "email": "olivia@example.com", "password": "at-least-10-chars", "name": "Olivia Owner" }
```

**201**: [Session](#session) with `user.role = "owner"`.

Errors: `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`, `429 RATE_LIMITED`.

### `POST /auth/register-tenant`

Creates a tenant account from an invite code. In one step this also creates the tenancy (property +
unit from the invite), creates the conversation with the owner who sent the invite, marks the invite
used, and signs the tenant in.

Request:

```json
{
  "inviteCode": "K7M2QX9P",
  "email": "tara@example.com",
  "password": "at-least-10-chars",
  "name": "Tara Tenant"
}
```

| Field        | Required | Notes                                                                      |
| ------------ | -------- | -------------------------------------------------------------------------- |
| `inviteCode` | yes      | Not case sensitive. Spaces and dashes are ignored, so `"k7m2-qx9p"` works. |
| `name`       | no       | Defaults to the `tenantName` the owner put on the invite.                  |

**201**: [Session](#session) with `user.role = "tenant"`.

Errors:

- `400 INVITE_INVALID`: code doesn't exist, was already used, expired, or was revoked (including by
  deleting its property). These all return the same
  error on purpose.
- `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`, `429 RATE_LIMITED`.

If signup fails (for example `EMAIL_TAKEN`), the invite is **not** used up and the tenant can retry.

### `POST /auth/login`

Request:

```json
{ "email": "olivia@example.com", "password": "at-least-10-chars" }
```

`password` only has to be non-empty here (no 10 char rule on login).

**200**: [Session](#session).

Errors:

- `401 INVALID_CREDENTIALS` with message `"Invalid email or password"`. The response is the same
  for an unknown email and a wrong password.
- `400 VALIDATION_ERROR`, `429 RATE_LIMITED`.

### `POST /auth/refresh`

Swaps a refresh token for a brand new session. **Refresh tokens are single use.** Every call
returns a new `refreshToken`. Store it and throw the old one away.

Request:

```json
{ "refreshToken": "kq3v..." }
```

**200**: [Session](#session) (includes a fresh `user`).

Errors: `401 REFRESH_TOKEN_INVALID` (unknown, expired, revoked, or already used), `400 VALIDATION_ERROR`,
`429 RATE_LIMITED`.

> **Reuse detection:** if a refresh token that was already used shows up again, the server assumes
> it was stolen and revokes **every** refresh token for that user. All of their devices will have to
> sign in again. So the app must make sure only **one refresh request is in flight at a time**
> (share a single promise across concurrent 401s) and must save the new refresh token before using
> it.

Suggested client flow: on any `401` with code `TOKEN_INVALID`, call `/auth/refresh` once, retry the
original request with the new access token, and if refresh fails with `REFRESH_TOKEN_INVALID`, send
the user to the sign-in screen.

### `POST /auth/logout`

Revokes the given refresh token. The access token stays valid until it expires (at most 15
minutes), so the app should also delete it locally. Call [`DELETE /push-tokens`](#delete-push-tokens)
first so this device stops getting pushes for this account.

Request:

```json
{ "refreshToken": "kq3v..." }
```

**204** (no body). Returns 204 even if the token was unknown or already revoked, so it's safe to retry.

Errors: `400 VALIDATION_ERROR`, `429 RATE_LIMITED`.

### `GET /me`

Auth required. Any role.

**200** for a tenant:

```json
{
  "user": {
    "id": "uuid",
    "email": "tara@example.com",
    "name": "Tara Tenant",
    "role": "tenant",
    "createdAt": "2026-10-11T23:12:27.776Z",
    "activeTenancies": [
      {
        "id": "uuid",
        "tenantId": "uuid",
        "property": { "id": "uuid", "name": "Maple Court", "address": "12 Maple St, Springfield" },
        "unitLabel": "Unit 2B",
        "status": "active",
        "startedAt": "2026-10-11T23:12:27.776Z",
        "endedAt": null
      }
    ],
    "endedTenancies": []
  }
}
```

- `activeTenancies` and `endedTenancies` are **only present for tenants**. Owners get the plain
  [User](#user).
- They are [Tenancy](#tenancy) objects **without `moveOutNote`**. Active ones are oldest first;
  ended ones have the most recent `endedAt` first.
- **`activeTenancies` empty = read-only mode.** See
  [Former tenants](#former-tenants-read-only-mode).
- This replaced the older `user.tenancies` field.

Errors: `401 UNAUTHORIZED` (no token, or the account no longer exists), `401 TOKEN_INVALID`.

---

## Properties (owner only)

All routes here need auth with `role = "owner"`. A tenant gets `403 FORBIDDEN`.

### `POST /properties`

Request:

```json
{ "name": "Maple Court", "address": "12 Maple St, Springfield" }
```

| Field                 | Rules                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `name`                | trimmed, 1 to 120 chars                                           |
| `address`             | trimmed, 1 to 300 chars                                           |
| `paymentInstructions` | optional, trimmed, up to 1000 chars, `null` or `""` = none        |
| `timeZone`            | optional, IANA time zone like `"America/Denver"`, default `"UTC"` |

**201**:

```json
{ "property": { "...Property", "tenancies": [] } }
```

Errors: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`.

### `GET /properties`

Lists **my** properties, oldest first, each with its current tenancies (oldest first) and tenant
info. Deleted properties are not listed.

**200**:

```json
{ "properties": [ { "...Property" } ] }
```

Errors: `401`, `403 FORBIDDEN`.

### `PATCH /properties/:id`

Changes one of my properties. Send at least one field. Unknown fields are rejected.

```json
{
  "name": "Maple Court East",
  "address": "12 Maple St, Springfield",
  "paymentInstructions": "Zelle to owner@example.com. Put your unit in the memo.",
  "timeZone": "America/Denver"
}
```

| Field                 | Required | Rules                                                                                         |
| --------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `name`                | no       | trimmed, 1 to 120 chars                                                                       |
| `address`             | no       | trimmed, 1 to 300 chars                                                                       |
| `paymentInstructions` | no       | trimmed, up to 1000 chars. `null` or `""` clears it                                           |
| `timeZone`            | no       | IANA time zone like `"America/Denver"`. Changes "today" for the property's ledgers right away |

The change also shows on past tenancies and work orders, since they point at the same property.

**200**:

```json
{ "property": { "...Property" } }
```

Errors: `400 VALIDATION_ERROR` (empty body, unknown field, bad value), `401`, `403 FORBIDDEN`,
`404 NOT_FOUND` (not mine, or deleted).

### `DELETE /properties/:id`

Deletes one of my properties. **This is a soft delete**:

- The property disappears from `GET /properties` and can't be used for anything new: no invites,
  no tenancies, no owner work orders, and it can't be patched.
- Its **history stays**: ended tenancies (in `GET /tenants` and the tenant's `GET /me`) and resolved
  work orders keep showing its name and address.
- Any still-pending invites to it are revoked.

It's blocked while the property is in use:

| Blocked when                                            | Error                               |
| ------------------------------------------------------- | ----------------------------------- |
| any tenancy here is `"active"` (end or move them first) | `409 PROPERTY_HAS_ACTIVE_TENANCY`   |
| any work order here is `"Open"` or `"In Progress"`      | `409 PROPERTY_HAS_OPEN_WORK_ORDERS` |

The tenancy check comes first, so a property with both returns `PROPERTY_HAS_ACTIVE_TENANCY`.

**204** (no body).

Errors: the two `409`s above, `400 VALIDATION_ERROR` (bad id), `401`, `403 FORBIDDEN`,
`404 NOT_FOUND` (not mine, or already deleted).

---

## Invites (owner only)

All routes here need auth with `role = "owner"`. A tenant gets `403 FORBIDDEN`.

### `POST /invites`

Creates an invite for a new tenant at one of my properties. Share `invite.code` with the tenant,
who then uses [POST /auth/register-tenant](#post-authregister-tenant).

Request:

```json
{ "propertyId": "uuid", "unitLabel": "Unit 2B", "tenantName": "Tara Tenant" }
```

| Field        | Required | Rules                                                 |
| ------------ | -------- | ----------------------------------------------------- |
| `propertyId` | yes      | UUID of a property **I own**                          |
| `unitLabel`  | no       | trimmed, 1 to 50 chars                                |
| `tenantName` | yes      | trimmed, 1 to 100 chars. Default name for the tenant. |

**201**:

```json
{ "invite": { "...Invite" } }
```

Errors: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`, `404 NOT_FOUND` (property doesn't exist or
isn't mine).

### `GET /invites`

Lists **my** invites, newest first, in every status. Use `status` to tell them apart.

**200**:

```json
{ "invites": [ { "...Invite" } ] }
```

Errors: `401`, `403 FORBIDDEN`.

### `POST /invites/:id/revoke`

Revokes one of my invites so its code stops working. No request body. Revoking an already revoked
invite is fine and keeps the original `revokedAt`.

**200**:

```json
{ "invite": { "...Invite", "status": "revoked" } }
```

Errors: `409 INVITE_USED` (a tenant already signed up with it), `400 VALIDATION_ERROR` (bad id),
`401`, `403 FORBIDDEN`, `404 NOT_FOUND`.

### `POST /invites/:id/resend`

Makes a **new invite** (new `id`, new `code`, fresh 7-day expiry) for the same property, unit, and
tenant name, and revokes the old one in the same step. Only the new code works afterwards. It works
on pending, expired, and revoked invites. No request body.

**201**:

```json
{
  "invite": { "...Invite (the new one)", "status": "pending" },
  "revokedInvite": { "...Invite (the old one)", "status": "revoked" }
}
```

Share the new `invite.code` with the tenant.

Errors: `409 INVITE_USED`, `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`, `404 NOT_FOUND` (invite
not mine, or its property was deleted).

---

## Tenants (owner only)

All routes here need auth with `role = "owner"`. A tenant gets `403 FORBIDDEN`.

"My tenants" means every tenant account that has, or ever had, a tenancy at one of my properties
(including deleted ones). Everything in these responses is limited to **me**. If a tenant also rents
from another owner, I only see my own tenancies, my work orders, and my conversation with them.

### TenantSummary

```json
{
  "id": "uuid",
  "name": "Tara Tenant",
  "email": "tara@example.com",
  "isActive": true,
  "activeTenancies": [ { "...Tenancy" } ],
  "endedTenancies": [ { "...Tenancy" } ],
  "openWorkOrderCount": 2,
  "conversationId": "uuid"
}
```

| Field                | Notes                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| `isActive`           | `true` if `activeTenancies` isn't empty                                             |
| `activeTenancies`    | [Tenancy](#tenancy) objects (owner copy, with `moveOutNote`), oldest first          |
| `endedTenancies`     | Most recent `endedAt` first                                                         |
| `openWorkOrderCount` | Their work orders with me that are `"Open"` or `"In Progress"`                      |
| `conversationId`     | Our thread, for opening Messages. `null` only in an unusual case where none exists. |

### `GET /tenants`

**200**:

```json
{ "tenants": [ { "...TenantSummary" } ] }
```

Current tenants (`isActive: true`) come first, then former tenants, each group sorted by name. Not
paginated.

Errors: `401`, `403 FORBIDDEN`.

### `GET /tenants/:id`

`:id` is the tenant's **user id**.

**200**:

```json
{
  "tenant": {
    "...TenantSummary",
    "recentWorkOrders": [ { "...WorkOrder" } ]
  }
}
```

`recentWorkOrders` holds up to **10** of their work orders with me, newest first, in the full owner
[WorkOrder](#workorder) shape (with `contractor` and `estimate`).

Errors: `400 VALIDATION_ERROR` (bad id), `401`, `403 FORBIDDEN`, `404 NOT_FOUND` (not one of my
tenants).

---

## Tenancies (owner only)

All routes here need auth with `role = "owner"`. A tenant gets `403 FORBIDDEN`. A tenancy at a
property that isn't mine is `404 NOT_FOUND`. Unknown fields are rejected with `400 VALIDATION_ERROR`.

Each successful call emits [`tenancy:updated`](#tenancyupdated) to the owner and the tenant, and
pushes the tenant (see [Push notification payload](#push-notification-payload)).

**Duplicates:** the same tenant can't have two **active** tenancies at the same property and unit.
Unit labels are compared ignoring case and surrounding spaces, and "no unit" counts as one unit.
Different tenants in the same unit (roommates) are fine. A duplicate is `409 TENANCY_EXISTS`.

**End dates (`endedAt`):** a calendar date `YYYY-MM-DD`. It defaults to **today (UTC)**. It can't be
before the tenancy's start date, and can't be more than **30 days after today**. Otherwise you get
`400 INVALID_END_DATE`. The tenancy ends **as soon as the call succeeds**, even if `endedAt` is in
the future. A future date just records the agreed move-out day; the tenant goes read-only right away.

### `POST /tenancies`

Assigns one of **my existing tenants** to one of my properties. No new invite is needed. To add
someone new, use [POST /invites](#post-invites).

```json
{ "tenantUserId": "uuid", "propertyId": "uuid", "unitLabel": "Unit 3A" }
```

| Field          | Required | Rules                                                                    |
| -------------- | -------- | ------------------------------------------------------------------------ |
| `tenantUserId` | yes      | a user id from [GET /tenants](#get-tenants). Former tenants are allowed. |
| `propertyId`   | yes      | one of my properties, not deleted                                        |
| `unitLabel`    | no       | trimmed, 1 to 50 chars. Omit for a property without units.               |

**201**:

```json
{ "tenancy": { "...Tenancy", "status": "active", "endedAt": null } }
```

`startedAt` is now. Their existing tenancies aren't touched, so a tenant can be active in more than
one place.

Errors: `409 TENANCY_EXISTS`, `404 NOT_FOUND` (the property isn't mine or is deleted, or the user
isn't one of my tenants), `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`.

### `POST /tenancies/:id/move`

Ends an active tenancy and creates a new active one somewhere else, **all or nothing**. If any part
fails (bad date, duplicate, property not mine), nothing changes.

```json
{
  "propertyId": "uuid",
  "unitLabel": "Upstairs",
  "endedAt": "2026-10-31",
  "moveOutNote": "Moved to the bigger unit"
}
```

| Field         | Required | Rules                                                                 |
| ------------- | -------- | --------------------------------------------------------------------- |
| `propertyId`  | yes      | the new property: one of mine, not deleted. Can be the same property. |
| `unitLabel`   | no       | the new unit, trimmed, 1 to 50 chars                                  |
| `endedAt`     | no       | end date for the old tenancy (rules above), default today             |
| `moveOutNote` | no       | note on the old tenancy, trimmed, up to 1000 chars. Owner only.       |

**201**:

```json
{
  "endedTenancy": { "...Tenancy (the old one)", "status": "ended" },
  "tenancy": { "...Tenancy (the new one)", "status": "active" }
}
```

Errors: `409 TENANCY_ENDED` (already ended), `409 TENANCY_EXISTS` (the tenant is already active at the
target unit), `400 INVALID_END_DATE`, `404 NOT_FOUND` (tenancy or target property not mine, or
property deleted), `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`.

### `POST /tenancies/:id/end`

Ends an active tenancy. The body is optional. `{}` or no body ends it today with no note.

```json
{ "endedAt": "2026-10-31", "moveOutNote": "Deposit returned in full" }
```

| Field         | Required | Rules                                  |
| ------------- | -------- | -------------------------------------- |
| `endedAt`     | no       | rules above, default today             |
| `moveOutNote` | no       | trimmed, up to 1000 chars. Owner only. |

**200**:

```json
{ "tenancy": { "...Tenancy", "status": "ended" } }
```

Open work orders and the conversation are left as they are. The tenant keeps read access to both.

Errors: `409 TENANCY_ENDED`, `400 INVALID_END_DATE`, `400 VALIDATION_ERROR`, `401`,
`403 FORBIDDEN`, `404 NOT_FOUND`.

---

## Former tenants (read-only mode)

A tenant is in read-only mode **with a given owner** when they have no `"active"` tenancy at any of
that owner's properties. In the app, `GET /me` → `user.activeTenancies` being empty means
read-only everywhere.

| Action                                                                                 | Former tenant can?              |
| -------------------------------------------------------------------------------------- | ------------------------------- |
| Log in, refresh tokens, `GET /me`                                                      | yes                             |
| `GET /conversations`, read messages, `POST /conversations/:id/read`, join socket rooms | yes                             |
| `GET /work-orders`, `GET /work-orders/:id`, photo URLs via `GET /uploads/url`          | yes                             |
| `POST /conversations/:id/messages`                                                     | **no**: `403 NO_ACTIVE_TENANCY` |
| `POST /work-orders` (with or without `tenancyId`)                                      | **no**: `403 NO_ACTIVE_TENANCY` |
| `PATCH /work-orders/:id` with `addPhotoKeys`                                           | **no**: `403 NO_ACTIVE_TENANCY` |
| `GET /me/ledger`, `GET /payments/:id`, receipt photo URLs                              | yes                             |
| `POST /me/payments` ("I paid") for the ended tenancy                                   | **no**: `403 NO_ACTIVE_TENANCY` |

- The rule is **per owner**. A tenant who now rents from owner B but whose tenancy with owner A
  ended can still write to B, but A's thread and A's work orders are read-only.
- **The owner can still message a former tenant**, e.g. about the deposit. The tenant still gets
  those pushes.
- Assigning them again ([POST /tenancies](#post-tenancies)) restores write access right away.
- Error body: `{ "error": { "code": "NO_ACTIVE_TENANCY", "message": "Your tenancy has ended, so this is read-only now" } }`

Suggested app behavior: when `activeTenancies` is empty, hide the message composer and the
"Report an Issue" button, and show a "Your tenancy has ended" banner. Still treat a
`403 NO_ACTIVE_TENANCY` from any write as "switch to read-only".

---

## Conversations and messages

Auth required, any role. There is exactly one conversation per owner and tenant pair. It's created
automatically when the tenant signs up. Owners see one conversation per tenant. Tenants see
one conversation per owner (normally just one).

### `GET /conversations`

Lists **my** conversations, most recent activity first (newest message, or creation time for an
empty thread).

**200**:

```json
{ "conversations": [ { "...Conversation (list item)" } ] }
```

Not paginated (a user has at most one thread per counterpart).

### `GET /conversations/:id/messages`

Messages in one conversation, **newest first**, cursor paginated.

Query parameters:

| Param    | Required | Rules                                                                               |
| -------- | -------- | ----------------------------------------------------------------------------------- |
| `limit`  | no       | integer 1 to 100, default **30**                                                    |
| `cursor` | no       | the `nextCursor` value from the previous page. Omit it for the first (newest) page. |

**200**:

```json
{
  "messages": [ { "...Message" } ],
  "nextCursor": "uuid-or-null"
}
```

- `nextCursor` is `null` when there are no older messages.
- To load older messages, call again with `cursor=<nextCursor>`.
- Treat `nextCursor` as an opaque string.
- New messages that arrive while paging never shift the older pages. Get new messages from the
  `message:new` socket event (or by refetching the first page).

Errors:

- `400 VALIDATION_ERROR`: bad `id`, `limit`, or `cursor` format.
- `400 INVALID_CURSOR`: the cursor isn't a message in this conversation.
- `401`, `404 NOT_FOUND`: conversation doesn't exist or I'm not in it.

### `POST /conversations/:id/messages`

Sends a message as me.

Request:

```json
{
  "body": "The kitchen faucet is dripping.",
  "attachmentKey": "attachments/<my user id>/<uuid>.jpg"
}
```

| Field           | Required | Rules                                                                                                                   |
| --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `body`          | yes      | string, trimmed first, then **1 to 2000 chars**. Empty or whitespace-only is rejected, even when there's an attachment. |
| `attachmentKey` | no       | a `key` from [POST /uploads/sign](#post-uploadssign) that **I** signed, and the file must already be uploaded.          |

**201**:

```json
{ "message": { "...Message" } }
```

Side effects:

- Emits `message:new` over Socket.IO (see [Socket.IO](#socketio)).
- Moves my `lastReadAt` to this message.
- If the recipient doesn't have a socket joined to this conversation's room, they get an Expo push
  notification (see [Push notification payload](#push-notification-payload)).

Errors:

- `400 VALIDATION_ERROR`: empty or too long body, malformed `attachmentKey`, bad `id`.
- `400 ATTACHMENT_INVALID`: the key isn't mine, or nothing was uploaded to it.
- `403 NO_ACTIVE_TENANCY`: I'm a tenant with no active tenancy with this owner. Owners never get
  this. See [Former tenants](#former-tenants-read-only-mode).
- `401`, `404 NOT_FOUND`.

### `POST /conversations/:id/read`

Marks the conversation read **for me**, up to now. No request body.

**200**:

```json
{ "conversationId": "uuid", "userId": "my-user-uuid", "readAt": "2026-10-11T23:15:00.123Z" }
```

Also emits `message:read` with this same object over Socket.IO.

Errors: `400 VALIDATION_ERROR` (bad `id`), `401`, `404 NOT_FOUND`.

---

## Work orders

Auth required, any role. Owners see every work order on their own properties. Tenants see only
work orders where they are the linked tenant. Anything else is `404 NOT_FOUND`.

### `POST /work-orders`

Creates a work order. The body depends on **who is calling**. Unknown fields are rejected with
`400 VALIDATION_ERROR`, so each role must send only its own fields.

**As a tenant:**

```json
{
  "title": "Water heater not working",
  "description": "No hot water since this morning",
  "priority": "Emergency",
  "photoKeys": ["attachments/<my user id>/<uuid>.jpg"],
  "tenancyId": "uuid"
}
```

| Field         | Required | Rules                                                                                                      |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `title`       | yes      | trimmed, 1 to 120 chars                                                                                    |
| `description` | no       | trimmed, up to 2000 chars, default `""`                                                                    |
| `priority`    | no       | `"Emergency"`, `"Normal"`, or `"Low"`, default `"Normal"`                                                  |
| `photoKeys`   | no       | up to **5** keys from [POST /uploads/sign](#post-uploadssign) that **I** uploaded. Duplicates are ignored. |
| `tenancyId`   | no       | only needed if I have more than one **active** tenancy (ids are in `GET /me` → `user.activeTenancies`)     |

The property, unit, owner, and tenant name **always come from my tenancy**. Sending
`propertyId`, `unitLabel`, `tenantName`, `contractor`, or `estimate` as a tenant is a
`400 VALIDATION_ERROR`. `tenantName` is
set to my account name.

**As an owner:**

```json
{
  "propertyId": "uuid",
  "title": "Clean gutters before winter",
  "description": "",
  "priority": "Low",
  "unitLabel": "Exterior",
  "tenantName": "Tara Tenant",
  "tenantUserId": "uuid",
  "contractor": "Gutter Pros",
  "estimate": 150,
  "photoKeys": []
}
```

| Field                                           | Required | Rules                                                                                                                    |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `propertyId`                                    | yes      | a property **I own**                                                                                                     |
| `title`, `description`, `priority`, `photoKeys` |          | same rules as for tenants                                                                                                |
| `tenantUserId`                                  | no       | link a tenant account. They must have a tenancy at `propertyId`. A linked tenant can see the order and gets its updates. |
| `unitLabel`                                     | no       | trimmed, 1 to 50 chars. Defaults to the linked tenant's unit, else `null`.                                               |
| `tenantName`                                    | no       | trimmed, 1 to 100 chars. Defaults to the linked tenant's name. Returned as `""` if there's neither.                      |
| `contractor`                                    | no       | trimmed, up to 120 chars, default `""`                                                                                   |
| `estimate`                                      | no       | number of dollars, `0` to `9999999999.99`, or `null` (default). Rounded to cents.                                        |

**201**:

```json
{ "workOrder": { "...WorkOrder" } }
```

New work orders always start as `"Open"`.

Side effects:

- Emits `workorder:new` to the owner and the linked tenant (see [Socket.IO](#socketio)).
- **If a tenant filed it**, the owner gets a push (see [Push notification payload](#push-notification-payload)).
  Owner-created orders send no push.

Errors:

- `400 VALIDATION_ERROR`: bad fields, more than 5 `photoKeys`, or fields not allowed for my role.
- `400 ATTACHMENT_INVALID`: a photo key isn't mine or was never uploaded. Nothing is created.
- `400 TENANCY_REQUIRED`: tenant with more than one **active** tenancy who didn't send `tenancyId`.
- `403 NO_ACTIVE_TENANCY`: tenant with no active tenancy, or `tenancyId` points at one of my ended
  tenancies. See [Former tenants](#former-tenants-read-only-mode).
- `404 NOT_FOUND`: owner's `propertyId` isn't theirs or is deleted, `tenantUserId` doesn't live at that
  property, or a tenant's `tenancyId` isn't theirs.
- `401`.

### `GET /work-orders`

Lists work orders I can see, **newest first** (by `createdAt`), cursor paginated.

Query parameters:

| Param        | Required | Rules                                                                                                                               |
| ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `status`     | no       | one status, or several comma separated: `status=Resolved` or `status=Open,In Progress` (URL-encode the space: `Open,In%20Progress`) |
| `propertyId` | no       | only this property. For a property that isn't mine the list is just empty.                                                          |
| `limit`      | no       | integer 1 to 100, default **20**                                                                                                    |
| `cursor`     | no       | `nextCursor` from the previous page, with the **same** filters                                                                      |

**200**:

```json
{ "workOrders": [ { "...WorkOrder" } ], "nextCursor": "uuid-or-null" }
```

`nextCursor` is `null` on the last page. Sorting by priority (Emergency first) is left to the app.

Errors: `400 VALIDATION_ERROR` (unknown status, bad limit/ids), `400 INVALID_CURSOR` (cursor isn't a
work order I can see), `401`.

### `GET /work-orders/:id`

**200**:

```json
{ "workOrder": { "...WorkOrder" } }
```

Errors: `400 VALIDATION_ERROR` (bad id), `401`, `404 NOT_FOUND`.

### `PATCH /work-orders/:id`

Changes a work order. Send only the fields you're changing. At least one field is required, and
unknown fields are rejected.

| Field          | Who             | Rules                                                                                                                                                          |
| -------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`       | owner only      | `"Open"`, `"In Progress"`, or `"Resolved"`. Must be an allowed move (below).                                                                                   |
| `priority`     | owner only      | `"Emergency"`, `"Normal"`, or `"Low"`                                                                                                                          |
| `ownerNotes`   | owner only      | trimmed, up to 2000 chars. `""` clears it.                                                                                                                     |
| `contractor`   | owner only      | trimmed, up to 120 chars. `""` clears it.                                                                                                                      |
| `estimate`     | owner only      | number of dollars, `0` to `9999999999.99`, rounded to cents. `null` clears it. Strings like `"180"` are rejected, so send a number.                            |
| `addPhotoKeys` | owner or tenant | up to 5 keys **I** uploaded, **appended** to the existing photos (max 10 total). Already attached keys are ignored. Tenants: only while the order is `"Open"`. |

Allowed status moves (owners). The server sets the dates; the app never sends them:

| From          | To            | Dates                                               | App action               |
| ------------- | ------------- | --------------------------------------------------- | ------------------------ |
| `Open`        | `In Progress` | `startedAt` = now                                   | Start work               |
| `Open`        | `Resolved`    | `startedAt` = now (if empty) and `resolvedAt` = now | Resolve without starting |
| `In Progress` | `Resolved`    | `resolvedAt` = now                                  | Resolve                  |
| `In Progress` | `Open`        | `startedAt` cleared                                 | Undo start               |
| `Resolved`    | `In Progress` | `resolvedAt` cleared, `startedAt` kept              | Reopen                   |
| `Resolved`    | `Open`        | both cleared                                        | Reopen fully             |
| same          | same          | nothing changes, returns 200                        |                          |

Every move between the three statuses is allowed. Resolving straight from Open fills in
`startedAt` too, so a Resolved order always has both dates.

Examples:

```json
{ "status": "In Progress" }
```

```json
{ "status": "Resolved", "ownerNotes": "Replaced the lock cylinder" }
```

```json
{ "contractor": "Wasatch Plumbing", "estimate": 180 }
```

```json
{ "addPhotoKeys": ["attachments/<my user id>/<uuid>.jpg"] }
```

**200**:

```json
{ "workOrder": { "...WorkOrder" } }
```

Side effects:

- Emits `workorder:updated` to the owner and the linked tenant.
- If `status` actually changed and there's a linked tenant, the tenant gets a push.

Errors:

- `400 VALIDATION_ERROR`: empty body, unknown field, bad value.
- `400 ATTACHMENT_INVALID`: a photo key isn't mine or was never uploaded.
- `400 PHOTO_LIMIT`: the order would have more than 10 photos.
- `403 FORBIDDEN`: a tenant sent `status`, `priority`, `ownerNotes`, `contractor`, or `estimate`. Nothing is changed, even if
  `addPhotoKeys` was also sent.
- `404 NOT_FOUND`: not a work order I can see. Tenants also get 404 for orders they aren't linked to.
- `409 INVALID_STATUS_TRANSITION`: reserved for a status move the rules don't allow. With the
  current rules every move between Open, In Progress, and Resolved is allowed, so the app shouldn't
  see it, but handle it like any other 409.
- `409 WORK_ORDER_NOT_OPEN`: a tenant tried to add photos after work started.
- `403 NO_ACTIVE_TENANCY`: a tenant with no active tenancy with this owner tried to add photos.
- `401`.

---

## Rent ledger

Rent schedules, charges (what the tenant owes), and payments (money in, refunds out) per
tenancy. Payments are recorded by hand today (cash, check, Zelle, Venmo, bank transfer). The
server is built so Stripe can plug in later without changing these routes (see
[Stripe later](#stripe-later)).

### Money, dates, and the append-only rule

- **All money is integer cents**, in requests and responses. Every money field ends in `Cents`
  (`amountCents`, `rentBalanceCents`, ...). `120000` means $1,200.00. Never send decimals: `1200.5`
  is a `400 VALIDATION_ERROR`. Amounts are capped at `100000000` ($1M).
- ⚠️ **This is different from the work order `estimate`**, which is a dollars number with
  decimals (`180.5`). Don't share a money formatter between the two without converting.
- Ledger dates (`dueOn`, `paidOn`, `startsOn`, `endsOn`, `overdueOn`) are calendar dates,
  `"YYYY-MM-DD"`, never shifted by time zone. `period` is `"YYYY-MM"`.
- **"Today" is the property's local date**, from the property's `timeZone` (default `"UTC"`, set it
  with [PATCH /properties/:id](#patch-propertiesid)). Every ledger response includes the `today` it
  used, so the app never has to work out due/overdue itself.
- **Nothing is ever deleted.** A wrong charge or payment is voided with a reason, and it stays in
  the ledger with `status: "voided"` so the history is complete. The database refuses deletes.
- Statuses and balances are **computed when you read them**, never stored. A refetch is always
  current.

### How payments are applied

- Two separate pools. **Rent pool:** charges of kind `rent`, `late_fee`, and `other`, paid by
  payments with `appliesTo: "rent"`. **Deposit pool:** charges of kind `deposit`, paid by
  `appliesTo: "deposit"`. Deposit money never pays rent and rent money never fills a deposit.
- Only payments with `status: "succeeded"` count (`countsTowardBalance: true`). A tenant's "I paid"
  claim counts only after the owner confirms it.
- Payments pay the **oldest due charge first** (FIFO by `dueOn`). A payment bigger than what's owed
  leaves **credit**, which automatically goes to the next charge when it's billed.
- A rent **refund** first uses up unapplied credit, then reopens the most recently due paid
  charges. A **deposit refund** lowers `depositHeldCents` but doesn't reopen the deposit charge.
- Refunds can never be more than the money received in that pool.

### Charge status

| `status`   | Meaning                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `paid`     | Nothing left to pay                                                            |
| `overdue`  | Something left, and today is on or after `overdueOn` (`dueOn + graceDays + 1`) |
| `partial`  | Some paid, the rest isn't late yet                                             |
| `due`      | Due today, or past due but still inside the grace days                         |
| `due_soon` | Due in the next 7 days                                                         |
| `upcoming` | Due more than 7 days from now (rent is billed up to 30 days ahead)             |
| `voided`   | Voided by the owner. Never counts                                              |

The first match from the top wins, so a half-paid late charge is `overdue` (check `paidCents` to
also show "partially paid"). Only rent has grace days. Every other charge is overdue the day after
`dueOn`.

### Payment status lifecycle

```
Hand-recorded (today)

  tenant: POST /me/payments           owner: POST /tenancies/:id/payments
              |                                      |
              v                                      v
     pending_confirmation --confirm--> succeeded <---+
              |                            |
            reject                       void
              v                            v
          rejected                      voided

Provider (Stripe, later, driven by webhooks)

     pending --> processing --> succeeded --> returned
        |            |
        |            +--------> failed
        +--> failed
        +--> voided (canceled)
```

| From                                       | Allowed next statuses                                       |
| ------------------------------------------ | ----------------------------------------------------------- |
| `pending_confirmation`                     | `succeeded` (owner confirms), `rejected` (owner rejects)    |
| `pending`                                  | `processing`, `succeeded`, `failed`, `voided`               |
| `processing`                               | `succeeded`, `failed`                                       |
| `succeeded`                                | `returned` (provider only), `voided` (manual payments only) |
| `failed`, `returned`, `rejected`, `voided` | none, final                                                 |

Only `succeeded` counts toward balances. `pending`, `processing`, `failed`, and `returned` only
happen once a provider (Stripe) exists. Today every payment is `pending_confirmation`, `succeeded`,
`rejected`, or `voided`.

### Ledger objects

#### RentSchedule

```json
{
  "id": "uuid",
  "tenancyId": "uuid",
  "amountCents": 145000,
  "dueDay": 1,
  "startsOn": "2026-07-01",
  "endsOn": null,
  "graceDays": 3,
  "lateFeeCents": 5000,
  "createdAt": "2026-06-24T18:00:00.000Z"
}
```

- `endsOn: null` = the current schedule. A replaced schedule has `endsOn` set to the day before its
  replacement starts. If a schedule was replaced before it billed anything, `endsOn` is the day
  before its own `startsOn`.
- `lateFeeCents: 0` means no late fee.

#### Charge

```json
{
  "id": "uuid",
  "tenancyId": "uuid",
  "propertyId": "uuid",
  "kind": "rent",
  "description": "Rent for October 2026",
  "amountCents": 145000,
  "paidCents": 50000,
  "remainingCents": 95000,
  "status": "partial",
  "dueOn": "2026-10-01",
  "overdueOn": "2026-10-05",
  "period": "2026-10",
  "scheduleId": "uuid",
  "parentChargeId": null,
  "voidedAt": null,
  "voidReason": null,
  "createdAt": "2026-09-01T18:00:00.000Z"
}
```

| Field                    | Notes                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| `kind`                   | `rent` (only from a schedule), `late_fee`, `deposit`, `other`     |
| `paidCents`              | How much of this charge payments cover right now. `0` when voided |
| `remainingCents`         | `amountCents - paidCents`. `0` when voided                        |
| `overdueOn`              | First day it counts as overdue if still unpaid                    |
| `period`                 | `"YYYY-MM"` for rent, `null` otherwise                            |
| `scheduleId`             | The schedule that billed it (rent only), else `null`              |
| `parentChargeId`         | For a late fee, the rent charge it's for. Otherwise `null`        |
| `voidedAt`, `voidReason` | Both set when voided, both `null` otherwise                       |

#### Payment

```json
{
  "id": "uuid",
  "tenancyId": "uuid",
  "kind": "payment",
  "appliesTo": "rent",
  "amountCents": 150000,
  "method": "zelle",
  "status": "succeeded",
  "countsTowardBalance": true,
  "paidOn": "2026-10-03",
  "note": "Sent from her phone",
  "reference": "ZL-8812",
  "receiptPhotoKey": "attachments/<userId>/<uuid>.jpg",
  "submittedBy": "owner",
  "confirmedAt": "2026-10-03T18:00:00.000Z",
  "confirmedBy": "uuid",
  "voidReason": null,
  "rejectReason": null,
  "failureReason": null,
  "provider": "manual",
  "allocation": {
    "appliedTo": [
      { "chargeId": "uuid", "amountCents": 145000 },
      { "chargeId": "uuid", "amountCents": 5000 }
    ],
    "unappliedCents": 0
  },
  "createdAt": "2026-10-03T18:00:00.000Z"
}
```

| Field                        | Notes                                                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kind`                       | `payment` (money from the tenant) or `refund` (money back to them). `amountCents` is always positive                                                                                                                                             |
| `appliesTo`                  | `rent` or `deposit` (which pool)                                                                                                                                                                                                                 |
| `method`                     | `cash`, `check`, `zelle`, `venmo`, `bank_transfer`, `other`. (`stripe_ach` is reserved for later and rejected today)                                                                                                                             |
| `status`                     | See the [lifecycle](#payment-status-lifecycle)                                                                                                                                                                                                   |
| `countsTowardBalance`        | `true` only for `succeeded`                                                                                                                                                                                                                      |
| `submittedBy`                | `owner` (recorded by the owner) or `tenant` (an "I paid" claim)                                                                                                                                                                                  |
| `confirmedAt`, `confirmedBy` | When and by whom it became `succeeded`. `null` until then                                                                                                                                                                                        |
| `rejectReason`               | The owner's reason when a claim is `rejected`                                                                                                                                                                                                    |
| `voidReason`                 | The owner's reason when `voided`                                                                                                                                                                                                                 |
| `failureReason`              | Provider failures only (later)                                                                                                                                                                                                                   |
| `provider`                   | `"manual"` today, `"stripe"` later                                                                                                                                                                                                               |
| `allocation`                 | What this money is doing right now. `null` unless it counts. For a `payment`: `appliedTo` (charges it pays, oldest first) and `unappliedCents` (credit). For a `refund`: `{ "fromCreditCents": 0, "reopened": [{ "chargeId", "amountCents" }] }` |

`allocation` can change after the fact: when next month's rent is billed, credit from an earlier
overpayment moves into `appliedTo`.

#### Balances

```json
{
  "rentBalanceCents": 95000,
  "creditCents": 0,
  "overdueCents": 0,
  "overdueCount": 0,
  "depositHeldCents": 145000,
  "depositOwedCents": 0,
  "pendingConfirmationCents": 120000,
  "nextDue": { "dueOn": "2026-10-01", "amountCents": 95000 }
}
```

| Field                          | Notes                                                                                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rentBalanceCents`             | Rent-pool money owed **as of today**: what's left on charges due on or before today, minus unused credit. Charges billed ahead (next month) aren't in it yet. **Negative = credit** (`-5000` = $50 ahead). Never a hidden `0` |
| `creditCents`                  | Overpaid rent money not applied to any charge yet (`>= 0`)                                                                                                                                                                    |
| `overdueCents`, `overdueCount` | Left on `overdue` charges (rent pool and deposits)                                                                                                                                                                            |
| `depositHeldCents`             | Deposit payments received minus deposit refunds                                                                                                                                                                               |
| `depositOwedCents`             | Left on unpaid `deposit` charges                                                                                                                                                                                              |
| `pendingConfirmationCents`     | Tenant claims waiting on the owner. Not in any balance until confirmed                                                                                                                                                        |
| `nextDue`                      | The earliest date something not-yet-overdue is owed (including rent inside its grace days) and the total left on that date. `null` if nothing is                                                                              |

#### Ledger

One tenancy's whole ledger. Returned by `GET /tenancies/:id/ledger` (owner) and, one per tenancy,
by `GET /me/ledger` (tenant).

```json
{
  "tenancy": { "...Tenancy" },
  "tenant": { "id": "uuid", "name": "Tara Tenant" },
  "isActive": true,
  "paymentInstructions": "Zelle to owner@example.com",
  "timeZone": "America/Denver",
  "today": "2026-10-14",
  "schedule": { "...RentSchedule" },
  "balances": { "...Balances" },
  "charges": [ { "...Charge" } ],
  "payments": [ { "...Payment" } ]
}
```

- `isActive: false` = the tenancy ended. **The tenant side is read-only** then (no claims). The
  owner can still record payments, refunds, and charges on it (deposit refunds, move-out
  damage).
- `schedule` is the current schedule or `null`.
- `charges` are newest `dueOn` first, `payments` newest `paidOn` first. Both include voided and
  rejected rows.
- The tenant's `tenancy` has no `moveOutNote`, same as everywhere else.

#### Receipt

Only for payments with `status: "succeeded"` (else `null`).

```json
{
  "receiptNumber": "RW-20261003-3F9A1C2B",
  "issuedAt": "2026-10-03T18:00:00.000Z",
  "kind": "payment",
  "property": { "name": "Maple Court", "address": "12 Maple St, Springfield" },
  "unitLabel": "Unit 2B",
  "tenant": { "id": "uuid", "name": "Tara Tenant" },
  "owner": { "id": "uuid", "name": "Olivia Owner" },
  "amountCents": 150000,
  "method": "zelle",
  "paidOn": "2026-10-03",
  "reference": "ZL-8812",
  "appliesTo": "rent",
  "appliedTo": [
    {
      "chargeId": "uuid",
      "kind": "rent",
      "description": "Rent for October 2026",
      "period": "2026-10",
      "dueOn": "2026-10-01",
      "amountCents": 145000
    }
  ],
  "unappliedCents": 5000,
  "fromCreditCents": 0
}
```

`receiptNumber` is `RW-<paidOn as YYYYMMDD>-<first 8 hex chars of the payment id, uppercased>`.
For a refund receipt, `appliedTo` lists the charges the refund reopened and `fromCreditCents` is
the part taken from credit.

#### PaymentEvent

The timeline of a payment, oldest first.

```json
{
  "id": "uuid",
  "type": "confirmed",
  "fromStatus": "pending_confirmation",
  "toStatus": "succeeded",
  "actorUserId": "uuid",
  "data": {},
  "createdAt": "2026-10-03T18:00:00.000Z"
}
```

| `type`             | When                                   | `data`         |
| ------------------ | -------------------------------------- | -------------- |
| `payment_recorded` | Owner recorded a payment               | `{}`           |
| `refund_recorded`  | Owner recorded a refund                | `{}`           |
| `claimed`          | Tenant said "I paid"                   | `{}`           |
| `confirmed`        | Owner confirmed a claim                | `{}`           |
| `rejected`         | Owner rejected a claim                 | `{ "reason" }` |
| `voided`           | Owner voided a payment                 | `{ "reason" }` |
| provider types     | Later, e.g. `payment_intent.succeeded` | provider data  |

`fromStatus` is `null` for the first event. `actorUserId` is `null` for provider events.

### Rent schedules (owner only)

#### `GET /tenancies/:id/rent-schedule`

**200**:

```json
{ "schedule": { "...RentSchedule" }, "history": [ { "...RentSchedule" } ] }
```

`schedule` is the current one (or `null`). `history` is every schedule, newest `startsOn` first.

Errors: `401`, `403 FORBIDDEN`, `404 NOT_FOUND` (not my tenancy).

#### `PUT /tenancies/:id/rent-schedule`

Creates the first schedule, or replaces the current one. Unknown fields are rejected.

```json
{
  "amountCents": 145000,
  "dueDay": 1,
  "graceDays": 3,
  "lateFeeCents": 5000,
  "startsOn": "2026-11-01"
}
```

| Field          | Required | Rules                                               |
| -------------- | -------- | --------------------------------------------------- |
| `amountCents`  | yes      | integer, 1 to 100000000                             |
| `dueDay`       | yes      | integer, 1 to 28 (so every month has the day)       |
| `graceDays`    | no       | integer, 0 to 28, default 0                         |
| `lateFeeCents` | no       | integer, 0 up to `amountCents`, default 0 (0 = off) |
| `startsOn`     | no       | date, see below                                     |

- **First schedule:** starts on `startsOn`, or today. It can be backdated up to 366 days (for
  moving an existing tenant onto the app). Past months are billed on the next job run, but
  **late fees are never added for rent that went overdue before the schedule was created**.
- **Changing it never rewrites billed rent.** The new schedule starts at the first month the
  current schedule hasn't billed yet (the 1st of that month), and the old one ends the day
  before. Rent is billed up to 30 days ahead, so a change made mid-month usually takes effect the
  month after next. You can pass a later `startsOn` (e.g. a January increase). An earlier one is
  `409 SCHEDULE_START_TOO_EARLY`, and the message names the earliest allowed date.
- Rent is charged per month in full. No proration at move-in or move-out.

**200**:

```json
{ "schedule": { "...RentSchedule" }, "replacedSchedule": { "...RentSchedule" } }
```

`replacedSchedule` is `null` for the first schedule.

Errors: `400 VALIDATION_ERROR`, `400 INVALID_START_DATE` (more than 366 days away), `401`,
`403 FORBIDDEN`, `404 NOT_FOUND`, `409 TENANCY_ENDED`, `409 SCHEDULE_START_TOO_EARLY`.

Rent charges are created by the [ledger job](#the-ledger-job), not by this route. After a `PUT`,
charges show up on the next run (hourly when it's on, or `npm run ledger:run` in dev).

### Charges (owner only)

#### `POST /tenancies/:id/charges`

Adds a one-off charge. Rent only comes from the schedule. Works on ended tenancies too.

```json
{
  "kind": "other",
  "amountCents": 7500,
  "dueOn": "2026-10-20",
  "description": "Replacement key fob",
  "parentChargeId": null
}
```

| Field            | Required | Rules                                                                                        |
| ---------------- | -------- | -------------------------------------------------------------------------------------------- |
| `kind`           | yes      | `other`, `deposit`, or `late_fee`                                                            |
| `amountCents`    | yes      | integer, 1 to 100000000                                                                      |
| `dueOn`          | yes      | date within 366 days of today                                                                |
| `description`    | yes      | trimmed, 1 to 200 chars                                                                      |
| `parentChargeId` | no       | `late_fee` only. A rent charge on this tenancy. It then counts as that charge's one late fee |

**201**: `{ "charge": { "...Charge" } }`

Errors: `400 VALIDATION_ERROR`, `400 INVALID_DUE_DATE`, `401`, `403 FORBIDDEN`,
`404 NOT_FOUND` (not my tenancy, or `parentChargeId` isn't a rent charge on it),
`409 LATE_FEE_EXISTS`.

#### `POST /charges/:id/void`

```json
{ "reason": "Charged to the wrong unit" }
```

`reason` is required (trimmed, 1 to 500 chars). The charge stays in the ledger with
`status: "voided"`. **Voiding a rent charge also voids its late fee**, with reason
`"Rent charge voided: <your reason>"`. A voided rent month isn't billed again by the old schedule
(a new schedule can bill that month again).

**200**: `{ "charge": { "...Charge" } }`

Errors: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 ALREADY_VOIDED`.

### Payments

#### `POST /tenancies/:id/payments` (owner)

Records money the owner received (`kind: "payment"`) or gave back (`kind: "refund"`). It's
`succeeded` right away. Works on ended tenancies too (e.g. the deposit refund).

```json
{
  "kind": "payment",
  "appliesTo": "rent",
  "amountCents": 145000,
  "method": "zelle",
  "paidOn": "2026-10-03",
  "note": "Sent from her phone",
  "reference": "ZL-8812",
  "receiptPhotoKey": "attachments/<myUserId>/<uuid>.jpg",
  "idempotencyKey": "6f1c3d7e-8a4b-4c2d-9e1f-0a1b2c3d4e5f"
}
```

| Field             | Required | Rules                                                                            |
| ----------------- | -------- | -------------------------------------------------------------------------------- |
| `kind`            | no       | `payment` (default) or `refund`                                                  |
| `appliesTo`       | no       | `rent` (default) or `deposit`                                                    |
| `amountCents`     | yes      | integer, 1 to 100000000                                                          |
| `method`          | yes      | `cash`, `check`, `zelle`, `venmo`, `bank_transfer`, `other`                      |
| `paidOn`          | no       | date, default today. Not in the future, not more than 366 days ago               |
| `note`            | no       | up to 500 chars                                                                  |
| `reference`       | no       | up to 100 chars (check number, Zelle confirmation)                               |
| `receiptPhotoKey` | no       | a key **I** uploaded through [POST /uploads/sign](#post-uploadssign)             |
| `idempotencyKey`  | no       | 8 to 100 chars. Make one per "Save" tap (a UUID is ideal) and resend it on retry |

**Idempotency:** sending the same `idempotencyKey` again with the same tenancy, `kind`,
`appliesTo`, and `amountCents` returns the **original payment with 200** instead of creating a
second one. The same key with different details, or a key someone else already used, is
`409 IDEMPOTENCY_KEY_CONFLICT`. It never returns anyone else's payment.

**201** (new) or **200** (idempotent replay): `{ "payment": { "...Payment" } }`

Errors: `400 VALIDATION_ERROR`, `400 INVALID_PAID_ON`, `400 ATTACHMENT_INVALID`, `401`,
`403 FORBIDDEN`, `404 NOT_FOUND`, `409 REFUND_EXCEEDS_PAYMENTS` (a refund bigger than what that
pool has received), `409 IDEMPOTENCY_KEY_CONFLICT`.

#### `POST /me/payments` (tenant)

The tenant says "I paid" (outside the app, e.g. by Zelle). It's created as
`pending_confirmation` and **changes no balance until the owner confirms it**.

```json
{
  "tenancyId": "uuid",
  "appliesTo": "rent",
  "amountCents": 145000,
  "method": "zelle",
  "paidOn": "2026-10-01",
  "note": "Sent this morning",
  "reference": "ZL-4471902",
  "receiptPhotoKey": "attachments/<myUserId>/<uuid>.jpg",
  "idempotencyKey": "uuid"
}
```

Same rules as the owner route, except: no `kind` (always a payment, tenants can't record
refunds), `paidOn` is **required**, and `tenancyId` picks the tenancy. It's only needed when I have
more than one active tenancy, like `POST /work-orders`.

The owner gets a push ([Tenant says they paid](#ledger-pushes)).

**201** or **200** (idempotent replay): `{ "payment": { "...Payment" } }`

Errors: `400 VALIDATION_ERROR`, `400 INVALID_PAID_ON`, `400 ATTACHMENT_INVALID`,
`400 TENANCY_REQUIRED`, `401`, `403 FORBIDDEN` (owner calling it), `403 NO_ACTIVE_TENANCY`
(my tenancy ended, or `tenancyId` is an ended one), `404 NOT_FOUND` (`tenancyId` isn't mine),
`409 IDEMPOTENCY_KEY_CONFLICT`.

#### `POST /payments/:id/confirm` (owner)

Confirms a tenant claim: `pending_confirmation` → `succeeded`. No body. Sets `confirmedAt` and
`confirmedBy`, and the tenant gets a push.

**200**: `{ "payment": { "...Payment" } }`

Errors: `401`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 PAYMENT_NOT_PENDING`.

#### `POST /payments/:id/reject` (owner)

```json
{ "reason": "Nothing arrived in Zelle" }
```

`pending_confirmation` → `rejected`, with `rejectReason`. It never counts. The tenant gets a push
with the reason.

**200**: `{ "payment": { "...Payment" } }`

Errors: `400 VALIDATION_ERROR` (no reason), `401`, `403 FORBIDDEN`, `404 NOT_FOUND`,
`409 PAYMENT_NOT_PENDING`.

#### `POST /payments/:id/void` (owner)

```json
{ "reason": "Entered the same Zelle payment twice" }
```

For mistakes in hand-recorded money: `succeeded` → `voided`. Works on payments and refunds.

- A pending tenant claim is **rejected**, not voided.
- Provider (Stripe) payments get refunded, not voided.
- You can't void a payment if the refunds left would be bigger than the payments left. Void the
  refund first.

**200**: `{ "payment": { "...Payment" } }`

Errors: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`, `404 NOT_FOUND`,
`409 PAYMENT_NOT_VOIDABLE`, `409 REFUND_EXCEEDS_PAYMENTS`.

#### `GET /payments/:id` (owner or tenant)

Only the owner and the tenant on that payment can see it. Everyone else gets `404`.

**200**:

```json
{
  "payment": { "...Payment" },
  "events": [ { "...PaymentEvent" } ],
  "receipt": { "...Receipt" }
}
```

`receipt` is `null` unless the payment is `succeeded`.

Errors: `401`, `404 NOT_FOUND`.

The receipt photo itself is downloaded with [GET /uploads/url](#get-uploadsurl) using the
payment's `receiptPhotoKey`. That works for the owner and the tenant on the payment, nobody else.

### Ledgers and the owner summary

#### `GET /tenancies/:id/ledger` (owner)

**200**: `{ "ledger": { "...Ledger" } }`

Errors: `401`, `403 FORBIDDEN`, `404 NOT_FOUND`.

#### `GET /me/ledger` (tenant)

Every tenancy I've had, active ones first, each with the property's `paymentInstructions`.
Ended ones (`isActive: false`) are read-only but still show balances, the deposit, and history.

**200**:

```json
{ "ledgers": [ { "...Ledger" } ] }
```

Errors: `401`, `403 FORBIDDEN` (owner calling it).

#### `GET /ledger/summary?month=YYYY-MM` (owner)

The dashboard for one month across my properties. `month` defaults to the current UTC month.

**200**:

```json
{
  "summary": {
    "month": "2026-10",
    "totals": {
      "expectedCents": 360000,
      "collectedCents": 50000,
      "outstandingCents": 165000,
      "overdueCount": 1,
      "overdueCents": 120000,
      "pendingConfirmationCount": 1
    },
    "properties": [
      {
        "property": { "id": "uuid", "name": "Maple Court" },
        "expectedCents": 240000,
        "collectedCents": 50000,
        "outstandingCents": 45000,
        "overdueCount": 0,
        "overdueCents": 0,
        "pendingConfirmationCount": 0
      }
    ]
  }
}
```

| Field                          | Meaning                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expectedCents`                | Rent, late fee, and other charges due in the month (not voided). Deposits aren't income, so they're left out                                             |
| `collectedCents`               | Rent-pool money that landed in the month (by `paidOn`), minus rent refunds in the month                                                                  |
| `outstandingCents`             | What's still owed right now on the month's charges                                                                                                       |
| `overdueCount`, `overdueCents` | Charges due on or before the month's last day that are overdue **right now**. For the current month that includes arrears carried in from earlier months |
| `pendingConfirmationCount`     | Tenant claims waiting on me, from any month                                                                                                              |

`properties` has every live property (zeros if it has nothing), plus a deleted property only if it
still has ledger history.

Errors: `400 VALIDATION_ERROR` (bad month), `401`, `403 FORBIDDEN`.

### The ledger job

A server-side job keeps the ledger current. It runs hourly when the server is started with
`LEDGER_JOB=on`, or once with `npm run ledger:run`. Every step is idempotent:

1. **Bills rent** for each schedule, for every month whose due date is between the schedule's start
   and today + 30 days, within the schedule and the tenancy (nothing after a move-out date).
2. **Adds late fees.** A rent charge still owed after `dueOn + graceDays`, on a schedule with
   `lateFeeCents > 0`, gets exactly one `late_fee` charge (due on `overdueOn`,
   `parentChargeId` = the rent charge). Never twice, not even after the fee is voided. Never for
   rent that went overdue before the schedule existed. And not while the tenant has a rent claim
   waiting on the owner (once the owner rejects it, the next run adds the fee).
3. **Sends reminders** ([pushes](#ledger-pushes)): to the tenant 3 days before a charge is due and
   on its first overdue day (each once per charge, active tenancies only), and to the owner once a
   day while anything of theirs is overdue.

The app never needs to call anything for this. Just refetch on `ledger:updated`.

### Provider interface

Payments are created through a provider picked by `method`. The routes and the app don't change
when a new provider arrives.

| Provider | Methods                                                     | Starts as                                                                 |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `manual` | `cash`, `check`, `zelle`, `venmo`, `bank_transfer`, `other` | `succeeded` (owner records) or `pending_confirmation` (tenant claims)     |
| `stripe` | `stripe_ach`                                                | stub today. Throws `501 NOT_CONFIGURED` and no route accepts `stripe_ach` |

Every status change a provider reports goes through one server function,
`applyProviderEvent(event)`. It takes a provider event (`provider`, `event_id`, `type`,
`provider_payment_id`, `to_status`, optional `provider_charge_id`, `failure_reason`, `data`), and:

- is **idempotent** on `event_id`. A retried webhook returns `duplicate` and changes nothing.
- checks the move against the [status transition map](#payment-status-lifecycle). An
  out-of-order or invalid event is stored on the timeline with `data.ignored` but doesn't change
  the payment.
- writes a [PaymentEvent](#paymentevent), emits `ledger:updated`, and sends the provider pushes
  (`payment:succeeded`, `payment:failed`, `payment:returned`).

It isn't exposed over HTTP yet. It's fully unit tested, so the webhook only has to call it.

### Stripe later

Exactly what plugs in, and where. **Nothing here exists yet, and no app change is needed until the
"pay in app" button.**

1. **Provider:** implement `src/payments/providers/stripe.js` (stubbed and documented in place).
   `startPayment` creates a PaymentIntent for `us_bank_account` (ACH), passes our idempotency key
   to Stripe, and returns `{ status: "pending", provider: "stripe", provider_payment_id: pi.id }`.
   `parseWebhookEvent` verifies the signature and turns a Stripe event into a provider event:
   `payment_intent.processing` → `processing`, `payment_intent.succeeded` → `succeeded`,
   `payment_intent.payment_failed` → `failed`, `payment_intent.canceled` → `voided`,
   ACH return / `charge.dispute.created` → `returned`.
2. **Webhook route:** `POST /webhooks/stripe`, mounted in `src/app.js` **before**
   `express.json()` with `express.raw()` (signature checks need the raw bytes), no bearer auth
   (the signature is the auth). It calls `parseWebhookEvent`, then `applyProviderEvent`, and
   answers `200` for every handled outcome so Stripe stops retrying.
3. **Tenant "pay in app":** `POST /me/payments` starts accepting `method: "stripe_ach"`. The
   response is a `pending` payment plus whatever the app needs to confirm the PaymentIntent
   (e.g. a `clientSecret`). That field will be added here when it exists.
4. **Config:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `src/config.js` and
   `.env.example`.
5. **Refunds of Stripe payments** go through Stripe and come back as provider events. Owners can't
   void provider payments (`409 PAYMENT_NOT_VOIDABLE`).

What the app should already handle so this is painless: `pending`, `processing`, `failed`, and
`returned` statuses (show "processing" or "failed", not paid), and `failureReason`.

---

## Leases (owner only)

A lease lives on its tenancy (one per tenancy). Every route needs `role = "owner"` and only finds
my own tenancies (someone else's is `404`). Lease dates are calendar dates (`YYYY-MM-DD`) and
"today" is the property's local date, same as the [rent ledger](#rent-ledger).

### `GET /tenancies/:id/lease`

**200**:

```json
{
  "lease": { "...Lease block" },
  "events": [
    {
      "id": "uuid",
      "type": "renewed",
      "data": {
        "previousEndOn": "2026-10-31",
        "previousTerm": "fixed",
        "newEndOn": "2027-10-31",
        "newRentCents": 150000,
        "scheduleId": "uuid",
        "rentChangeStartsOn": "2026-12-01"
      },
      "actorUserId": "uuid",
      "createdAt": "2026-10-15T18:00:00.000Z"
    }
  ]
}
```

`events` is the lease timeline, oldest first. Events are never deleted.

| `type`    | When                                   | `data`                                                                                                                                             |
| --------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set`     | First `PUT` on a tenancy with no lease | `{ "before", "after" }`, each `{ leaseStartOn, leaseEndOn, leaseTerm, renewalNoticeDays, leaseNotes }`                                             |
| `changed` | Any later `PUT` that changes something | `{ "before", "after" }`                                                                                                                            |
| `renewed` | `POST /tenancies/:id/lease/renew`      | `previousEndOn`, `previousTerm`, `newEndOn`, `newRentCents` (or `null`), `scheduleId` and `rentChangeStartsOn` (both `null` without a rent change) |

Errors: `401`, `403 FORBIDDEN`, `404 NOT_FOUND`.

### `PUT /tenancies/:id/lease`

Sets the whole lease (a `PUT` replaces it, so fields you leave out are cleared). Unknown fields
are rejected.

```json
{
  "leaseStartOn": "2025-11-01",
  "leaseEndOn": "2026-10-31",
  "leaseTerm": "fixed",
  "renewalNoticeDays": 60,
  "leaseNotes": "Pets: one cat"
}
```

| Field               | Required | Rules                                                                                                                                        |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `leaseStartOn`      | no       | date or `null`                                                                                                                               |
| `leaseEndOn`        | no       | date or `null`. Must be after `leaseStartOn`                                                                                                 |
| `leaseTerm`         | no       | `fixed` or `month_to_month`. Left out: `fixed` if there's an end date, `month_to_month` if only a start date, and no lease at all if neither |
| `renewalNoticeDays` | no       | integer 0 to 365, default 60                                                                                                                 |
| `leaseNotes`        | no       | up to 1000 chars, `null` or `""` = none. Owner only                                                                                          |

- `month_to_month` can't have `leaseEndOn`, and `fixed` needs it (`400 VALIDATION_ERROR`).
- Every date has to be within 20 years of today (`400 INVALID_LEASE_DATES`).
- `PUT` with `{}` clears the lease (`leaseStatus: "none"`).
- A `PUT` that changes nothing writes no event and sends no socket event.

**200**: `{ "lease": { "...Lease block" } }`

Sends [`tenancy:updated`](#tenancyupdated) with `action: "lease_updated"` to both people.

Errors: `400 VALIDATION_ERROR`, `400 INVALID_LEASE_DATES`, `401`, `403 FORBIDDEN`,
`404 NOT_FOUND`, `409 TENANCY_ENDED`.

### `POST /tenancies/:id/lease/renew`

Extends the lease to a new end date, and optionally changes the rent.

```json
{ "newEndOn": "2027-10-31", "newRentCents": 150000 }
```

| Field          | Required | Rules                                                                      |
| -------------- | -------- | -------------------------------------------------------------------------- |
| `newEndOn`     | yes      | date after today, after the current `leaseEndOn`, and after `leaseStartOn` |
| `newRentCents` | no       | integer cents, 1 to 100000000                                              |

- The lease becomes `fixed` with `leaseEndOn = newEndOn` (a month to month lease becomes fixed).
- With `newRentCents`, the rent schedule changes by the **same rules as
  [PUT /rent-schedule](#put-tenanciesidrent-schedule)**: billed rent is never rewritten, and the
  new amount starts the first month that hasn't been billed yet. Due day, grace days, and late fee
  stay the same.
- The renewal and the rent change are one step: if the rent change fails, the lease isn't
  extended either.
- Lease reminders start over for the new end date.

**200**:

```json
{
  "lease": { "...Lease block" },
  "schedule": { "...RentSchedule" },
  "replacedSchedule": { "...RentSchedule" }
}
```

`schedule` and `replacedSchedule` are `null` without `newRentCents`. Sends `tenancy:updated`
with `action: "lease_renewed"`, plus `ledger:updated` (`reason: "schedule_changed"`) when the rent
changed.

Errors: `400 VALIDATION_ERROR`, `400 INVALID_LEASE_DATES`, `400 LATE_FEE_EXCEEDS_RENT` (the
current late fee is more than the new rent), `401`, `403 FORBIDDEN`, `404 NOT_FOUND`,
`409 TENANCY_ENDED`, `409 NO_LEASE` (nothing to renew, set one with `PUT` first),
`409 NO_RENT_SCHEDULE` (`newRentCents` given but there's no schedule to change).

### `GET /leases/expiring?withinDays=90`

My active tenancies with a fixed lease ending between today and `withinDays` days from now
(0 to 365, default 90), soonest first. Already expired leases aren't listed (their tenancy's
`leaseStatus` is `expired`).

**200**:

```json
{
  "withinDays": 90,
  "leases": [
    {
      "tenancyId": "uuid",
      "tenant": { "id": "uuid", "name": "Tara Tenant" },
      "property": { "id": "uuid", "name": "Maple Court" },
      "unitLabel": "Unit 2B",
      "daysRemaining": 25,
      "currentRentCents": 145000,
      "lease": { "...Lease block" }
    }
  ]
}
```

`currentRentCents` is the current rent schedule's amount, or `null` if there's no schedule.

Errors: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`.

### Lease reminders

A server job sends lease reminder pushes. It runs hourly with `LEASE_JOB=on`, or once with
`npm run leases:run`. Only active tenancies with a fixed lease that hasn't ended get them:

- **Owner:** `renewalNoticeDays`, 30, and 7 days before the end. If a day was missed (the job was
  off, or the lease was just entered), only the current one goes out, never a burst of old ones.
  A 30 or 7 day notice period is the same reminder as the 30 or 7 day one.
- **Tenant:** once, 30 days before the end (or as soon after that as the lease is known).
- Each reminder goes out once per lease end date. A renewal moves the end date, so the reminders
  start over.

The pushes are listed under [Lease pushes](#lease-pushes).

---

## Expenses (owner only)

The owner's spending, for profit and tax reports. Every route needs `role = "owner"` and only sees
my own expenses (anyone else's is `404`, and a tenant gets `403`). Like the ledger:

- **Money is integer cents** (`amountCents`). Never decimals.
- `spentOn` is a calendar date (`YYYY-MM-DD`), never shifted by a time zone.
- **Deleting is a soft delete.** The expense disappears from every list and report but stays in
  the database (tax history). The database refuses hard deletes.

### Expense

```json
{
  "id": "uuid",
  "propertyId": "uuid",
  "property": { "id": "uuid", "name": "Maple Court" },
  "category": "repairs",
  "vendor": "Wasatch Plumbing",
  "description": "Replace kitchen faucet",
  "amountCents": 18000,
  "spentOn": "2026-10-03",
  "paymentMethod": "credit_card",
  "taxDeductible": true,
  "receiptKey": "attachments/<myUserId>/<uuid>.jpg",
  "workOrderId": "uuid",
  "notes": "Under warranty for a year",
  "clientId": null,
  "createdAt": "2026-10-03T18:00:00.000Z",
  "updatedAt": "2026-10-03T18:00:00.000Z"
}
```

| Field           | Required on create | Rules                                                                                                                                |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `propertyId`    | no                 | One of my live properties, or `null` for a general expense (accountant, mileage, ...)                                                |
| `category`      | yes                | `repairs`, `utilities`, `insurance`, `taxes`, `mortgage_interest`, `supplies`, `advertising`, `professional_fees`, `travel`, `other` |
| `vendor`        | no                 | up to 120 chars. `null` or `""` = none                                                                                               |
| `description`   | yes                | trimmed, 1 to 500 chars                                                                                                              |
| `amountCents`   | yes                | integer, 1 to 100000000                                                                                                              |
| `spentOn`       | yes                | date. Not in the future (at the property, UTC for a general expense), not before 2000-01-01                                          |
| `paymentMethod` | no                 | `cash`, `check`, `credit_card`, `debit_card`, `bank_transfer`, `zelle`, `venmo`, `other`, or `null`                                  |
| `taxDeductible` | no                 | boolean, default `true`                                                                                                              |
| `receiptKey`    | no                 | a key **I** uploaded through [POST /uploads/sign](#post-uploadssign), or `null`                                                      |
| `workOrderId`   | no                 | a work order at one of my properties, or `null`. See below                                                                           |
| `notes`         | no                 | up to 2000 chars. `null` or `""` = none                                                                                              |

- `clientId` is only set on expenses that came in through [import](#post-expensesimport).
  Read only.
- **Work order links:** the work order has to be at one of my properties. With no `propertyId`,
  the expense takes the work order's property. If both are given they have to match
  (`400 WORK_ORDER_PROPERTY_MISMATCH`).
- **Receipts** use the normal upload flow (sign, `PUT`, send the key). Download with
  [GET /uploads/url](#get-uploadsurl). Only I can download an expense receipt (not my tenants,
  not other owners), and not after the expense is deleted.

### `GET /expenses`

Query (all optional):

| Param        | Notes                                              |
| ------------ | -------------------------------------------------- |
| `propertyId` | a property id, or `none` for general expenses only |
| `category`   | one category                                       |
| `from`, `to` | `YYYY-MM-DD`, inclusive, on `spentOn`              |
| `limit`      | 1 to 100, default 50                               |
| `cursor`     | the `nextCursor` from the previous page            |

Newest `spentOn` first.

**200**:

```json
{
  "expenses": [ { "...Expense" } ],
  "totals": { "count": 41, "amountCents": 1834200, "taxDeductibleCents": 1790000 },
  "nextCursor": "uuid"
}
```

`totals` covers **every** expense matching the filters, not just this page. `nextCursor` is
`null` on the last page.

Errors: `400 VALIDATION_ERROR`, `400 INVALID_CURSOR` (not one of my live expenses), `401`,
`403 FORBIDDEN`.

### `POST /expenses`

Body: the fields in the [Expense](#expense) table. Unknown fields (including `clientId`) are
rejected.

**201**: `{ "expense": { "...Expense" } }`

Errors: `400 VALIDATION_ERROR`, `400 INVALID_SPENT_ON`, `400 ATTACHMENT_INVALID`,
`400 WORK_ORDER_PROPERTY_MISMATCH`, `401`, `403 FORBIDDEN`, `404 NOT_FOUND` (property or work
order isn't mine, or the property is deleted).

### `GET /expenses/:id`

**200**: `{ "expense": { "...Expense" } }`. Errors: `401`, `403 FORBIDDEN`, `404 NOT_FOUND`.

### `PATCH /expenses/:id`

Send any of the create fields (at least one). `null` clears the optional ones. The change is
merged onto the expense and the whole thing is checked again (so a work order at another property
is still a mismatch). An expense can stay on a property that was deleted later, but can't be moved
onto a deleted one.

**200**: `{ "expense": { "...Expense" } }`

Errors: same as `POST`, plus `404` when the expense isn't mine or is deleted.

### `DELETE /expenses/:id`

Soft delete. **204**, no body. Deleting again is `404`.

### `POST /expenses/import`

For moving the app's old local expenses onto the server. 1 to **500** items per call.

```json
{
  "expenses": [
    {
      "clientId": "local-7f3a",
      "propertyId": "uuid",
      "category": "supplies",
      "description": "Smoke detector batteries",
      "amountCents": 2399,
      "spentOn": "2025-08-14"
    }
  ]
}
```

Each item has every create field plus a required `clientId` (the app's own id, 1 to 100 chars).

- **Idempotent per `clientId`.** A `clientId` I've imported before comes back as
  `status: "existing"` with its original `id`. It's not updated or checked again, so retrying a
  whole batch after a dropped connection never duplicates anything and always gives the same ids.
- **Partial success.** Good items are imported, and each bad item comes back as `status: "failed"`
  with an `error`. Fix those and resend the batch: the ones already in are `existing`.
- A `clientId` repeated inside one call: the first one counts, the repeats fail with
  `DUPLICATE_CLIENT_ID`.
- `clientId`s are per owner. Another owner using the same `clientId` never touches my rows.

**200**:

```json
{
  "results": [
    { "index": 0, "clientId": "local-7f3a", "status": "created", "id": "uuid", "error": null },
    { "index": 1, "clientId": "local-7f3b", "status": "existing", "id": "uuid", "error": null },
    {
      "index": 2,
      "clientId": "local-7f3c",
      "status": "failed",
      "id": null,
      "error": { "code": "INVALID_SPENT_ON", "message": "spentOn can't be in the future" }
    },
    {
      "index": 3,
      "clientId": "local-7f3d",
      "status": "failed",
      "id": null,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Expense is invalid",
        "details": [
          { "path": "amountCents", "message": "amountCents must be a whole number of cents" }
        ]
      }
    }
  ],
  "createdCount": 1,
  "existingCount": 1,
  "failedCount": 2
}
```

`results` has one entry per item, in request order (`index` is the position). `clientId` is `null`
on a failed item that didn't send one. Per-item `error.code` is one of `VALIDATION_ERROR` (with
`details`), `DUPLICATE_CLIENT_ID`, `INVALID_SPENT_ON`, `ATTACHMENT_INVALID`,
`WORK_ORDER_PROPERTY_MISMATCH`, or `NOT_FOUND` (property or work order isn't mine).

Errors (whole request): `400 VALIDATION_ERROR` (`expenses` missing, empty, or more than 500),
`401`, `403 FORBIDDEN`.

### `GET /expenses/summary?year=YYYY`

`year` is required (2000 to 2100).

**200**:

```json
{
  "summary": {
    "year": 2026,
    "totalCents": 1834200,
    "taxDeductibleCents": 1790000,
    "count": 41,
    "byCategory": [{ "category": "repairs", "amountCents": 512000, "count": 9 }],
    "byMonth": [{ "month": "2026-01", "amountCents": 120000 }],
    "byProperty": [
      { "property": { "id": "uuid", "name": "Maple Court" }, "amountCents": 900000 },
      { "property": null, "amountCents": 34200 }
    ]
  }
}
```

- `byCategory` has all 10 categories in the order listed above, zeros included.
- `byMonth` has all 12 months.
- `byProperty` has every live property (zeros included), then any deleted property with
  expenses that year, then `property: null` (general expenses), always last.

Errors: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`.

---

## Reports (owner only)

Both reports need `year` (2000 to 2100) and only cover my properties. Tenants get `403`.

**Rent collected** is exactly the [rent ledger's](#rent-ledger) number: the server calls the same
function `GET /ledger/summary` uses for `collectedCents`. That means only `succeeded` payments,
the rent pool only (rent, late fees, other charges, never deposits), and refunds subtracted.
Pending claims, rejected, voided, failed, and returned payments are left out. It's bucketed by
`paidOn`, and expenses by `spentOn`. Both are the property's own calendar dates, so a payment on
Dec 31 is December's even if it's already Jan 1 in UTC. For any month and property, the profit
report's `rentCollectedCents` equals `GET /ledger/summary`'s `collectedCents`.

### `GET /reports/profit?year=YYYY&propertyId=`

**200**:

```json
{
  "report": {
    "year": 2026,
    "propertyId": null,
    "properties": [
      {
        "property": { "id": "uuid", "name": "Maple Court" },
        "rentCollectedCents": 2900000,
        "expensesCents": 812000,
        "netCents": 2088000,
        "months": [
          { "month": "2026-01", "rentCollectedCents": 240000, "expensesCents": 18000, "netCents": 222000 }
        ]
      }
    ],
    "general": {
      "rentCollectedCents": 0,
      "expensesCents": 34200,
      "netCents": -34200,
      "months": [ { "...month" } ]
    },
    "total": {
      "rentCollectedCents": 2900000,
      "expensesCents": 846200,
      "netCents": 2053800,
      "months": [ { "...month" } ]
    }
  }
}
```

- Every row has all 12 `months`. `netCents = rentCollectedCents - expensesCents` and can be
  negative.
- `properties` has every live property (zeros if nothing happened), plus any deleted property with
  activity that year.
- `general` is expenses with no property. `total` is everything, general included.
- With `propertyId` (one of mine, deleted ones too): just that property, `general` is `null`, and
  `total` is that property alone.
- Expenses count whether or not they're tax deductible. The tax summary is where that matters.

Errors: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`, `404 NOT_FOUND` (`propertyId` isn't mine).

### `GET /reports/tax-summary?year=YYYY&format=json|csv`

The year in IRS Schedule E (rental income) shape. `format` defaults to `json`.

- **Income** is rent collected (above), Schedule E line 3.
- **Expenses** are only `taxDeductible: true` ones, grouped onto Schedule E lines in form order.
  Non-deductible spending is reported separately (`nonDeductibleExpensesCents`) and isn't in the
  totals or net.
- `netCents = incomeCents - deductibleExpensesCents`.

| `category`          | Schedule E line | `label`                               |
| ------------------- | --------------- | ------------------------------------- |
| `advertising`       | 5               | Advertising                           |
| `travel`            | 6               | Auto and travel                       |
| `insurance`         | 9               | Insurance                             |
| `professional_fees` | 10              | Legal and other professional fees     |
| `mortgage_interest` | 12              | Mortgage interest paid to banks, etc. |
| `repairs`           | 14              | Repairs                               |
| `supplies`          | 15              | Supplies                              |
| `taxes`             | 16              | Taxes                                 |
| `utilities`         | 17              | Utilities                             |
| `other`             | 19              | Other                                 |

Schedule E lines the app doesn't track (cleaning, commissions, management fees, other interest,
depreciation) are left out. This is a summary for the owner and their accountant, not tax advice.

**200 (json)**:

```json
{
  "summary": {
    "year": 2026,
    "properties": [
      {
        "property": { "id": "uuid", "name": "Maple Court" },
        "incomeCents": 2900000,
        "categories": [
          { "category": "advertising", "scheduleELine": 5, "label": "Advertising", "amountCents": 0 }
        ],
        "deductibleExpensesCents": 790000,
        "nonDeductibleExpensesCents": 22000,
        "netCents": 2110000
      }
    ],
    "general": { "...same block, incomeCents is always 0" },
    "total": { "...same block, everything" }
  }
}
```

Every block lists all 10 categories, zeros included.

**200 (csv)**: `Content-Type: text/csv; charset=utf-8` and
`Content-Disposition: attachment; filename="tax-summary-2026.csv"`. CRLF line endings, a header
row, then one block per property, then the general block, then the all-properties block. Fields
with commas, quotes, or newlines are quoted, with inner quotes doubled.

```
year,scope,property_id,property_name,schedule_e_line,category,label,amount_cents,amount
2026,property,<uuid>,Maple Court,3,rents_received,Rents received,2900000,29000.00
2026,property,<uuid>,Maple Court,5,advertising,Advertising,0,0.00
...
2026,property,<uuid>,Maple Court,19,other,Other,0,0.00
2026,property,<uuid>,Maple Court,20,total_expenses,Total expenses,790000,7900.00
2026,property,<uuid>,Maple Court,21,net,Income or (loss),2110000,21100.00
2026,property,<uuid>,Maple Court,,non_deductible,Not tax deductible (not in totals),22000,220.00
2026,general,,General (no property),3,rents_received,Rents received,0,0.00
...
2026,all,,All properties,21,net,Income or (loss),2075800,20758.00
2026,all,,All properties,,non_deductible,Not tax deductible (not in totals),22000,220.00
```

| Column            | Notes                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| `scope`           | `property`, `general`, or `all`                                                  |
| `property_id`     | empty for `general` and `all`                                                    |
| `property_name`   | the property's name, `General (no property)`, or `All properties`                |
| `schedule_e_line` | 3, the category lines, 20 (total expenses), 21 (net). Empty for `non_deductible` |
| `category`        | `rents_received`, a category, `total_expenses`, `net`, or `non_deductible`       |
| `amount_cents`    | integer cents                                                                    |
| `amount`          | the same amount in dollars with two decimals (`1550.00`), for spreadsheets       |

Each block is 14 rows, in this order: income, the 10 categories, total, net, non-deductible.

Errors: `400 VALIDATION_ERROR` (bad year or format), `401`, `403 FORBIDDEN`.

---

## Rent reminders (owner only)

The owner can nudge a tenant who owes rent. A reminder is a normal message from the owner in the
owner/tenant thread, with text the server suggests from the ledger. **Nothing is ever sent
automatically. A reminder only goes out when the owner taps send.** Every route needs
`role = "owner"` and only finds my own tenancies (someone else's is `404`). Tenants get `403` on
all of them.

### The flow

1. `GET /tenancies/:id/reminders/preview?kind=friendly` shows the suggested text, the amount, and
   whether I can send right now.
2. The owner edits the text (optional) and taps send: `POST /tenancies/:id/reminders`.
3. The server posts it in the thread, the tenant gets `message:new` and a push that opens
   Payments, and it's logged in `GET /tenancies/:id/reminders`.

**Rules:**

- The tenancy has to be active (`409 NO_ACTIVE_TENANCY`) and **owe something as of today** at
  the property: the rent balance plus any deposit due by today (`409 NOTHING_OWED`). Pending
  "I paid" claims don't reduce it. That's the same number as `balances.rentBalanceCents` (plus
  owed deposit) on the ledger.
- **One reminder per tenancy per 24 hours**, measured in elapsed time from the last send (not
  calendar days). Exactly 24 hours later is allowed. Too soon is `429 REMINDER_TOO_SOON` with
  `details.canSendAt`.
- The due date in the text is the **oldest unpaid charge's** due date, a property-local date.

### Suggested text

Built from the tenant's first name, the amount owed in dollars with cents, the oldest unpaid due
date, the place, and the property's `paymentInstructions`. It's always 600 characters or less.
Long payment instructions get shortened with `…`, but the amount and date never do.

| `kind`           | Tone            | Example                                                                                                                                                                                                                                                                    |
| ---------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `friendly`       | warm            | `Hi Tara, just a friendly reminder that your balance of $1,450.00 for Maple Court, Unit 2B was due October 1. How to pay: Zelle to owner@example.com. If you have already sent it, you can mark it paid in the app. Thanks so much!`                                       |
| `overdue_notice` | firm but polite | `Hi Tara, your balance of $1,450.00 for Maple Court, Unit 2B is past due. It was due October 1. Please send payment as soon as possible. How to pay: Zelle to owner@example.com. If you have already paid, please mark it paid in the app so I can confirm it. Thank you.` |

With no payment instructions, "How to pay: ..." becomes "You can pay the way you usually do."

### `GET /tenancies/:id/reminders/preview?kind=friendly|overdue_notice`

`kind` defaults to `friendly`.

**200**:

```json
{
  "preview": {
    "kind": "friendly",
    "messageText": "Hi Tara, just a friendly reminder that ...",
    "amountCents": 145000,
    "chargeId": "uuid",
    "dueOn": "2026-10-01",
    "lastReminderAt": "2026-10-20T16:04:00.000Z",
    "canSendNow": false,
    "canSendAt": "2026-10-21T16:04:00.000Z"
  }
}
```

- `chargeId` / `dueOn`: the oldest unpaid charge due by today.
- `lastReminderAt`: when the last reminder for this tenancy went out, or `null`.
- `canSendAt`: when the next one is allowed, or `null` when `canSendNow` is `true`.

Errors: `400 VALIDATION_ERROR` (bad kind), `401`, `403 FORBIDDEN`, `404 NOT_FOUND`,
`409 NO_ACTIVE_TENANCY`, `409 NOTHING_OWED`.

### `POST /tenancies/:id/reminders`

```json
{ "kind": "friendly", "message": "Hi Tara, quick reminder about October's rent..." }
```

| Field     | Required | Rules                                                                           |
| --------- | -------- | ------------------------------------------------------------------------------- |
| `kind`    | yes      | `friendly` or `overdue_notice`                                                  |
| `message` | no       | the owner's edited text, trimmed, 1 to 600 chars. Left out = the suggested text |

What happens (one transaction, so two taps at once send one reminder):

- The text is posted as a message from the owner in the owner/tenant conversation (created if
  it's somehow missing), with `metadata: { "type": "rent_reminder", "tenancyId", "chargeId" }`.
- The usual [`message:new`](#messagenew) socket event goes to the thread room and both people's
  personal rooms.
- The tenant gets a [rent reminder push](#rent-reminder-push) whose tap opens **Payments**. It's
  sent even if they have the thread open.
- The reminder is logged (the history below). It's never deleted.

**201**:

```json
{
  "reminder": {
    "id": "uuid",
    "tenancyId": "uuid",
    "kind": "friendly",
    "chargeId": "uuid",
    "amountCents": 145000,
    "messageId": "uuid",
    "messageText": "Hi Tara, quick reminder about October's rent...",
    "sentAt": "2026-10-22T16:04:00.000Z"
  },
  "message": { "...Message, with metadata" }
}
```

`amountCents` is what was owed when it was sent, so the history still reads right after the tenant
pays.

**429 REMINDER_TOO_SOON**:

```json
{
  "error": {
    "code": "REMINDER_TOO_SOON",
    "message": "You can send one reminder per tenancy every 24 hours",
    "details": { "canSendAt": "2026-10-23T16:04:00.000Z" }
  }
}
```

Errors: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`, `404 NOT_FOUND`,
`409 NO_ACTIVE_TENANCY`, `409 NOTHING_OWED`, `429 REMINDER_TOO_SOON`.

### `GET /tenancies/:id/reminders`

History for one tenancy, newest first.

**200**: `{ "reminders": [ { "...reminder" } ] }`

Errors: `401`, `403 FORBIDDEN`, `404 NOT_FOUND`.

---

## Uploads (image attachments)

Auth required, any role. Attaching an image takes three steps:

1. `POST /uploads/sign` gives you `{ key, uploadUrl, method, headers }`.
2. Upload the raw file bytes: `PUT uploadUrl` with exactly `headers`, and the body is the file
   (not multipart, not JSON). Do **not** send an `Authorization` header. The URL is pre-signed.
   Expect a `200` with an empty body.
3. Attach it: `POST /conversations/:id/messages` with `{ body, attachmentKey: key }`, or
   `photoKeys` / `addPhotoKeys` on [work orders](#work-orders).

To display an attachment, call `GET /uploads/url?key=...` and load the returned `url` (no auth
header). URLs expire after 5 minutes, so fetch a new one when needed instead of storing it.

The same flow works whether the server stores files locally (dev) or in S3 (later). The app
shouldn't care which. Just use the returned URLs and headers as-is.

### `POST /uploads/sign`

Request:

```json
{ "contentType": "image/jpeg", "sizeBytes": 482113 }
```

| Field         | Rules                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `contentType` | one of `image/jpeg`, `image/png`, `image/webp`, `image/heic`                                                                  |
| `sizeBytes`   | integer, 1 up to the server max (**10 MB = 10485760** by default). Must be the **exact** byte size of the file you'll upload. |

**201**:

```json
{
  "key": "attachments/4bdab3eb-e9cd-4b13-9854-c1e43f482553/8f0c4a8e-1d1b-4c55-9a43-3f0f1e2b7c11.jpg",
  "uploadUrl": "http://localhost:4000/uploads/local?key=...&expires=...&size=...&sig=...",
  "method": "PUT",
  "headers": { "Content-Type": "image/jpeg" },
  "expiresAt": "2026-10-11T23:17:27.000Z"
}
```

`uploadUrl` is valid until `expiresAt` (5 minutes). The upload is rejected if the `Content-Type`
header or the byte count doesn't match what was signed.

Errors: `400 VALIDATION_ERROR`, `401`.

Upload (`PUT uploadUrl`) errors in local dev mode: `403 SIGNATURE_INVALID` (expired or tampered
URL, or wrong `Content-Type`), `400 SIZE_MISMATCH`, `413 PAYLOAD_TOO_LARGE`. With S3 you get S3's
own XML errors instead. Either way, treat any non-2xx as "upload failed, sign again."

### `GET /uploads/url`

Query: `key` (required), an attachment key.

Returns a short-lived download URL **only if** the key is attached to something I can see:

- a message in a conversation I'm part of,
- a photo on a work order I can see (I'm its owner or its linked tenant), or
- the `receiptPhotoKey` of a payment I'm on (I'm its owner or its tenant), or
- the `receiptKey` of one of **my own** expenses that isn't deleted (owners only).

Receipt photos use the same upload flow as message attachments: sign, `PUT` the bytes, then send
the key as `receiptPhotoKey`.

An uploaded file that isn't attached to anything yet has no download URL.

**200**:

```json
{
  "url": "http://localhost:4000/uploads/local?key=...&expires=...&sig=...",
  "expiresAt": "2026-10-11T23:17:27.000Z"
}
```

Errors: `400 VALIDATION_ERROR` (malformed key), `401`, `404 NOT_FOUND` (not attached anywhere I
can see).

---

## Push tokens

Auth required, any role.

### `POST /push-tokens`

Registers this device's Expo push token for the signed-in user. Call it after sign-in and whenever
the token changes. Calling it again with the same token is fine. If the token was registered to a
different user before (shared device), it moves to the current user.

Request:

```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "platform": "ios" }
```

| Field      | Rules                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| `token`    | a valid Expo push token (`ExponentPushToken[...]` or `ExpoPushToken[...]`) |
| `platform` | `"ios"` or `"android"`                                                     |

**201**:

```json
{
  "pushToken": {
    "id": "uuid",
    "token": "ExponentPushToken[...]",
    "platform": "ios",
    "createdAt": "..."
  }
}
```

Errors: `400 VALIDATION_ERROR`, `401`.

### `DELETE /push-tokens`

Unregisters a token for the signed-in user. Call it on logout.

Request:

```json
{ "token": "ExponentPushToken[...]" }
```

**204** (no body), even if the token wasn't registered.

Errors: `400 VALIDATION_ERROR`, `401`.

### Push notification payload

Every device registered to the recipient gets the notification. The shapes:

#### New message

Sent when the recipient has **no socket joined to that conversation's room**.

```json
{
  "title": "<sender name>",
  "body": "<message preview: whitespace collapsed, max 100 chars, ends with … if cut>",
  "sound": "default",
  "data": { "type": "message:new", "conversationId": "uuid", "messageId": "uuid" }
}
```

Use `data.conversationId` to open the thread when the notification is tapped. The sender never
gets a push for their own message. Tokens Expo reports as `DeviceNotRegistered` are removed
automatically.

#### New work order (to the owner, only when a tenant files it)

`Normal` / `Low`:

```json
{
  "title": "New request: <title>",
  "body": "<tenantName> at <property name>, <unitLabel>: <description preview, or the title if empty>",
  "sound": "default",
  "priority": "default",
  "data": { "type": "workorder:new", "workOrderId": "uuid", "priority": "Normal" }
}
```

`Emergency` gets a stronger message and high delivery priority:

```json
{
  "title": "🚨 EMERGENCY: <title>",
  "body": "<tenantName> at <property name>, <unitLabel> needs help now. Tap to respond.",
  "sound": "default",
  "priority": "high",
  "data": { "type": "workorder:new", "workOrderId": "uuid", "priority": "Emergency" }
}
```

(`, <unitLabel>` is left out when there is no unit.)

#### Work order status change (to the linked tenant)

Sent only when `status` actually changes. Notes, priority, and photo changes don't push.

```json
{
  "title": "Work started" | "Request resolved" | "Request reopened",
  "body": "<title> is now <status>.",
  "sound": "default",
  "data": { "type": "workorder:updated", "workOrderId": "uuid", "status": "In Progress" }
}
```

The title is `"Work started"` for In Progress, `"Request resolved"` for Resolved, and
`"Request reopened"` for Open.

#### Tenancy change (to the tenant)

Sent to the tenant when the owner assigns, moves, or ends one of their tenancies. `<place>` is
`<property name>, <unitLabel>`, or just the property name when there's no unit.

| `data.action` | `title`             | `body`                                                                                  |
| ------------- | ------------------- | --------------------------------------------------------------------------------------- |
| `assigned`    | `New home added`    | `You've been added to <place>.`                                                         |
| `moved`       | `Your home changed` | `You're now set up at <new place>.`                                                     |
| `ended`       | `Tenancy ended`     | `Your tenancy at <place> has ended. Your messages and requests are still here to read.` |

```json
{
  "title": "Tenancy ended",
  "body": "Your tenancy at Maple Court, Unit 2B has ended. Your messages and requests are still here to read.",
  "sound": "default",
  "data": { "type": "tenancy:updated", "action": "ended", "tenancyId": "uuid" }
}
```

For `moved`, `tenancyId` is the **new** tenancy.

#### Ledger pushes

`<place>` is `<property name>, <unitLabel>` (or just the property name), amounts are formatted
like `$1,200.00`, and `<method>` is `cash`, `check`, `Zelle`, `Venmo`, `bank transfer`, or
`another method`. Every one also comes with a [`ledger:updated`](#ledgerupdated) socket event.

| To     | When                                 | `title`                                           | `body`                                                                                        | `data`                                                                             |
| ------ | ------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| owner  | tenant says "I paid"                 | `Tenant says they paid`                           | `<tenant name> says they paid <amount> by <method> for <place>. Tap to confirm.`              | `{ "type": "payment:claimed", "paymentId", "tenancyId" }`                          |
| tenant | owner confirms the claim             | `Payment confirmed`                               | `Your <amount> payment for <place> was confirmed.`                                            | `{ "type": "payment:confirmed", "action": "confirmed", "paymentId", "tenancyId" }` |
| tenant | owner rejects the claim              | `Payment not confirmed`                           | `Your <amount> payment for <place> wasn't confirmed: <reason>`                                | `{ "type": "payment:rejected", "action": "rejected", "paymentId", "tenancyId" }`   |
| tenant | owner records a refund               | `Refund recorded`                                 | `<amount> was refunded to you for <place>.` (`<amount> of your deposit was ...` for deposits) | `{ "type": "payment:refunded", "action": "refunded", "paymentId", "tenancyId" }`   |
| tenant | 3 days before a charge is due        | `Rent due soon` (`Payment due soon` for non-rent) | `<amount left> for <place> is due <Mon D>.`                                                   | `{ "type": "ledger:reminder", "kind": "due_soon", "tenancyId", "chargeId" }`       |
| tenant | first overdue day                    | `Rent is overdue` (`Payment is overdue`)          | `<amount left> for <place> was due <Mon D>. Tap to see your balance.`                         | `{ "type": "ledger:reminder", "kind": "overdue", "tenancyId", "chargeId" }`        |
| owner  | once a day while anything is overdue | `Overdue rent`                                    | `<n> charges are overdue, <total> in total.` (`1 charge is overdue, ...`)                     | `{ "type": "ledger:overdue_digest", "overdueCount", "overdueCents" }`              |

An owner recording a plain payment sends no push (the tenant sees it on their next ledger fetch,
and their open screens get `ledger:updated`). Reminders only go to tenants with an active tenancy.
The owner's daily digest counts every overdue charge, including ended tenancies.

Later, with Stripe: `Payment received` (`payment:succeeded`) to the tenant, and `Payment failed` /
`Payment returned` (`payment:failed`, `payment:returned`) to both.

#### Lease pushes

From the lease job. `<place>` and the date work like the ledger pushes. `<when>` is `today`,
`tomorrow`, or `in <n> days`.

| To     | When                                       | `title`                | `body`                                                                               |
| ------ | ------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------ |
| owner  | `renewalNoticeDays`, 30, and 7 days before | `Lease ending soon`    | `<tenant name>'s lease at <place> ends <Mon D> (<when>).`                            |
| tenant | 30 days before                             | `Your lease ends soon` | `Your lease at <place> ends <Mon D> (<when>). Talk to your landlord about renewing.` |

```json
{
  "title": "Lease ending soon",
  "body": "Tara Tenant's lease at Maple Court, Unit 2B ends Nov 9 (in 25 days).",
  "sound": "default",
  "data": {
    "type": "lease:reminder",
    "kind": "owner_30",
    "tenancyId": "uuid",
    "leaseEndOn": "2026-11-09",
    "daysRemaining": 25
  }
}
```

`data.kind` is `owner_notice`, `owner_30`, `owner_7`, or `tenant_30`. Route a tapped
`lease:reminder` to the tenancy (owner) or the tenant's home screen.

#### Rent reminder push

To the tenant when the owner sends a [rent reminder](#rent-reminders-owner-only). The body is the
start of the reminder text (up to 100 chars).

```json
{
  "title": "Rent reminder",
  "body": "Hi Tara, just a friendly reminder that your balance of $1,450.00 for Maple Court, Unit 2…",
  "sound": "default",
  "data": {
    "type": "rent_reminder",
    "screen": "payments",
    "kind": "friendly",
    "tenancyId": "uuid",
    "chargeId": "uuid",
    "conversationId": "uuid",
    "messageId": "uuid"
  }
}
```

The title is `Rent reminder` for `friendly` and `Rent is past due` for `overdue_notice`. **Route
a tapped `rent_reminder` to Payments** (`data.screen`), not the conversation. The tenant doesn't
also get the generic new-message push for it.

Use `data.type` to route a tapped notification: `message:new` → the conversation,
`workorder:new` / `workorder:updated` → the work order detail screen, `tenancy:updated` → refetch
`GET /me` (tenants), `payment:*` → `GET /payments/:paymentId`, `ledger:reminder` → the tenant's
ledger (`GET /me/ledger`), `ledger:overdue_digest` → the owner's summary (`GET /ledger/summary`), `rent_reminder` → Payments
(`GET /me/ledger`).

---

## Socket.IO

Socket.IO v4 on the same host and port as the HTTP API (default path `/socket.io`).

### Connecting

```js
import { io } from 'socket.io-client';

const socket = io(BASE_URL, {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

- The access token goes in `auth.token`. (`Authorization: Bearer <token>` in `extraHeaders` also
  works.)
- A missing, invalid, or expired token is rejected with a `connect_error` whose `err.message` is
  `"UNAUTHORIZED"`. Refresh the access token, set the new one in `socket.auth`, and reconnect.
- The token is only checked when the socket connects. A socket that's already connected stays
  connected after its token expires. When the app refreshes its tokens it should update
  `socket.auth.token` so reconnects use the new one.

On connect, the server puts the socket in a private room for its user. That means `message:new` and
`message:read` for **all my conversations** reach every connected device of mine, even without
joining a conversation. Use that to update the inbox list and badges.

### Client → server events

Both events take an optional acknowledgement callback. It's called with `{ ok: true }` or
`{ ok: false, error: "<code>" }`.

#### `conversation:join`

```js
socket.emit('conversation:join', { conversationId }, (ack) => {
  /* { ok: true } */
});
```

Join while the conversation screen is open. Being joined means "I'm looking at this thread," so the
server **won't send push notifications** for it while you're joined. Ack errors:
`VALIDATION_ERROR` (not a UUID), `NOT_FOUND` (not my conversation), `INTERNAL_ERROR`.

Rejoin after a reconnect. Socket.IO doesn't restore rooms on its own.

#### `conversation:leave`

```js
socket.emit('conversation:leave', { conversationId }, (ack) => {
  /* { ok: true } */
});
```

Leave when the conversation screen closes or the app goes to the background, so pushes start again.
Ack error: `VALIDATION_ERROR`.

### Server → client events

Each event is delivered **once** per socket, even if the socket is in both the conversation room and
its user room.

#### `message:new`

Sent to both participants (conversation room + both users' rooms) when a message is created.

```json
{ "message": { "...Message" } }
```

The sender gets it too. Dedupe by `message.id` against the `201` response.

#### `message:read`

Sent to both participants when someone calls `POST /conversations/:id/read`.

```json
{ "conversationId": "uuid", "userId": "uuid of the reader", "readAt": "2026-10-11T23:15:00.123Z" }
```

If `userId` is the other person, update `otherUserLastReadAt` (seen receipts). If it's me (another of
my devices), set that conversation's `unreadCount` to 0.

#### `workorder:new`

Sent to the owner's and the linked tenant's personal rooms (every connected device of theirs) when
a work order is created. No room joining is needed. The owner's payload includes `contractor` and
`estimate`; the tenant's doesn't.

```json
{ "workOrder": { "...WorkOrder" } }
```

#### `workorder:updated`

Sent to the owner's and the linked tenant's personal rooms after any successful
`PATCH /work-orders/:id` (status, priority, notes, contractor, estimate, or photos). The payload is
the **full** updated work order (the tenant's copy has no `contractor` or `estimate`), so replace the
local copy by `workOrder.id`.

```json
{ "workOrder": { "...WorkOrder" } }
```

The person who made the change gets the event too (on all their devices). Owner-created orders
with no linked tenant only go to the owner.

#### `tenancy:updated`

Sent to the owner's and the tenant's personal rooms when the owner assigns, moves, or ends a
tenancy, or changes or renews its lease. No room joining is needed.

```json
{
  "action": "moved",
  "tenancy": { "...Tenancy" },
  "endedTenancy": { "...Tenancy" }
}
```

| `action`          | `tenancy`                               | `endedTenancy`         |
| ----------------- | --------------------------------------- | ---------------------- |
| `"assigned"`      | the new active tenancy                  | `null`                 |
| `"moved"`         | the new active tenancy                  | the old, ended tenancy |
| `"ended"`         | the tenancy that just ended             | `null`                 |
| `"lease_updated"` | the tenancy, with its new `lease` block | `null`                 |
| `"lease_renewed"` | the tenancy, with its new `lease` block | `null`                 |

The owner's copy includes `moveOutNote` and `lease.leaseNotes`. **The tenant's copy has neither
key.** Lease actions send no push. On the
tenant side, refetch `GET /me` (or patch `activeTenancies`/`endedTenancies` locally) and switch
to read-only mode if no active tenancy is left. On the owner side, refetch `GET /tenants` and
`GET /properties` or update them locally.

#### `ledger:updated`

Sent to **both** the owner's and the tenant's personal rooms whenever anything in a tenancy's
ledger changes: payments, claims, confirms, rejects, voids, refunds, charges, schedule changes,
and the job's rent billing and late fees. The payload says what changed, not the new numbers. Refetch
the ledger you're showing (`GET /tenancies/:tenancyId/ledger`, `GET /me/ledger`,
`GET /ledger/summary`, or `GET /payments/:paymentId`).

```json
{ "tenancyId": "uuid", "reason": "payment_claimed", "paymentId": "uuid", "chargeId": null }
```

| `reason`            | `paymentId` | `chargeId`            |
| ------------------- | ----------- | --------------------- |
| `payment_recorded`  | yes         | `null`                |
| `refund_recorded`   | yes         | `null`                |
| `payment_claimed`   | yes         | `null`                |
| `payment_confirmed` | yes         | `null`                |
| `payment_rejected`  | yes         | `null`                |
| `payment_voided`    | yes         | `null`                |
| `charge_created`    | `null`      | yes                   |
| `charge_voided`     | `null`      | yes                   |
| `schedule_changed`  | `null`      | `null`                |
| `rent_billed`       | `null`      | the newest one billed |
| `late_fee_added`    | `null`      | the newest fee        |
| `payment_<status>`  | yes         | `null`                |

`payment_<status>` (e.g. `payment_succeeded`, `payment_failed`) only comes from provider events
later.

---

## Error code index

| HTTP | `code`                          | When                                                                                                                            |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`              | Body, query, or params failed validation. Has `details`.                                                                        |
| 400  | `INVALID_JSON`                  | Body isn't valid JSON                                                                                                           |
| 400  | `INVITE_INVALID`                | Invite code unknown, used, expired, or revoked                                                                                  |
| 400  | `INVALID_CURSOR`                | Pagination cursor isn't in this conversation / one of my work orders / one of my expenses                                       |
| 400  | `TENANCY_REQUIRED`              | Tenant with several active tenancies must send `tenancyId` (work orders, payment claims)                                        |
| 400  | `INVALID_END_DATE`              | `endedAt` is before the tenancy started or more than 30 days ahead                                                              |
| 400  | `INVALID_PAID_ON`               | Payment `paidOn` is in the future or more than 366 days ago                                                                     |
| 400  | `INVALID_DUE_DATE`              | Charge `dueOn` is more than 366 days from today                                                                                 |
| 400  | `INVALID_LEASE_DATES`           | A lease date is more than 20 years from today, or a renewal's `newEndOn` isn't after today, the current end, and the start      |
| 400  | `LATE_FEE_EXCEEDS_RENT`         | Lease renewal's `newRentCents` is less than the current late fee                                                                |
| 400  | `INVALID_SPENT_ON`              | Expense `spentOn` is in the future or before 2000-01-01                                                                         |
| 400  | `WORK_ORDER_PROPERTY_MISMATCH`  | Expense's work order is at a different property than its `propertyId`                                                           |
| 400  | `INVALID_START_DATE`            | Rent schedule `startsOn` is more than 366 days from today                                                                       |
| 400  | `PHOTO_LIMIT`                   | Work order would have more than 10 photos                                                                                       |
| 400  | `ATTACHMENT_INVALID`            | Attachment key isn't yours or wasn't uploaded                                                                                   |
| 400  | `SIZE_MISMATCH`                 | Local upload: byte count differs from the signed `sizeBytes`                                                                    |
| 401  | `UNAUTHORIZED`                  | No bearer token, or the account no longer exists                                                                                |
| 401  | `TOKEN_INVALID`                 | Access token expired, malformed, or bad signature. Refresh and retry.                                                           |
| 401  | `INVALID_CREDENTIALS`           | Login failed                                                                                                                    |
| 401  | `REFRESH_TOKEN_INVALID`         | Refresh token unknown, expired, revoked, or reused. Sign in again.                                                              |
| 403  | `NO_ACTIVE_TENANCY`             | Tenant has no active tenancy with this owner (or the claimed tenancy ended), so writes are blocked (read-only mode)             |
| 403  | `FORBIDDEN`                     | Wrong role for this route or field (e.g. a tenant calling `/properties` or changing work order status, contractor, or estimate) |
| 403  | `SIGNATURE_INVALID`             | Local upload/download URL expired or tampered with                                                                              |
| 404  | `NOT_FOUND`                     | Unknown route, or the resource doesn't exist or isn't yours                                                                     |
| 409  | `EMAIL_TAKEN`                   | An account with that email already exists                                                                                       |
| 409  | `INVALID_STATUS_TRANSITION`     | Work order or payment status move isn't allowed (reserved, the routes return the more specific codes above)                     |
| 409  | `WORK_ORDER_NOT_OPEN`           | Tenant tried to add photos after work started                                                                                   |
| 409  | `TENANCY_EXISTS`                | That tenant already has an active tenancy in that unit                                                                          |
| 409  | `TENANCY_ENDED`                 | The tenancy has already ended (can't end, move, or change its rent schedule or lease)                                           |
| 409  | `NOTHING_OWED`                  | Rent reminder on a tenancy that owes nothing as of today                                                                        |
| 409  | `NO_ACTIVE_TENANCY`             | Rent reminder on an ended tenancy (409 here, the tenant-side write block is 403)                                                |
| 409  | `NO_LEASE`                      | Renewing a tenancy that has no lease                                                                                            |
| 409  | `NO_RENT_SCHEDULE`              | Lease renewal with `newRentCents` on a tenancy with no rent schedule                                                            |
| 409  | `SCHEDULE_START_TOO_EARLY`      | New rent schedule would start before the first month the current one hasn't billed                                              |
| 409  | `LATE_FEE_EXISTS`               | That rent charge already has its one late fee                                                                                   |
| 409  | `ALREADY_VOIDED`                | The charge is already voided                                                                                                    |
| 409  | `REFUND_EXCEEDS_PAYMENTS`       | A refund (or voiding a payment) would leave refunds bigger than the money received in that pool                                 |
| 409  | `IDEMPOTENCY_KEY_CONFLICT`      | That `idempotencyKey` was already used for a different payment (or by someone else)                                             |
| 409  | `PAYMENT_NOT_PENDING`           | Confirm/reject on a payment that isn't `pending_confirmation`                                                                   |
| 409  | `PAYMENT_NOT_VOIDABLE`          | Void on a payment that isn't a hand-recorded `succeeded` one (reject claims instead, provider payments get refunded)            |
| 409  | `INVITE_USED`                   | The invite was already used (can't revoke or resend it)                                                                         |
| 409  | `PROPERTY_HAS_ACTIVE_TENANCY`   | Can't delete: someone still actively lives there                                                                                |
| 409  | `PROPERTY_HAS_OPEN_WORK_ORDERS` | Can't delete: a work order there isn't resolved                                                                                 |
| 413  | `PAYLOAD_TOO_LARGE`             | JSON body over 100 KB, or local upload over the size limit                                                                      |
| 429  | `REMINDER_TOO_SOON`             | A rent reminder for this tenancy went out less than 24 hours ago. `details.canSendAt` says when                                 |
| 429  | `RATE_LIMITED`                  | Too many `/auth/*` requests from this IP                                                                                        |
| 500  | `INTERNAL_ERROR`                | Server bug. The message is always generic.                                                                                      |
| 501  | `NOT_CONFIGURED`                | Stripe provider stub. No route can reach it today, reserved for when `stripe_ach` is enabled                                    |
