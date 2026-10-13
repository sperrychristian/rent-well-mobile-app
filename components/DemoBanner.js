import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PrimaryButton from './PrimaryButton';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { COLORS, SPACING, FONTS } from '../theme';

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
    <View style={styles.banner}>
      <Text style={styles.text}>
        {(is_tenant ? 'Demo as Sam (tenant)' : 'Demo as the landlord') +
          ': sample data, nothing is saved'}
      </Text>
      <PrimaryButton
        title={is_tenant ? 'Switch to Landlord view' : 'Switch to Tenant view'}
        icon="swap-horizontal-outline"
        text_color={COLORS.text_light}
        onPress={handleSwitch}
        style={styles.switch_button}
      />
      <PrimaryButton
        title="Exit Demo Mode"
        icon="exit-outline"
        text_color={COLORS.text_light}
        onPress={handleExit}
        style={styles.exit_button}
      />
    </View>
  );
}

export default DemoBanner;

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    backgroundColor: COLORS.warning,
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  text: {
    color: COLORS.text_dark,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  switch_button: {
    backgroundColor: COLORS.action,
    marginHorizontal: 0,
    marginBottom: SPACING.sm,
  },
  exit_button: {
    backgroundColor: COLORS.danger,
    marginHorizontal: 0,
  },
});
