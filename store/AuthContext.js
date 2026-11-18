import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  getUserByAuth,
  createOwnerProfile,
  createTenantProfile,
  setSessionUser,
} from '../util/http';
import {
  createUser,
  login as signInWithPassword,
  refreshSession,
  AuthError,
  isRejectedRefresh,
} from '../util/auth';
import { saveSession, readSession, clearSession } from '../util/sessionStorage';
import {
  setAuthToken,
  clearAuthToken,
  setTokenRefresher,
  needsRefresh,
  forceRefresh,
} from '../util/authToken';
import { resetTo } from '../util/navigationRef';

const AuthContext = createContext(null);

// assignment 12: the token lives here (app-wide state), the lecture's AuthContext had token, isAuthenticated,
// authenticate(token) and logout(), this one keeps those and adds the user record, the refresh, and the restore
// the session saved on the phone is { idToken, refreshToken, localId, expiresAt, user }, util/sessionStorage.js

// owners land on the existing dashboard and tenants get their own home
export function homeRouteFor(user) {
  return user && user.role === 'tenant' ? 'TenantHome' : 'Dashboard';
}

// the database failures that mean a sign up made the Firebase account but its profile didn't save
const profile_save_failures = [
  'NETWORK_ERROR',
  'TIMEOUT',
  'SERVER_ERROR',
  'PERMISSION_DENIED',
  'BAD_REQUEST',
  'NOT_CONFIGURED',
];

