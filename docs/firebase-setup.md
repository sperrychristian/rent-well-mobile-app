# Firebase setup for Rent Well

Rent Well uses one Firebase **Realtime Database** (not Firestore) as its only backend, and **Firebase
Authentication** (email and password) for signing in, both through their REST endpoints. These steps
take about fifteen minutes. You need a Google account and Node installed.

## Create the database

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**.
   Give it a name (for example `rent-well`). Google Analytics is optional, you can turn it off.
2. In the left menu open **Build**, then **Realtime Database**, then click **Create Database**.
3. Pick the location closest to you and click **Next**.
4. Choose **Start in test mode** and click **Enable**. Test mode lets anyone read and write for 30 days.
   You'll swap in rules that need a signed-in user in step 13, after the data is in.
5. At the top of the **Data** tab you'll see the database address. It looks like
   `https://your-project-default-rtdb.firebaseio.com`. Copy it.

## Turn on email and password sign in

6. In the left menu open **Build**, then **Authentication**, then **Get started**.
7. On the **Sign-in method** tab pick **Email/Password**, turn on the first switch (leave "Email link"
   off), and click **Save**. Without this, sign up and log in say that email and password sign in is
   turned off.
8. Open **Project settings** (the gear next to Project Overview). On the **General** tab copy the
   **Web API key**. (If there's no web app yet, add one with the `</>` button, any nickname works.)

## Connect the app

9. In the project folder, copy the example settings file:

   ```bash
   cp .env.example .env
   ```

10. Open `.env` and fill in your address (no slash at the end), the Web API key, and a password for
    the seeded accounts (8 characters or more, make up your own):

    ```
    EXPO_PUBLIC_FIREBASE_DB_URL=https://your-project-default-rtdb.firebaseio.com
    EXPO_PUBLIC_FIREBASE_API_KEY=your-web-api-key
    SEED_ACCOUNT_PASSWORD=pick-your-own-password
    ```

    `.env` is in `.gitignore`, so none of these go into git. The app only reads the two
    `EXPO_PUBLIC_` lines. Only the seed script reads `SEED_ACCOUNT_PASSWORD`.

11. Check that git ignores it. This should print `.env`:

   ```bash
   git check-ignore .env
   ```

## Fill it with sample data

12. Seed the database with the same story the demo tells (Taylor Brooks, two properties, six tenants
    including a roommate and a former tenant, leases, three months of rent, work orders, expenses,
    trips, messages, invites, checklists, and documents):

    ```bash
    npm run firebase:seed
    ```

    It makes a Firebase Auth account for every seeded person first (the password is
    `SEED_ACCOUNT_PASSWORD`), links each one to its user record (`authLinks` and `authUid`), then
    writes the data while signed in as Taylor, so it works with either set of rules. It prints a table
    of the seeded emails at the end. Add `-- --reset` to wipe the database first. The script only
    writes to the address in `.env` (or a local address), and running it again gives the same data
    and leaves accounts made in the app alone.

    Check every node made it:

    ```bash
    npm run firebase:check
    ```

    Each node should print `PASS`. You can also look at the data in the console's **Data** tab, and
    the accounts on the **Authentication** > **Users** tab.

## Publish the rules (after the app works)

13. Try the app first (below). Once logging in works, open **Realtime Database**, then the **Rules**
    tab, replace what's there with the contents of `database.rules.json`, and click **Publish**:

    ```json
    { "rules": { ".read": "auth != null", ".write": "auth != null" } }
    ```

    Now only a signed-in account can read or write. The app sends its token on every request
    (`?auth=`), so nothing else changes. These rules have no end date, unlike test mode. (The app
    filters on the phone instead of using REST queries, so no `.indexOn` entries are needed.) The old
    rules are kept as a note in [database-rules-test-mode.md](database-rules-test-mode.md).

## Run the app

14. Start Expo with a clean cache so it picks up `.env`:

    ```bash
    npx expo start -c
    ```

15. Open it in Expo Go or a simulator, tap **Log In**, and use a seeded email with
    `SEED_ACCOUNT_PASSWORD`:
    - `taylor@example.com`: **Taylor Brooks** (landlord, has everything)
    - `sam@example.com`: **Sam Rivera** (tenant at 123 Maple St, Unit 2)
    - `morgan@example.com`: **Morgan Diaz** (former tenant, read only)
    - `jamie@example.com`: **Jamie Ortiz** (landlord with no data, for the empty screens)

    Or make your own: **Sign Up** makes a new landlord, and **I have an invite code** makes a tenant
    (the seeded code is `K7M2QX9P`).

## If something goes wrong

- **"The database address is missing"**: `.env` is missing or the line is misspelled. Fix it, then
  restart with `npx expo start -c`.
- **"The Firebase API key is missing"**: add `EXPO_PUBLIC_FIREBASE_API_KEY` to `.env`, then restart
  with `npx expo start -c`.
- **"Email and password sign in is turned off"**: do step 7.
- **"The database turned this away"** (a permission error): the published rules need a signed-in user
  and the request had no good token. Log out and log in again. If it keeps happening, check that the
  Web API key in `.env` is from the same project as the database. If you need the app working right
  away, publish the old test mode rules from `database-rules-test-mode.md` while you look.
- **"This account has no Rent Well profile yet"**: the Firebase account exists but isn't linked to a
  user record. For a seeded email, run `npm run firebase:seed` again. Otherwise sign up again with the
  same email and password, which finishes the profile.
- **"That email or password isn't right"** for a seeded email: use the `SEED_ACCOUNT_PASSWORD` that
  was in `.env` the first time you seeded.
- **"Can't reach the database"**: check your internet. On a phone, Expo Go needs to be online too.
- **The seed stops with "already exists with a different password"**: that email was seeded before
  with another `SEED_ACCOUNT_PASSWORD`. Put the old one back, or delete that user on the
  **Authentication** > **Users** tab and seed again.

## Trying it with no Firebase project

`npm run firebase:fake` starts a small local copy of the database and Auth REST APIs on port 9000 (it
keeps data in memory only). Add `-- --require-auth` to make it turn away requests without a token,
like the real rules. Seed it with `npm run firebase:seed -- --url=http://localhost:9000`, and in
`.env` set `EXPO_PUBLIC_FIREBASE_DB_URL`, `EXPO_PUBLIC_FIREBASE_AUTH_URL`, and
`EXPO_PUBLIC_FIREBASE_TOKEN_URL` all to `http://localhost:9000` (any API key works). On a real phone use your computer's
address on the wifi instead of `localhost`.

## What stays on the phone

Appearance (light or dark), the Face ID switch, the demo tour, recent searches, and the signed-in
session (in SecureStore: the tokens and a copy of the user record) stay on the phone. Everything else is in the database. See
[data-model.md](data-model.md).
