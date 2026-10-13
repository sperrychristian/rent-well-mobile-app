import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PrimaryButton from './PrimaryButton';
import StatusPill from './ui/StatusPill';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { COLORS, SPACING, TYPE, RADIUS, BORDER } from '../theme';

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
    <View style={styles.banner} accessibilityRole="summary">
      <View style={styles.top_row}>
        <StatusPill label="Demo" />
        <Text style={styles.text}>
          {(is_tenant ? 'Demo as Sam (tenant)' : 'Demo as the landlord') +
            ': sample data, nothing is saved'}
        </Text>
      </View>
      <View style={styles.button_row}>
        {/* the short label keeps both buttons on one row, the screen reader still hears which side it goes to */}
        <PrimaryButton
          title="Switch view"
          accessibilityLabel={is_tenant ? 'Switch to Landlord view' : 'Switch to Tenant view'}
          icon="swap-horizontal-outline"
          variant="secondary"
          size="small"
          onPress={handleSwitch}
          style={styles.switch_button}
        />
        <PrimaryButton
          title="Exit Demo Mode"
          icon="exit-outline"
          variant="destructive"
          size="small"
          onPress={handleExit}
          style={styles.exit_button}
        />
      </View>
    </View>
  );
}

export default DemoBanner;

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    backgroundColor: COLORS.brand_tint,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm + SPACING.xs,
    marginBottom: SPACING.md,
  },
  text: {
    ...TYPE.caption,
    color: COLORS.text,
    flex: 1,
  },
  switch_button: {
    flexGrow: 1,
    marginHorizontal: 0,
  },
  exit_button: {
    flexGrow: 1,
    marginHorizontal: 0,
  },
  top_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  button_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
});
