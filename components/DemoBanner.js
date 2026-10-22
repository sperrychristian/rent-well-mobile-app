import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { COLORS, SPACING, TYPE, RADIUS, SIZES, OPACITY } from '../theme';
import { themedStyles } from '../utils/themedStyles';

// shows a strip with an exit button, and only while the demo is running
// it also has the switch between the landlord and tenant sides, which keeps the same demo data
function DemoBanner() {
  const navigation = useNavigation();
  const { demo_mode, demo_role, exitDemo, switchDemoRole } = useWorkOrders();

  if (!demo_mode) {
    return null;
  }

  const is_tenant = demo_role === 'tenant';

  // I put the real data back first, then reset the stack so back can't return to the demo screens
  async function handleExit() {
    await exitDemo();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  }

  // App.js keys the navigator on the demo role, so this rebuilds the stack on the other side's home
  function handleSwitch() {
    switchDemoRole(is_tenant ? 'owner' : 'tenant');
  }

  return (
    // the design pass: a navy card with an amber edge and a Demo pill, so it reads as part of the app
    // and not as an error, with the two buttons side by side (they wrap when the text is big)
    // the fintech pass: a slim strip on the soft indigo tint, calm instead of a warning, Exit stays red
    // the Hearth pass: a thin forest green strip with white words and two text buttons, still impossible
    // to miss, but calm (no red block)
    <View style={styles.banner} accessibilityRole="summary">
      <View style={styles.top_row}>
        <Ionicons name="play-circle-outline" size={SIZES.icon} color={COLORS.on_cta} />
        <Text style={styles.text}>
          {(is_tenant ? 'Demo as Sam (tenant)' : 'Demo as the landlord') +
            ': sample data, nothing is saved'}
        </Text>
      </View>
      <View style={styles.button_row}>
        {/* the short label keeps both buttons on one row, the screen reader still hears which side it goes to */}
        <Pressable
          onPress={handleSwitch}
          hitSlop={SPACING.xs}
          accessibilityRole="button"
          accessibilityLabel={is_tenant ? 'Switch to Landlord view' : 'Switch to Tenant view'}
          style={({ pressed }) => [styles.text_button, pressed && styles.pressed]}
        >
          <Ionicons name="swap-horizontal-outline" size={SIZES.icon_small} color={COLORS.on_cta} />
          <Text style={styles.button_text}>Switch view</Text>
        </Pressable>
        <Pressable
          onPress={handleExit}
          hitSlop={SPACING.xs}
          accessibilityRole="button"
          accessibilityLabel="Exit Demo Mode"
          style={({ pressed }) => [styles.text_button, pressed && styles.pressed]}
        >
          <Ionicons name="exit-outline" size={SIZES.icon_small} color={COLORS.on_cta} />
          <Text style={[styles.button_text, styles.exit_text]}>Exit Demo Mode</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default DemoBanner;

const styles = themedStyles((COLORS) => ({
  banner: {
    width: '100%',
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    // same width cap as the screens under it on a tablet
    maxWidth: SIZES.content_max_width + SIZES.content_max_width / 4,
    alignSelf: 'center',
  },
  text: {
    ...TYPE.body_small,
    color: COLORS.on_cta,
    flex: 1,
  },
  top_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  button_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  text_button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: SIZES.touch,
  },
  pressed: {
    opacity: OPACITY.faint,
  },
  button_text: {
    ...TYPE.label,
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.on_cta,
  },
  // exit is the one thing people look for, so it's underlined
  exit_text: {
    textDecorationLine: 'underline',
  },
}));
