import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getUser,
  getTestAccounts,
  registerOwnerAccount,
  registerTenantAccount,
  setSessionUser,
} from '../util/http';
import { resetTo } from '../util/navigationRef';

const AuthContext = createContext(null);

// milestone 2 has no sign in yet (Firebase Auth comes next milestone), so "logging in" picks a test account
// from the users node and keeps only its id (plus a copy of the record so the app opens offline) on the phone
const account_key = 'rent_well_test_account';

// owners land on the existing dashboard and tenants get their own home
export function homeRouteFor(user) {
  return user && user.role === 'tenant' ? 'TenantHome' : 'Dashboard';
}

export function AuthProvider(props) {
  // restoring until the saved session has been read, then signed_in or signed_out
  const [status, setStatus] = useState('restoring');
  const [user, setUser] = useState(null);
  // set when the session ran out on its own, so the app opens on Login with a note instead of Welcome
  const [session_expired, setSessionExpired] = useState(false);

  // step 1: the data modules read who's signed in from here, so it changes together with the state
  function signIn(next_user) {
    setSessionUser(next_user);
    setUser(next_user);
    setStatus('signed_in');
    setSessionExpired(false);
    AsyncStorage.setItem(account_key, JSON.stringify(next_user)).catch((error) =>
      console.log('Could not save the test account', error),
    );
    return next_user;
  }

  useEffect(() => {
    // I sign in with the saved user right away so the app opens even offline, then check the session in the background
    async function restoreSession() {
      let saved = null;
      try {
        const text = await AsyncStorage.getItem(account_key);
        saved = text ? JSON.parse(text) : null;
      } catch (error) {
        console.log('Could not read the saved test account', error);
      }
      if (!saved || !saved.id) {
        setStatus('signed_out');
        return;
      }
      setSessionUser(saved);
      setUser(saved);
      setStatus('signed_in');
      try {
        const fresh = await getUser(saved.id);
        if (fresh) {
          setSessionUser(fresh);
          setUser(fresh);
          AsyncStorage.setItem(account_key, JSON.stringify(fresh)).catch(() => {});
        } else {
          // the record is gone (the database was reset), so this account can't be used anymore
          await AsyncStorage.removeItem(account_key).catch(() => {});
          setSessionUser(null);
          setUser(null);
          setStatus('signed_out');
          setSessionExpired(true);
          resetTo('Login');
        }
      } catch (error) {
        console.log('Could not check the saved test account', error.message);
      }
    }
    restoreSession();
  }, []);

  // the test account picker on Log In passes the account it picked
  async function login(account) {
    const fresh = await getUser(account.id);
    if (!fresh) {
      throw new Error('That test account is gone. Pull to refresh the list.');
    }
    return signIn(fresh);
  }

  // fields: name, email (no password until Firebase Auth)
  async function registerOwner(fields) {
    return signIn(await registerOwnerAccount(fields));
  }

  // fields: invite_code, email, name
  async function registerTenant(fields) {
    return signIn(await registerTenantAccount(fields));
  }

  async function logout() {
    try {
      await AsyncStorage.removeItem(account_key);
    } catch (error) {
      console.log('Could not clear the saved test account', error);
    }
    setSessionUser(null);
    setUser(null);
    setStatus('signed_out');
    setSessionExpired(false);
  }

  const value = {
    status,
    user,
    session_expired,
    role: user ? user.role : null,
    login,
    registerOwner,
    registerTenant,
    logout,
    loadTestAccounts: getTestAccounts,
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

// screens call this for the signed-in user and the login and logout actions
export function useAuth() {
  return useContext(AuthContext);
}
