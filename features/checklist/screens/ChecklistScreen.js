import { StyleSheet, View } from 'react-native';
import { COLORS, SPACING } from '../../../theme';
import ScreenTitle from '../../../components/ScreenTitle';

function ExpensesScreen() {
  return (
    <View style={styles.container}>
      <ScreenTitle>Checklist</ScreenTitle>
    </View>
  );
}

export default ExpensesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
});
