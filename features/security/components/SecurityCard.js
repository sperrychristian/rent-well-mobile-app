import { useState, useEffect } from 'react';
import { View, Text, Switch } from 'react-native';
import Card from '../../../components/Card';
import { useAppLock } from '../context/AppLockContext';
import { biometricSupport } from '../utils/biometrics';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// Settings, Security: the "Unlock with Face ID" switch, worded for whatever this phone has
// a phone with no Face ID or Touch ID set up gets a short line saying how to set it up instead of a switch
function SecurityCard() {
  const lock = useAppLock();
  // null while it's checking the phone, then { available, label }
  const [support, setSupport] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    biometricSupport().then((result) => {
      if (active) {
        setSupport(result);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function toggle(value) {
    setSaving(true);
    await lock.setEnabled(value);
    setSaving(false);
  }

  let body = null;
  if (support && support.available) {
    const switch_label = 'Unlock with ' + support.label;
    body = (
      <>
        <View style={styles.row}>
          <Text style={styles.body}>{switch_label}</Text>
          <Switch
            value={lock.enabled}
            onValueChange={saving ? undefined : toggle}
            disabled={saving || !lock.loaded}
            trackColor={{ false: COLORS.border_strong, true: COLORS.success }}
            accessibilityLabel={switch_label}
          />
        </View>
        <Text style={styles.detail}>
          {lock.enabled
            ? 'Rent Well asks when it opens and after a minute away. Saved on this phone.'
            : 'Ask for ' + support.label + ' when Rent Well opens and after a minute away.'}
        </Text>
      </>
    );
  } else if (support) {
    body = (
      <Text style={styles.detail}>
        {lock.enabled
          ? "Face ID and Touch ID aren't set up on this phone right now, so Rent Well asks for your passcode instead."
          : "This phone doesn't have Face ID or Touch ID set up. Turn one on in your phone's Settings to lock Rent Well with it."}
      </Text>
    );
  }

  return (
    <Card>
      <Text style={styles.heading}>Security</Text>
      {body}
    </Card>
  );
}

export default SecurityCard;

const styles = themedStyles((COLORS) => ({
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    minHeight: SIZES.touch,
  },
  body: {
    ...TYPE.body,
    color: COLORS.text,
    flex: 1,
  },
  detail: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginTop: SPACING.xs,
  },
}));
