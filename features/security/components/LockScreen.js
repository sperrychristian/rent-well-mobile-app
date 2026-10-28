import { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Wordmark from '../../../components/ui/Wordmark';
import Button from '../../../components/ui/Button';
import {
  biometricSupport,
  unlockWithDevice,
  cannotCheck,
  countsAsFailure,
} from '../utils/biometrics';
import { failures_before_logout } from '../utils/lockRules';
import { SPACING, TYPE, SIZES } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// the lock screen in the Hearth look: the wordmark on paper, one quiet line, the green Unlock pill,
// "Use Passcode" under it, and Log Out as plain text at the bottom
// it asks once on its own when it appears, then waits for a tap so a cancel doesn't loop the prompt
// props: ready (false while the app is still deciding, the buttons stay hidden), onUnlocked, onLogout
function LockScreen(props) {
  const insets = useSafeAreaInsets();
  const [label, setLabel] = useState('Face ID or Touch ID');
  const [failures, setFailures] = useState(0);
  const [busy, setBusy] = useState(false);
  const asked_once = useRef(false);

  useEffect(() => {
    let active = true;
    biometricSupport().then((support) => {
      if (active) {
        setLabel(support.label);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function tryUnlock(prompt) {
    setBusy(true);
    const result = await unlockWithDevice(prompt);
    setBusy(false);
    // the phone can't check anyone (no passcode set, nothing enrolled), so it never keeps them out
    if (result.success || cannotCheck(result.error)) {
      props.onUnlocked();
      return;
    }
    if (countsAsFailure(result.error)) {
      setFailures((current) => current + 1);
    }
  }

  // the first ask happens by itself, like opening a banking app
  const ready = props.ready;
  const try_ref = useRef(tryUnlock);
  useEffect(() => {
    try_ref.current = tryUnlock;
  });
  useEffect(() => {
    if (ready && !asked_once.current) {
      asked_once.current = true;
      try_ref.current('Unlock Rent Well');
    }
  }, [ready]);

  const trouble = failures >= failures_before_logout;

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + SPACING.xxl, paddingBottom: insets.bottom + SPACING.lg },
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.middle}>
        <Wordmark size="medium" tagline={null} />
        <Text style={styles.line}>Locked to keep your rentals private.</Text>
        {trouble ? (
          <Text style={styles.trouble} accessibilityLiveRegion="polite">
            {
              "That didn't work a few times. You can log out and sign in with your password instead."
            }
          </Text>
        ) : null}
      </View>
      {ready ? (
        <View style={styles.actions}>
          <Button
            title={busy ? 'Checking...' : 'Unlock with ' + label}
            icon="lock-open-outline"
            variant="primary"
            loading={busy}
            onPress={busy ? undefined : () => tryUnlock('Unlock Rent Well')}
          />
          <Button
            title="Use Passcode"
            variant="tertiary"
            onPress={busy ? undefined : () => tryUnlock('Enter your passcode to unlock Rent Well')}
            accessibilityHint="Opens the phone's own unlock, where you can type your passcode"
          />
          <Button
            title="Log Out"
            icon="log-out-outline"
            variant={trouble ? 'secondary' : 'tertiary'}
            onPress={props.onLogout}
            style={styles.logout}
          />
        </View>
      ) : null}
    </View>
  );
}

export default LockScreen;

const styles = themedStyles((COLORS) => ({
  // covers the whole app on the paper color
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.screen_padding,
    justifyContent: 'space-between',
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    ...TYPE.body,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  trouble: {
    ...TYPE.body,
    color: COLORS.danger_text,
    textAlign: 'center',
    marginTop: SPACING.md,
    maxWidth: SIZES.content_max_width,
  },
  actions: {
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    gap: SPACING.sm,
  },
  logout: {
    marginTop: SPACING.md,
  },
}));
