import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from './PrimaryButton';
import { COLORS, SPACING, FONTS } from '../theme';

// shown instead of a blank screen when something couldn't load, like being offline or the server being down
// props: message, onRetry
function ErrorState(props) {
  return (
    <View style={styles.box}>
      <Ionicons name="cloud-offline-outline" size={40} color={COLORS.secondary} />
      <Text style={styles.message}>{props.message}</Text>
      <PrimaryButton
        title="Try Again"
        icon="refresh"
        text_color={COLORS.text_light}
        onPress={props.onRetry}
        style={styles.retry_button}
      />
    </View>
  );
}

export default ErrorState;

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  message: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
    textAlign: 'center',
  },
  retry_button: {
    backgroundColor: COLORS.action,
  },
});
