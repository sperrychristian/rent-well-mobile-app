import { useEffect } from 'react';
import { View, Text, ActivityIndicator, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import EmptyState from './EmptyState';
import { useReduceMotion } from './useReduceMotion';
import { COLORS, SPACING, TYPE, SIZES } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';

// what a screen shows while its data isn't ready, so a screen is never blank while it waits
// props: status ('loading' | 'error' | 'empty'), plus
//   loading: label (like "Loading work orders")
//   error: message, onRetry (the Try Again button), title (optional, "Couldn't load this" by default)
//   empty: the EmptyState props (illustration or icon, title, message, action_label, onAction)
// loading and error are announced to screen readers, and with Reduce Motion on the spinner is a still icon
function ScreenState(props) {
  const reduce_motion = useReduceMotion();
  const announcement =
    props.status === 'loading'
      ? props.label || 'Loading'
      : props.status === 'error'
        ? (props.title || "Couldn't load this") + '. ' + (props.message || '')
        : '';

  // step 1: say it out loud once when it shows (iOS doesn't read live regions on its own)
  useEffect(() => {
    if (announcement) {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [announcement]);

  if (props.status === 'empty') {
    return <EmptyState {...props} style={[styles.empty, props.style]} />;
  }

  if (props.status === 'error') {
    return (
      <View
        style={[styles.box, props.style]}
        accessibilityLiveRegion="assertive"
        accessibilityRole="alert"
      >
        <Ionicons
          name="cloud-offline-outline"
          size={SIZES.icon_large + SPACING.sm}
          color={COLORS.warning_text}
          accessible={false}
          importantForAccessibility="no"
        />
        <Text style={styles.title} accessibilityRole="header">
          {props.title || "Couldn't load this"}
        </Text>
        {props.message ? <Text style={styles.message}>{props.message}</Text> : null}
        {props.onRetry ? (
          <Button
            title="Try Again"
            icon="refresh-outline"
            variant="secondary"
            onPress={props.onRetry}
            style={styles.action}
            accessibilityHint="Loads it again"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[styles.box, props.style]}
      accessibilityLiveRegion="polite"
      accessible={true}
      accessibilityLabel={props.label || 'Loading'}
      accessibilityRole="progressbar"
    >
      {reduce_motion ? (
        <Ionicons name="hourglass-outline" size={SIZES.icon_large} color={COLORS.text_muted} />
      ) : (
        <ActivityIndicator size="large" color={COLORS.cta} />
      )}
      <Text style={styles.label}>{props.label || 'Loading'}</Text>
    </View>
  );
}

export default ScreenState;

const styles = themedStyles((COLORS) => ({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  empty: {
    paddingTop: SPACING.xl,
  },
  label: {
    ...TYPE.body,
    color: COLORS.text_muted,
    textAlign: 'center',
  },
  title: {
    ...TYPE.empty_title,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  message: {
    ...TYPE.body,
    color: COLORS.text_muted,
    textAlign: 'center',
    maxWidth: SIZES.content_max_width,
  },
  action: {
    marginTop: SPACING.md,
  },
}));
