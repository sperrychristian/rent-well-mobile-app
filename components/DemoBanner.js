import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PrimaryButton from './PrimaryButton';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { SPACING, FONTS } from '../theme';

// shows a strip with an exit button, and only while the demo is running
function DemoBanner() {
  const navigation = useNavigation();
  const { demo_mode, exitDemo } = useWorkOrders();

  if (!demo_mode) {
    return null;
  }

  // I put the real data back first, then reset the stack so back can't return to the demo screens
  async function handleExit() {
    await exitDemo();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Demo mode: sample data, nothing is saved</Text>
      <PrimaryButton
        title="Exit Demo Mode"
        icon="exit-outline"
        text_color="#FFFFFF"
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
    backgroundColor: '#F0A530',
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  text: {
    color: '#1A1A1A',
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  exit_button: {
    backgroundColor: '#D9534F',
    marginHorizontal: 0,
  },
});