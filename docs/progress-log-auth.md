# Progress log: Assignment 12, authentication

Branch `assignment-12-auth`, built off `master` at `3821765`.

## Setup
- Master was green before starting: lint 0 errors (the 5 known warnings), 841 tests in 74 suites, format check clean, iOS bundle with `--clear` exported.
- `.env` already had the database address and an empty API key line. I filled the key in and added `SEED_ACCOUNT_PASSWORD` (generated, kept only in `.env`). `.env` is in `.gitignore` (`git check-ignore .env` prints it).
- `expo-secure-store` reinstalled with `npx expo install` (57.0.4). Its config plugin is in `app.json` with `configureAndroidBackup` on and the same Face ID sentence the lock already uses, so the plugin doesn't swap in its default wording.

## Phase 1: auth helpers and config
- `constants/config.js`: `firebaseAuthUrl()` and `firebaseTokenUrl()`, the real Google servers unless `EXPO_PUBLIC_FIREBASE_AUTH_URL` or `EXPO_PUBLIC_FIREBASE_TOKEN_URL` points somewhere else (the tests and the local fake).
- `util/auth.js`: the lecture's `authenticate(mode, email, password)` with `createUser` and `login`, plus `refreshSession`. It returns `{ idToken, refreshToken, localId, expiresAt }`, has a 10 second limit, one `AuthError` with a friendly message per code, and `authErrorMessage(code)`.
- `scripts/fakeAuth.js`: a fake identity toolkit with the real answer and error shapes, shared by the tests and the local server.
- Tests: `util/auth.test.js` (success, every mapped code, an unknown code, a body that isn't JSON, no network, a timeout, a missing key, nothing secret in an error).

## Phase 2: state and storage
- `store/AuthContext.js` is built around the token now: `token`, `localId`, `isAuthenticated`, `authenticate(session)`, `refresh`, `login(email, password)`, `registerOwner`, `registerTenant`, `logout`, and the old `status`, `user`, `role`, `session_expired`, `homeRouteFor`. A new `opens_on_login` makes the app come back on Login after a log out.
- `util/sessionStorage.js` saves the session (`idToken`, `refreshToken`, `localId`, `expiresAt`, and a copy of the user) under `rent_well_auth_session` (`util/storageKeys.js`), in SecureStore on a phone and in AsyncStorage on the web render and in the tests.
- `util/authToken.js` is the small module between AuthContext and `util/http.js`: the current token, the refresh function AuthContext hands over, a 5 minute margin, and one shared refresh when two requests need it at once.
- `util/http.js` adds `?auth=TOKEN` to every request (`withAuth`), refreshes first when the token is close to running out, and retries a 401 or 403 exactly once after a refresh. A rejected refresh signs out and goes to Login with the session note. A refresh that fails on the network keeps the session.
- `util/data/users.js`: `getUserByAuth(localId)` reads `authLinks`, `createOwnerProfile` and `createTenantProfile` key the new record by the localId and write `authLinks` and `authUid` in the same PATCH. The test account list (`getTestAccounts`, `noAccountError`) is gone.
- Sign up recovery: when the profile write fails the person sees that their account exists but the profile didn't save, and signing up again with the same email and password signs in to that account and finishes the profile.
- App lock: logging out drops a lock that was waiting.
- Decision: a 401 that comes back again after a refresh that worked fails with the permission message but doesn't sign out (that would be a rules problem, and signing out would just loop). A refresh that is turned down does sign out.
- Tests: `store/AuthContext.test.js` (17 cases), `util/sessionStorage.test.js`. Rewritten because they used the test account picker: the `accounts` block in `store/firebaseProviders.test.js` (two tests), `util/data/users.test.js`, and the Log In test in `navigation/firebaseFlows.test.js` (skipped until the new screen in phase 4). The other tests that saved `rent_well_test_account` now call `signInAs` from `scripts/testing/fakeFirebase.js`.

## Phase 3: fake server, seed script, database rules
- `scripts/fakeFirebase.mjs` answers the fake Auth on the same port (`/v1/accounts:signUp`, `/v1/accounts:signInWithPassword`, `/v1/token`). `--require-auth` turns away any database request without a token it gave out (401), and `--token-lifetime=60` makes tokens run out fast. Without the flags it acts like before.
- `scripts/seedRunner.js` holds the seed's work so the tests can run it. Every seeded user gets an Auth account (signUp, or a sign in when it's already there) with `SEED_ACCOUNT_PASSWORD`, then `authLinks` and `authUid` are written, all with Taylor's token as `?auth=`. It won't run without the password and prints a table of emails only.
- Decision: the seed now writes record by record (one multi-path PATCH per node) instead of PUT on each whole node, so a second run leaves accounts and records made in the app alone. `reminders` is still written whole because its seeded id comes from the send time.
- `scripts/seedFirebase.mjs` is now the command line wrapper. A local `--url` makes the accounts on the same local fake, `--auth-url=` picks another one, and the real database always uses Google's Auth.
- `database.rules.json`: `.read` and `.write` are `auth != null`. The old open rules and the reason per-user rules come next are in `docs/database-rules-test-mode.md`.
- Real Firebase from this machine: signUp and signInWithPassword both answered 200 for a throwaway `authcheck+<time>@example.com` (deleted after), a wrong password answered `INVALID_LOGIN_CREDENTIALS`, and the refresh worked. The database answered with and without a token, so the published rules are still open.
- Seeded the real project (no `--reset`): 8 accounts made, every node passed `firebase:check`, and the records made in the app earlier were kept (3 work orders, 1 expense, 1 charge).
- Tests: `scripts/seedRunner.test.js` (accounts and links with auth required, twice in a row, app records kept, a different password, no password, the email table).

