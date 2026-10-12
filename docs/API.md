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
- [Conversations and messages](#conversations-and-messages)
- [Work orders](#work-orders)
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
- **Scoping:** every list and lookup only returns data the signed-in user is part of. Anything that
  belongs to someone else returns `404 NOT_FOUND` (the same response as an id that doesn't exist).
  A route that requires a different role returns `403 FORBIDDEN`.
- **Notation:** in examples, `{ "...Message" }` means "a full [Message](#message) object here"
  (same for User, Property, Invite, Conversation, WorkOrder). It is not literal JSON.
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

| Field           | Type   | Notes                                                                 |
| --------------- | ------ | --------------------------------------------------------------------- |
| `error.code`    | string | Stable, machine-readable. Branch on this, not on `message`.           |
| `error.message` | string | Human-readable. Fine to log; not localized.                           |
| `error.details` | array  | **Only present for `VALIDATION_ERROR`.** One entry per invalid field. |

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
  "createdAt": "2026-10-11T23:12:27.776Z",
  "tenancies": [
    {
      "id": "uuid",
      "unitLabel": "Unit 2B",
      "startedAt": "2026-10-11T23:12:27.776Z",
      "tenant": { "id": "uuid", "name": "Tara Tenant", "email": "tara@example.com" }
    }
  ]
}
```

`unitLabel` can be `null`.

### Invite

```json
{
  "id": "uuid",
  "code": "K7M2QX9P",
  "propertyId": "uuid",
  "unitLabel": "Unit 2B",
  "tenantName": "Tara Tenant",
  "expiresAt": "2026-10-18T23:12:27.776Z",
  "usedAt": null,
  "createdAt": "2026-10-11T23:12:27.776Z"
}
```

`code` is 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L). `unitLabel` can be
`null`. Invites expire 7 days after creation and can be used once.

### Message

```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "senderId": "uuid",
  "body": "The kitchen faucet is dripping.",
  "attachmentKey": null,
  "createdAt": "2026-10-11T23:12:27.844Z"
}
```

`attachmentKey` is `null` or a key from [POST /uploads/sign](#post-uploadssign). To show the image,
exchange the key for a URL with [GET /uploads/url](#get-uploadsurl).

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

- `400 INVITE_INVALID`: code doesn't exist, was already used, or expired. These all return the same
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

**200**:

```json
{
  "user": {
    "id": "uuid",
    "email": "tara@example.com",
    "name": "Tara Tenant",
    "role": "tenant",
    "createdAt": "2026-10-11T23:12:27.776Z",
    "tenancies": [
      {
        "id": "uuid",
        "unitLabel": "Unit 2B",
        "startedAt": "2026-10-11T23:12:27.776Z",
        "property": { "id": "uuid", "name": "Maple Court", "address": "12 Maple St, Springfield" }
      }
    ]
  }
}
```

`tenancies` is **only present for tenants**. Owners get the plain [User](#user).

Errors: `401 UNAUTHORIZED` (no token, or the account no longer exists), `401 TOKEN_INVALID`.

---

## Properties (owner only)

All routes here need auth with `role = "owner"`. A tenant gets `403 FORBIDDEN`.

### `POST /properties`

Request:

```json
{ "name": "Maple Court", "address": "12 Maple St, Springfield" }
```

| Field     | Rules                   |
| --------- | ----------------------- |
| `name`    | trimmed, 1 to 120 chars |
| `address` | trimmed, 1 to 300 chars |

**201**:

```json
{ "property": { "...Property", "tenancies": [] } }
```

Errors: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`.

### `GET /properties`

Lists **my** properties, oldest first, each with its tenancies (oldest first) and tenant info.

**200**:

```json
{ "properties": [ { "...Property" } ] }
```

Errors: `401`, `403 FORBIDDEN`.

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

Lists **my** invites, newest first, including used and expired ones. An invite is pending when
`usedAt` is `null` and `expiresAt` is in the future.

**200**:

```json
{ "invites": [ { "...Invite" } ] }
```

Errors: `401`, `403 FORBIDDEN`.

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
| `tenancyId`   | no       | only needed if I have more than one tenancy (ids are in `GET /me` → `user.tenancies`)                      |

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
- `400 TENANCY_REQUIRED`: tenant with more than one tenancy who didn't send `tenancyId`.
- `400 NO_TENANCY`: tenant account with no tenancy.
- `404 NOT_FOUND`: owner's `propertyId` isn't theirs, `tenantUserId` doesn't live at that
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
- `401`.

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

- a message in a conversation I'm part of, or
- a photo on a work order I can see (I'm its owner or its linked tenant).

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

Use `data.type` to route a tapped notification: `message:new` → the conversation,
`workorder:new` / `workorder:updated` → the work order detail screen.

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

---

## Error code index

| HTTP | `code`                      | When                                                                                                                            |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`          | Body, query, or params failed validation. Has `details`.                                                                        |
| 400  | `INVALID_JSON`              | Body isn't valid JSON                                                                                                           |
| 400  | `INVITE_INVALID`            | Invite code unknown, used, or expired                                                                                           |
| 400  | `INVALID_CURSOR`            | Pagination cursor isn't in this conversation / one of my work orders                                                            |
| 400  | `TENANCY_REQUIRED`          | Tenant with several tenancies must send `tenancyId`                                                                             |
| 400  | `NO_TENANCY`                | Tenant has no tenancy to file a work order against                                                                              |
| 400  | `PHOTO_LIMIT`               | Work order would have more than 10 photos                                                                                       |
| 400  | `ATTACHMENT_INVALID`        | Attachment key isn't yours or wasn't uploaded                                                                                   |
| 400  | `SIZE_MISMATCH`             | Local upload: byte count differs from the signed `sizeBytes`                                                                    |
| 401  | `UNAUTHORIZED`              | No bearer token, or the account no longer exists                                                                                |
| 401  | `TOKEN_INVALID`             | Access token expired, malformed, or bad signature. Refresh and retry.                                                           |
| 401  | `INVALID_CREDENTIALS`       | Login failed                                                                                                                    |
| 401  | `REFRESH_TOKEN_INVALID`     | Refresh token unknown, expired, revoked, or reused. Sign in again.                                                              |
| 403  | `FORBIDDEN`                 | Wrong role for this route or field (e.g. a tenant calling `/properties` or changing work order status, contractor, or estimate) |
| 403  | `SIGNATURE_INVALID`         | Local upload/download URL expired or tampered with                                                                              |
| 404  | `NOT_FOUND`                 | Unknown route, or the resource doesn't exist or isn't yours                                                                     |
| 409  | `EMAIL_TAKEN`               | An account with that email already exists                                                                                       |
| 409  | `INVALID_STATUS_TRANSITION` | Work order status move isn't allowed (none currently; reserved)                                                                 |
| 409  | `WORK_ORDER_NOT_OPEN`       | Tenant tried to add photos after work started                                                                                   |
| 413  | `PAYLOAD_TOO_LARGE`         | JSON body over 100 KB, or local upload over the size limit                                                                      |
| 429  | `RATE_LIMITED`              | Too many `/auth/*` requests from this IP                                                                                        |
| 500  | `INTERNAL_ERROR`            | Server bug. The message is always generic.                                                                                      |
