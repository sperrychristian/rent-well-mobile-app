# The old test mode rules (a note, not live)

These are the rules Rent Well ran on through milestone 2, kept here only as a record. The live rules are in `database.rules.json` at the repo root.

The repo's copy was fully open:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

The Firebase console's test mode published the same open rules with an end date, written as `"now < <a timestamp>"` for both `.read` and `.write`, so they would have stopped working on December 9.

Assignment 12 replaced both with rules that only let a signed-in user read and write:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

## Why per-user rules are the next step

`auth != null` keeps out anyone who isn't signed in, but any signed-in account can still read and write every record. The app only shows each person their own data because it filters by `ownerId` and `tenantUserId` on the phone. Real per-user rules would check `auth.uid` against those fields (through `authLinks` for the seeded accounts, whose ids aren't their Firebase uids) so the database itself refuses someone else's records. That needs the data reshaped so each landlord's records sit under one path the rules can check, which is why it's a separate step and not part of this assignment.
