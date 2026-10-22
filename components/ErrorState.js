import { View, Text } from 'react-native';
import PrimaryButton from './PrimaryButton';
import { SPACING, TYPE, SIZES } from '../theme';
import IconCircle from './ui/IconCircle';
import { themedStyles } from '../utils/themedStyles';

// shown instead of a blank screen when something couldn't load, like being offline or the server being down
// props: message, onRetry
function ErrorState(props) {
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <IconCircle
        icon="cloud-offline-outline"
        tone="warning"
        size={64}
        style={styles.icon_circle}
      />
      <Text style={styles.title} accessibilityRole="header">
        Something went wrong
      </Text>
      <Text style={styles.message}>{props.message}</Text>
      <PrimaryButton
        title="Try Again"
        icon="refresh-outline"
        variant="secondary"
        onPress={props.onRetry}
        style={styles.retry_button}
      />
    </View>
  );
}

export default ErrorState;

const styles = themedStyles((COLORS) => ({
  box: {
    alignItems: 'center',
    alignSelf: 'stretch',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  icon_circle: {
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
    minWidth: SIZES.content_max_width / 4 + SPACING.sm,
  },
}));
