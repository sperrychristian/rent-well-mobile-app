import { createContext, useContext, useState, useEffect } from 'react';
import {
  api_client,
  login as loginRequest,
  registerOwner as registerOwnerRequest,
  registerTenant as registerTenantRequest,
  logoutSession,
} from '../../../services/api';
import { unregisterForPush } from '../../../services/push';
import { resetTo } from '../../../services/navigationRef';
import { clearAttachmentUrls } from '../../../services/attachmentUrls';

const AuthContext = createContext(null);

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

  useEffect(() => {
    // a refresh brings a fresh user, and a dead refresh token means logging in again
    const stop_listening = api_client.onSessionEvent((event_name, payload) => {
      if (event_name === 'session') {
        setUser(payload.user);
        setStatus('signed_in');
        setSessionExpired(false);
      } else if (event_name === 'expired') {
        setUser(null);
        setStatus('signed_out');
        setSessionExpired(true);
        resetTo('Login', { expired: true });
      }
    });

    // I sign in with the saved user right away so the app opens even offline, then check the session in the background
    async function restoreSession() {
      try {
        const stored = await api_client.loadStoredSession();
        if (!stored || !stored.user) {
          setStatus('signed_out');
          return;
        }
        setUser(stored.user);
        setStatus('signed_in');
        api_client.refreshSession().catch((error) => {
          console.log('Could not refresh the saved session', error.message);
        });
      } catch (error) {
        console.log('Could not read the saved session', error);
        setStatus('signed_out');
      }
    }
    restoreSession();

    return stop_listening;
  }, []);

  async function login(email, password) {
    const session = await loginRequest(email.trim(), password);
    return session.user;
  }

  async function registerOwner(fields) {
    const session = await registerOwnerRequest(fields);
    return session.user;
  }

  async function registerTenant(fields) {
    const session = await registerTenantRequest(fields);
    return session.user;
  }

  // the push token goes first so this phone stops getting pushes, and a failed request never blocks logging out
  async function logout() {
    await unregisterForPush();
    try {
      await logoutSession();
    } catch (error) {
      console.log('Could not reach the server to log out', error.message);
    }
    try {
      await api_client.clearSession();
    } catch (error) {
      console.log('Could not clear the saved session', error);
    }
    clearAttachmentUrls();
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
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

// screens call this for the signed-in user and the login and logout actions
export function useAuth() {
  return useContext(AuthContext);
}
