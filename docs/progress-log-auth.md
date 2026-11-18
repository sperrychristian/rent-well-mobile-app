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
