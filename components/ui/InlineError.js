import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPE, SIZES, RADIUS } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';

// a small banner over data that's still on screen: a refresh failed, or a save didn't go through
// props: message, onRetry (adds a Retry button), retry_label (OK for a save message), style
// the words carry the meaning (never color only), and it's announced when it shows
function InlineError(props) {
  if (!props.message) {
    return null;
  }
  return (
    <View
      style={[styles.banner, props.style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name="alert-circle-outline"
        size={SIZES.icon}
        color={COLORS.warning_text}
        accessible={false}
        importantForAccessibility="no"
      />
      <Text style={styles.text}>{props.message}</Text>
      {props.onRetry ? (
        <Pressable
          onPress={props.onRetry}
          accessibilityRole="button"
          accessibilityLabel={props.retry_label || 'Retry'}
          hitSlop={8}
          style={({ pressed }) => [styles.retry, pressed && styles.retry_pressed]}
        >
          <Text style={styles.retry_text}>{props.retry_label || 'Retry'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default InlineError;

const styles = themedStyles((COLORS) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.warning_tint,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    marginBottom: SPACING.md,
  },
  text: {
    ...TYPE.body_small,
    color: COLORS.warning_text,
    flex: 1,
  },
  retry: {
    minHeight: SIZES.touch,
    minWidth: SIZES.touch,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry_pressed: {
    opacity: 0.6,
  },
  retry_text: {
    ...TYPE.subheading,
    color: COLORS.warning_text,
  },
}));
