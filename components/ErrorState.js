import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from './PrimaryButton';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES } from '../theme';

// shown instead of a blank screen when something couldn't load, like being offline or the server being down
// props: message, onRetry
function ErrorState(props) {
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <View style={styles.icon_circle}>
        <Ionicons name="cloud-offline-outline" size={32} color={COLORS.warning_text} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        Something went wrong
      </Text>
      <Text style={styles.message}>{props.message}</Text>
      <PrimaryButton
        title="Try Again"
        icon="refresh"
        variant="secondary"
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
    alignSelf: 'stretch',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  icon_circle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    ...TYPE.heading,
    color: COLORS.text,
    textAlign: 'center',
  },
  message: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    textAlign: 'center',
    maxWidth: SIZES.content_max_width,
  },
  retry_button: {
    marginTop: SPACING.sm,
    minWidth: 160,
  },
});
