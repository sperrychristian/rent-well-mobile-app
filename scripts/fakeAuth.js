// an in-memory stand-in for the Firebase Auth REST API, shared by the local server (scripts/fakeFirebase.mjs)
// and the tests (the fake fetch in scripts/fakeDatabase.js routes auth urls here)
// it answers accounts:signUp, accounts:signInWithPassword, and the token refresh with the real shapes,
// including the real error bodies ({ error: { code, message, status } }), and it can say whether an ID token
// it gave out is still good, which is what --require-auth checks on every database request

function randomText(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let index = 0; index < length; index++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function failure(message, status) {
  return {
    status: status || 400,
    body: { error: { code: status || 400, message: message, status: 'INVALID_ARGUMENT' } },
  };
}

const email_shape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// settings: token_lifetime_s (3600 like the real one, the tests use a short one), api_key (any key works if blank)
export function createFakeAuth(settings) {
  const options = settings || {};
  const state = {
    token_lifetime_s: Number(options.token_lifetime_s || 3600),
    // a test can make the next answer fail with any Firebase code
    next_error: null,
  };
  const accounts = new Map();
  const id_tokens = new Map();
  const refresh_tokens = new Map();
  const counts = { signUp: 0, signInWithPassword: 0, token: 0 };

  function issue(local_id, refresh_token) {
    const id_token = 'fake-id-' + randomText(32);
    id_tokens.set(id_token, {
      local_id: local_id,
      expires_at: Date.now() + state.token_lifetime_s * 1000,
    });
    const refresh = refresh_token || 'fake-refresh-' + randomText(32);
    refresh_tokens.set(refresh, local_id);
    return { id_token, refresh_token: refresh };
  }

  // makes an account without a request, for the tests' signed-in starts
  function addAccount(email, password, local_id) {
    const key = email.toLowerCase();
    const existing = accounts.get(key);
    if (existing) {
      return existing.local_id;
    }
    const id = local_id || randomText(28);
    accounts.set(key, { local_id: id, email: key, password: password, disabled: false });
    return id;
  }

  // a full session for an account, the shape util/auth.js hands back
  function sessionFor(email) {
    const account = accounts.get(email.toLowerCase());
    const tokens = issue(account.local_id);
    return {
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      localId: account.local_id,
      expiresAt: id_tokens.get(tokens.id_token).expires_at,
    };
  }

  function signedIn(account) {
    const tokens = issue(account.local_id);
    return {
      status: 200,
      body: {
        kind: 'identitytoolkit#VerifyPasswordResponse',
        localId: account.local_id,
        email: account.email,
        displayName: '',
        idToken: tokens.id_token,
        registered: true,
        refreshToken: tokens.refresh_token,
        expiresIn: String(state.token_lifetime_s),
      },
    };
  }

  function signUp(body) {
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const password = String(body.password || '');
    if (!email) {
      return failure('MISSING_EMAIL');
    }
    if (!email_shape.test(email)) {
      return failure('INVALID_EMAIL');
    }
    if (!password) {
      return failure('MISSING_PASSWORD');
    }
    if (password.length < 6) {
      return failure('WEAK_PASSWORD : Password should be at least 6 characters');
    }
    if (accounts.has(email)) {
      return failure('EMAIL_EXISTS');
    }
    addAccount(email, password);
    return signedIn(accounts.get(email));
  }

  function signIn(body) {
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      return failure('INVALID_EMAIL');
    }
    if (!body.password) {
      return failure('MISSING_PASSWORD');
    }
    const account = accounts.get(email);
    if (!account || account.password !== body.password) {
      return failure('INVALID_LOGIN_CREDENTIALS');
    }
    if (account.disabled) {
      return failure('USER_DISABLED');
    }
    return signedIn(account);
  }

  function refresh(body) {
    if (body.grant_type !== 'refresh_token') {
      return failure('INVALID_GRANT_TYPE');
    }
    if (!body.refresh_token) {
      return failure('MISSING_REFRESH_TOKEN');
    }
    const local_id = refresh_tokens.get(body.refresh_token);
    if (!local_id) {
      return failure('INVALID_REFRESH_TOKEN');
    }
    const tokens = issue(local_id, body.refresh_token);
    return {
      status: 200,
      body: {
        access_token: tokens.id_token,
        expires_in: String(state.token_lifetime_s),
        token_type: 'Bearer',
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        user_id: local_id,
        project_id: 'rent-well-fake',
      },
    };
  }

  // pathname like /v1/accounts:signUp or /v1/token, query has the key, body is already parsed
  function handle(pathname, query, body) {
    if (options.api_key && query.get('key') !== options.api_key) {
      return failure('API key not valid. Please pass a valid API key.');
    }
    const mode = pathname.endsWith('/v1/token') ? 'token' : pathname.split('accounts:')[1];
    if (!mode || !(mode in counts)) {
      return { status: 404, body: { error: { code: 404, message: 'NOT_FOUND' } } };
    }
    counts[mode]++;
    if (state.next_error) {
      const code = state.next_error;
      state.next_error = null;
      return failure(code);
    }
    const data = body || {};
    if (mode === 'signUp') {
      return signUp(data);
    }
    if (mode === 'signInWithPassword') {
      return signIn(data);
    }
    return refresh(data);
  }

  // what --require-auth asks: did I give out this ID token, and is it still good
  function isValidToken(token) {
    const found = token ? id_tokens.get(token) : null;
    return !!found && found.expires_at > Date.now();
  }

  return {
    handle,
    isValidToken,
    addAccount,
    sessionFor,
    counts,
    // makes every ID token already given out run out right now
    expireTokens: () => id_tokens.forEach((value) => (value.expires_at = 0)),
    // throws away every refresh token for an account, like deleting the user in the console
    revokeRefresh: (local_id) => {
      refresh_tokens.forEach((value, key) => {
        if (value === local_id) {
          refresh_tokens.delete(key);
        }
      });
    },
    failNext: (code) => {
      state.next_error = code;
    },
    setTokenLifetime: (seconds) => {
      state.token_lifetime_s = Number(seconds);
    },
    accountFor: (email) => accounts.get(String(email).toLowerCase()) || null,
    reset: () => {
      accounts.clear();
      id_tokens.clear();
      refresh_tokens.clear();
    },
  };
}
