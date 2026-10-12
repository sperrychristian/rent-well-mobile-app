import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PrimaryButton from '../../../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../../../theme';

// only shows for a signed-in account, the demo has its own exit button in the banner
function LogoutButton(props) {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return null;
  }

  // logging out resets the stack so back can't return to the account's screens
  async function handleLogout() {
    setBusy(true);
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  }

  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: handleLogout },
    ]);
  }

  return (
    <PrimaryButton
      title={busy ? 'Logging out...' : 'Log Out'}
      icon="log-out-outline"
      text_color={COLORS.text_light}
      onPress={busy ? undefined : confirmLogout}
      style={[styles.button, props.style]}
    />
  );
}

export default LogoutButton;

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.secondary,
  },
});
