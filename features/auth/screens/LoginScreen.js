import { useState, useEffect, useCallback } from 'react';
import { Text, Pressable, View } from 'react-native';
import AuthLayout from '../components/AuthLayout';
import ListRow from '../../../components/ui/ListRow';
import ScreenState from '../../../components/ui/ScreenState';
import { useAuth, homeRouteFor } from '../../../store/AuthContext';
import { isFirebaseConfigured } from '../../../util/http';
import { SPACING, TYPE, SIZES } from '../../../constants/theme';
import { themedStyles } from '../../../util/themedStyles';

// milestone 2: there's no real sign in yet, so Log In lists the test accounts in the database and you pick one
// (Firebase Auth replaces this next milestone, the screen keeps its route name so navigation doesn't change)
function LoginScreen(props) {
  const { login, session_expired, loadTestAccounts } = useAuth();
  // expired is set when the app sent someone here because their session ran out
  // it comes from the auth context now, so only ids ever travel as route params
  const expired = session_expired;

  const [accounts, setAccounts] = useState([]);
  // loading, ready, or error for the list of test accounts
  const [status, setStatus] = useState(isFirebaseConfigured() ? 'loading' : 'error');
  const [load_error, setLoadError] = useState(
    isFirebaseConfigured()
      ? ''
      : 'The database address is missing. Add EXPO_PUBLIC_FIREBASE_DB_URL to .env, then restart Expo with npx expo start -c.',
  );
  const [server_error, setServerError] = useState(
    expired ? 'That test account is gone from the database. Pick another one.' : '',
  );
  const [busy_id, setBusyId] = useState(null);

  // step 1: read every test account from the users node
  const loadAccounts = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      return;
    }
    setStatus('loading');
    try {
      setAccounts(await loadTestAccounts());
      setStatus('ready');
      setLoadError('');
    } catch (error) {
      setLoadError(error.message);
      setStatus('error');
    }
  }, [loadTestAccounts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the list when the screen opens is the point
    loadAccounts();
  }, [loadAccounts]);

  // step 2: picking one signs in as it
  async function handlePick(account) {
    setBusyId(account.id);
    setServerError('');
    try {
      const user = await login(account);
      // reset so back can't return to the login form
      props.navigation.reset({ index: 0, routes: [{ name: homeRouteFor(user) }] });
    } catch (error) {
      setServerError(error.message);
      setBusyId(null);
    }
  }

  const landlords = accounts.filter((account) => account.role === 'owner');
  const tenants = accounts.filter((account) => account.role === 'tenant');

  function accountRow(account, index, list) {
    return (
      <ListRow
        key={account.id}
        avatar_name={account.name}
        title={account.name}
        subtitle={busy_id === account.id ? 'Signing in...' : account.email}
        chevron
        divider={index < list.length - 1}
        onPress={busy_id ? undefined : () => handlePick(account)}
        accessibilityLabel={
          'Sign in as ' + account.name + ', ' + (account.role === 'owner' ? 'landlord' : 'tenant')
        }
      />
    );
  }

  return (
    <AuthLayout
      title="Test Accounts"
      subtitle="Pick an account to sign in as. Real sign in with a password comes with Firebase Auth next milestone."
      error={server_error}
      footer={
        <View style={styles.links}>
          <Pressable
            onPress={() => props.navigation.navigate('RegisterOwner')}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.link_press}
          >
            <Text style={styles.link}>New landlord? Create a test account</Text>
          </Pressable>
          <Pressable
            onPress={() => props.navigation.navigate('RegisterTenant')}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.link_press}
          >
            <Text style={styles.link}>I have an invite code</Text>
          </Pressable>
        </View>
      }
    >
      {/* the clear label the brief asks for: this is a picker, not a sign in form */}
      <Text style={styles.heading} accessibilityRole="header">
        Test accounts
      </Text>
      {status === 'loading' ? <ScreenState status="loading" label="Loading test accounts" /> : null}
      {status === 'error' ? (
        <ScreenState
          status="error"
          title="Couldn't load the test accounts"
          message={load_error}
          onRetry={isFirebaseConfigured() ? loadAccounts : undefined}
        />
      ) : null}
      {status === 'ready' && accounts.length === 0 ? (
        <ScreenState
          status="empty"
          icon="people-outline"
          title="No test accounts yet"
          message="Seed the database with npm run firebase:seed, or create a landlord account below."
          action_label="Try Again"
          onAction={loadAccounts}
        />
      ) : null}
      {status === 'ready' && landlords.length > 0 ? (
        <View>
          <Text style={styles.section} accessibilityRole="header">
            Landlords
          </Text>
          {landlords.map(accountRow)}
        </View>
      ) : null}
      {status === 'ready' && tenants.length > 0 ? (
        <View>
          <Text style={styles.section} accessibilityRole="header">
            Tenants
          </Text>
          {tenants.map(accountRow)}
        </View>
      ) : null}
    </AuthLayout>
  );
}

export default LoginScreen;

const styles = themedStyles((COLORS) => ({
  links: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  // each link is a full 44pt tall row so it's easy to tap
  link_press: {
    minHeight: SIZES.touch,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  link: {
    ...TYPE.subheading,
    color: COLORS.cta,
    textAlign: 'center',
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
  },
  section: {
    ...TYPE.label,
    color: COLORS.text_muted,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
}));
