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