export function AuthProvider(props) {
  // restoring until the saved session has been read, then signed_in or signed_out
  const [status, setStatus] = useState('restoring');
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  // set when the session ran out on its own, so the app opens on Login with a note instead of Welcome
  const [session_expired, setSessionExpired] = useState(false);
  // set by log out, so the app comes back on Login instead of Welcome
  const [opens_on_login, setOpensOnLogin] = useState(false);
  // the newest session for the refresh, which can run from util/http.js at any moment
  const session_ref = useRef(null);

  // step 1: the data modules read who's signed in from here, so it changes together with the state
  // the token goes to util/http.js and the user to the data modules before the state changes,
  // so no provider ever loads without them
  function applySession(next) {
    session_ref.current = next;
    setAuthToken(next.idToken, next.expiresAt);
    setSessionUser(next.user);
    setSession(next);
    setUser(next.user);
    setStatus('signed_in');
    setSessionExpired(false);
    setOpensOnLogin(false);
    saveSession(next).catch(() => console.log('Could not save the session on this phone'));
    return next.user;
  }

  // the lecture's authenticate: takes a session (with its user) and signs in with it
  function authenticate(next) {
    return applySession(next);
  }

  // forgets everything in memory and on the phone, expired says whether Login shows the "session ended" note
  async function signOutLocal(expired) {
    session_ref.current = null;
    clearAuthToken();
    setSessionUser(null);
    setSession(null);
    setUser(null);
    setStatus('signed_out');
    setSessionExpired(expired);
    await clearSession();
  }

  // step 2: trade the refresh token for a new ID token, util/http.js calls this through util/authToken.js
  // turned down for good means sign out and go to Login with the note, a network failure keeps the session
  async function refresh() {
    const saved = session_ref.current;
    if (!saved) {
      throw new AuthError('TOKEN_EXPIRED');
    }
    try {
      const fresh = await refreshSession(saved.refreshToken);
      const next = { ...saved, ...fresh, localId: saved.localId };
      session_ref.current = next;
      setAuthToken(next.idToken, next.expiresAt);
      setSession(next);
      saveSession(next).catch(() => console.log('Could not save the refreshed session'));
      return next.idToken;
    } catch (error) {
      if (isRejectedRefresh(error) && session_ref.current === saved) {
        await signOutLocal(true);
        resetTo('Login');
      }
      throw error;
    }
  }

  // the refresh function always reads the newest session from the ref, so handing it over once is enough
  const refresh_ref = useRef(refresh);
  useEffect(() => {
    refresh_ref.current = refresh;
  });
  useEffect(() => {
    setTokenRefresher(() => refresh_ref.current());
    return () => setTokenRefresher(null);
  }, []);

  useEffect(() => {
    // I sign in with the saved user right away so the app opens even offline, then check the session in the background
    async function restoreSession() {
      const saved = await readSession();
      if (!saved || !saved.user || !saved.user.id) {
        setStatus('signed_out');
        return;
      }
      applySession(saved);
      // an hour old token gets refreshed now, a network failure just waits for the next request
      if (needsRefresh(saved.expiresAt)) {
        try {
          await forceRefresh();
        } catch (error) {
          if (isRejectedRefresh(error)) {
            return;
          }
        }
      }
      try {
        const fresh = await getUserByAuth(saved.localId);
        if (session_ref.current === null) {
          return;
        }
        if (fresh) {
          applySession({ ...session_ref.current, user: fresh });
        } else {
          // the record is gone (the database was reset), so this account can't be used anymore
          await signOutLocal(true);
          resetTo('Login');
        }
      } catch (error) {
        console.log('Could not check the saved account', error.message);
      }
    }
    restoreSession();
  }, []);

  // the user record for a fresh Firebase session, read with that session's token
  // (the token is only in memory until the profile checks out, nothing is saved yet)
  async function profileFor(fresh) {
    setAuthToken(fresh.idToken, fresh.expiresAt);
    try {
      return await getUserByAuth(fresh.localId);
    } catch (error) {
      clearAuthToken();
      throw error;
    }
  }

  // step 3: log in with email and password, then find the account's Rent Well profile through authLinks
  async function login(email, password) {
    const fresh = await signInWithPassword(email.trim(), password);
    const found = await profileFor(fresh);
    if (!found) {
      // a Firebase account with no link can't use the app, so it's signed out again right here
      clearAuthToken();
      throw new AuthError('NO_PROFILE');
    }
    return applySession({ ...fresh, user: found });
  }

  // sign up makes the Firebase account, and if the email already has one (a sign up whose profile didn't save),
  // the password they typed signs in to it so the profile can be finished instead of failing
  async function accountForSignUp(email, password) {
    try {
      return { fresh: await createUser(email, password), reused: false };
    } catch (error) {
      if (error.code !== 'EMAIL_EXISTS') {
        throw error;
      }
      try {
        return { fresh: await signInWithPassword(email, password), reused: true };
      } catch {
        // a different password means it's someone else's account, so it's just "email taken"
        throw error;
      }
    }
  }

  // makes the profile with the new account's token, and turns a failed save into the "finish it later" message
  async function finishSignUp(email, password, makeProfile) {
    const { fresh, reused } = await accountForSignUp(email, password);
    if (reused && (await profileFor(fresh))) {
      // that account already has a profile, so this is a log in, not a sign up
      clearAuthToken();
      throw new AuthError('EMAIL_EXISTS');
    }
    setAuthToken(fresh.idToken, fresh.expiresAt);
    let made;
    try {
      made = await makeProfile(fresh.localId);
    } catch (error) {
      clearAuthToken();
      if (error.code === 'EMAIL_TAKEN') {
        throw new AuthError('EMAIL_EXISTS');
      }
      if (profile_save_failures.includes(error.code)) {
        throw new AuthError('PROFILE_NOT_SAVED');
      }
      throw error;
    }
    return applySession({ ...fresh, user: made });
  }

  // fields: name, email, password
  async function registerOwner(fields) {
    const email = fields.email.trim();
    return finishSignUp(email, fields.password, (local_id) =>
      createOwnerProfile(local_id, { name: fields.name, email: email }),
    );
  }

  // fields: invite_code, name, email, password
  async function registerTenant(fields) {
    const email = fields.email.trim();
    return finishSignUp(email, fields.password, (local_id) =>
      createTenantProfile(local_id, {
        invite_code: fields.invite_code,
        name: fields.name,
        email: email,
      }),
    );
  }

  // step 4: log out forgets the token in memory and on the phone, and the app comes back on Login
  async function logout() {
    await signOutLocal(false);
    setOpensOnLogin(true);
  }

  const value = {
    status,
    user,
    session_expired,
    opens_on_login,
    role: user ? user.role : null,
    token: session ? session.idToken : null,
    localId: session ? session.localId : null,
    isAuthenticated: status === 'signed_in' && !!session,
    authenticate,
    refresh,
    login,
    registerOwner,
    registerTenant,
    logout,
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

// screens call this for the signed-in user and the login and logout actions
export function useAuth() {
  return useContext(AuthContext);
}
