# Firebase setup for Rent Well

Rent Well uses one Firebase **Realtime Database** (not Firestore) as its only backend, through the REST
endpoints. These steps take about ten minutes. You need a Google account and Node installed.

## Create the database

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**.
   Give it a name (for example `rent-well`). Google Analytics is optional, you can turn it off.
2. In the left menu open **Build**, then **Realtime Database**, then click **Create Database**.
3. Pick the location closest to you and click **Next**.
4. Choose **Start in test mode** and click **Enable**. Test mode lets anyone read and write for 30 days,
   which is fine for class testing. Next milestone adds Firebase Auth and real rules.
5. At the top of the **Data** tab you'll see the database address. It looks like
   `https://your-project-default-rtdb.firebaseio.com`. Copy it.

## Connect the app

6. In the project folder, copy the example settings file:

   ```bash
   cp .env.example .env
   ```

7. Open `.env` and paste your address after `EXPO_PUBLIC_FIREBASE_DB_URL=`, with no slash at the end:

   ```
   EXPO_PUBLIC_FIREBASE_DB_URL=https://your-project-default-rtdb.firebaseio.com
   EXPO_PUBLIC_FIREBASE_API_KEY=
   ```

   Leave the API key blank for now. It's only saved for next milestone's sign in.
   `.env` is in `.gitignore`, so the address stays on your computer and never goes into git.

8. Check that git ignores it. This should print `.env`:

   ```bash
   git check-ignore .env
   ```

## Publish the rules

9. In the Firebase console open **Realtime Database**, then the **Rules** tab.
10. Replace what's there with the contents of `database.rules.json` from the project folder and click
    **Publish**. (These are the test mode rules. The app filters on the phone instead of using REST
    queries, so no `.indexOn` entries are needed.)

## Fill it with sample data

11. Seed the database with the same story the demo tells (Taylor Brooks, two properties, six tenants
    including a roommate and a former tenant, leases, three months of rent, work orders, expenses,
    trips, messages, invites, checklists, and documents):

    ```bash
    npm run firebase:seed
    ```

    Add `-- --reset` to wipe the database first. The script only writes to the address in `.env` (or a
    local address), and running it again gives the same data.

12. Check every node made it:

    ```bash
    npm run firebase:check
    ```

    Each node should print `PASS`. You can also look at the data in the console's **Data** tab.

## Run the app

13. Start Expo with a clean cache so it picks up `.env`:

    ```bash
    npx expo start -c
    ```

14. Open it in Expo Go or a simulator, tap **Log In**, and pick a test account:
    - **Taylor Brooks** (landlord, has everything)
    - **Sam Rivera** (tenant at 123 Maple St, Unit 2)
    - **Morgan Diaz** (former tenant, read only)
    - **Jamie Ortiz** (landlord with no data, for the empty screens)

    To try tenant sign up, tap **I have an invite code** and use `K7M2QX9P`.

## If something goes wrong

- **"The database address is missing"**: `.env` is missing or the line is misspelled. Fix it, then
  restart with `npx expo start -c`.
- **"The database turned this away"**: the rules weren't published, or test mode ran out after 30
  days. Publish `database.rules.json` again.
- **"Can't reach the database"**: check your internet. On a phone, Expo Go needs to be online too.
- **No test accounts on Log In**: run `npm run firebase:seed`.

## Trying it with no Firebase project

`npm run firebase:fake` starts a small local copy of the REST API on port 9000 (it keeps data in
memory only). Seed it with `npm run firebase:seed -- --url=http://localhost:9000`, and set
`EXPO_PUBLIC_FIREBASE_DB_URL=http://localhost:9000` in `.env`. On a real phone use your computer's
address on the wifi instead of `localhost`.

## What stays on the phone

Appearance (light or dark), the Face ID switch, the demo tour, recent searches, and the signed-in test
account's id stay on the phone. Everything else is in the database. See
[data-model.md](data-model.md).
