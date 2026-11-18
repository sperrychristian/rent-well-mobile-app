import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import PrimaryButton from '../../../components/PrimaryButton';
import { useAuth } from '../../../store/AuthContext';
import { useWorkOrders } from '../../../store/WorkOrdersContext';
import { COLORS, SPACING, TYPE, BORDER, SIZES } from '../../../constants/theme';
import { themedStyles } from '../../../util/themedStyles';

// only shows for a signed-in account, the demo has its own exit button in the banner
// assignment 12: as_row draws it as a plain row for the bottom of the drawer, and that row also shows in the
// demo, where it just leaves the demo (same as Exit Demo Mode in the banner)
function LogoutButton(props) {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { demo_mode, exitDemo } = useWorkOrders();
  const [busy, setBusy] = useState(false);

  const leaves_demo = !!props.as_row && demo_mode && !user;
  if (!user && !leaves_demo) {
    return null;
  }

  // logging out resets the stack so back can't return to the account's screens
  // assignment 12: it lands on Login now (App.js opens the fresh navigator there too)
  async function handleLogout() {
    setBusy(true);
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  // the demo row puts the real data back first, then goes back to Welcome like the banner does
  async function handleLeaveDemo() {
    setBusy(true);
    await exitDemo();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  }

  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: handleLogout },
    ]);
  }

  if (props.as_row) {
    const label = leaves_demo ? 'Exit Demo' : 'Log Out';
    return (
      <Pressable
        onPress={busy ? undefined : leaves_demo ? handleLeaveDemo : confirmLogout}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: busy, disabled: busy }}
        testID="drawer-logout"
        style={({ pressed }) => [styles.row, pressed && styles.row_on, props.style]}
      >
        <Ionicons name="log-out-outline" size={SIZES.row_icon} color={COLORS.danger_text} />
        <Text style={styles.label} numberOfLines={1}>
          {busy ? (leaves_demo ? 'Leaving...' : 'Logging out...') : label}
        </Text>
      </Pressable>
    );
  }

  return (
    <PrimaryButton
      title={busy ? 'Logging out...' : 'Log Out'}
      icon="log-out-outline"
      // the design pass: an outlined secondary button, it's an exit and shouldn't look like the main action
      variant="secondary"
      loading={busy}
      onPress={busy ? undefined : confirmLogout}
      style={props.style}
    />
  );
}

export default LogoutButton;

// the drawer row matches the drawer's own rows: a line icon, the label, hairlines above and below
const styles = themedStyles((COLORS) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: SIZES.drawer_row,
    paddingHorizontal: SPACING.sm,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.hairline,
  },
  row_on: {
    backgroundColor: COLORS.surface_raised,
  },
  label: {
    ...TYPE.subheading,
    color: COLORS.danger_text,
    flex: 1,
  },
}));
