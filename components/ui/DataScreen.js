import { View } from 'react-native';
import ScreenState from './ScreenState';
import InlineError from './InlineError';
import { useScreenData } from '../../store/useScreenData';
import { SIZES, SPACING } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';

// wraps a screen so it's never blank while its Firebase data loads: a spinner with a label first,
// the error with Try Again if the first load failed, and a small banner over the screen when a refresh
// or a save failed but there's still data to show
// withDataScreen(Screen, { stores: ['cloud'], label: 'Loading documents' }) gives back the wrapped screen
export function withDataScreen(Screen, options) {
  function DataScreen(props) {
    const data = useScreenData(options.stores);
    if (data.status === 'loading') {
      return (
        <View style={styles.page}>
          <ScreenState status="loading" label={options.label || 'Loading'} />
        </View>
      );
    }
    if (data.status === 'error') {
      return (
        <View style={styles.page}>
          <ScreenState
            status="error"
            title={options.error_title || "Couldn't load this"}
            message={data.message}
            onRetry={data.retry}
          />
        </View>
      );
    }
    // the screen always sits in the same spot, so a banner coming or going never resets a form on it
    return (
      <View style={styles.flex}>
        {data.banner ? (
          <InlineError
            message={
              data.banner_is_save
                ? data.banner
                : data.banner + ' Showing what was saved last, pull down to try again.'
            }
            onRetry={data.banner_is_save ? data.clearBanner : data.retry}
            retry_label={data.banner_is_save ? 'OK' : 'Retry'}
            style={styles.banner}
          />
        ) : null}
        <View style={styles.flex}>
          <Screen {...props} />
        </View>
      </View>
    );
  }
  DataScreen.displayName = 'DataScreen(' + (Screen.displayName || Screen.name || 'Screen') + ')';
  return DataScreen;
}

const styles = themedStyles((COLORS) => ({
  page: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.screen_padding,
  },
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  banner: {
    marginHorizontal: SIZES.screen_padding,
    marginTop: SPACING.sm,
    marginBottom: 0,
  },
}));
