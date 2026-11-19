import { View, StyleSheet } from 'react-native';
import ScreenState from '../ui/ScreenState';
import { SPACING, RADIUS, BORDER, SIZES, SHADOWS } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';

// the lecture's LoadingOverlay: "Logging in..." or "Creating user..." while the request runs
// the lecture swapped the whole form for it, this one sits on top so the form keeps what was typed
// it reuses the app's own loading state (ScreenState), which is announced and turns still with Reduce Motion
// props: message
function LoadingOverlay(props) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]} accessibilityViewIsModal={true}>
      <View style={styles.box}>
        <ScreenState status="loading" label={props.message} />
      </View>
    </View>
  );
}

export default LoadingOverlay;

const styles = themedStyles((COLORS) => ({
  backdrop: {
    backgroundColor: COLORS.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.screen_padding,
  },
  box: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    minWidth: SIZES.drawer_width - SPACING.xxl,
    maxWidth: SIZES.content_max_width,
    ...SHADOWS.high,
  },
}));