## Phase 4: screens
- `components/Auth/` in the lecture's shape: `AuthContent` (credentialsInvalid, submitHandler, the links with `navigation.replace`), `AuthForm` (the typed values, `updateInputValueHandler`, Next and Done moving the focus), `AuthInput` (the lecture's props on top of `components/forms/Input`, with the show and hide eye for passwords, and `autoComplete` and `textContentType` set for iOS password managers), and `LoadingOverlay` (the app's own `ScreenState` loading on a sheet over the form, so what was typed stays).
- `LoginScreen`, `RegisterOwnerScreen`, `RegisterTenantScreen` follow the lecture: `isAuthenticating`, "Logging in..." or "Creating user...", and AuthContent below. Route names, titles, button labels (Log In, Create Account, Join) and the links between them stayed. The test account picker and the "no password yet" notes are gone.
- Every message sits under its box: the email shape, 8 character passwords, the confirm email and confirm password, the name, and the invite code. Server failures show on a line at the top (an alert for screen readers), and the ones that belong to a box (email taken, weak password, an invite code that doesn't work) show under it too. The raw Firebase codes never show.
- With no API key (or no database address) in `.env` the three screens show one setup message and send nothing.
- A double tap can't send two requests (a ref flips before the state does, and the button is disabled while busy).
- `features/auth/utils/authValidation.js`: the 8 character rule, `checkConfirmEmail`, `checkConfirmPassword`, `serverFieldErrors`. `features/auth/utils/authErrors.js` picks the words for a failure. `features/auth/components/SubmitButton.js` is removed (only the old screens used it).
- Tests: `features/auth/screens/authScreens.test.js` (19 cases), and the Log In test in `navigation/firebaseFlows.test.js` is back on with email and password.

## Phase 5: require an account everywhere
- `App.js`: signed out (no account and no demo) only registers Welcome, Pick a Demo Role, Log In, Landlord Sign Up, and Tenant Sign Up. Main (the drawer and tabs) and every detail screen sit in one `has_account_screens` group. Logging in or starting the demo changes `navigator_key`, which starts the navigator over with the rest registered, so the auth screens don't reset to a home themselves anymore.
- `util/navigationRef.js`: `routeWhileSignedOut` sends a link or push to a private screen to Login while signed out.
- Log out: `opens_on_login` is set in the same update as the sign out, so the fresh navigator opens on Login with nothing to go back to. The providers are keyed by the user, so they start over empty and the next account never sees the last one's lists.
- The drawer has an Account section with a Log Out row for both roles (`LogoutButton as_row`), and in the demo the same row says Exit Demo and leaves the demo. Settings and the homes keep their Log Out button.
- `navigation/navigationMap.js`: the homes' "Log Out or Exit Demo" edge is now two edges (Log Out to Login, Exit Demo to Welcome), and Settings' Log Out goes to Login. The screen count is still 35.
- No provider fetches before there's a token: the token is set before the user, and signed out makes no database calls at all (tested).
- Tests: `navigation/authFlows.test.js` (8 cases through the real navigators with the database requiring auth: the signed-out screens, a private link going to Login, no calls before a token, a new landlord's whole story with a relaunch, log out clearing the last account, a tenant sign up, a quiet refresh at launch, and Taylor's work orders, payments, and messages).

## Visual QA (web render in a scratch copy, outside the repo)
- The fake server ran with `--require-auth` and was seeded with the seed script. A copy of the app with `react-native-web` (only in the copy) was pointed at it and driven with headless Chrome: Log In, Landlord Sign Up, and Tenant Sign Up (empty, errors, filled, loading, server error), then a signed-in pass as Taylor (dashboard and drawer) and as Sam (home), at 360x640, 390x844, and 1024x1366, light and dark. 78 screenshots, no page errors.
- Fixed: the drawer showed two "Account" headers (Settings already sits in an Account section), so the Log Out row now sits right under Settings without its own header.
- Fixed: a box kept its error after you typed in it. Editing a box now clears its own message (from the phone's check or from the server), and the other boxes keep theirs. Test added.
- Checked and fine: the 8 character hint, the eye button (44pt, next to the box like the date picker's button), the loading overlay at every size, the tablet drawer with Log Out, and the web fallback keeping the session (a reload opened signed in).
