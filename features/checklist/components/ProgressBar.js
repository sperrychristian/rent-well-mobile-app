import { View, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SIZES } from '../../../theme';

// a thin bar that fills up as items get checked off, props are done and total
function ProgressBar(props) {
  // an empty room would divide by zero, so it just shows an empty bar
  const fraction = props.total > 0 ? props.done / props.total : 0;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: props.total, now: props.done }}
    >
      <View style={[styles.fill, { width: fraction * 100 + '%' }]} />
    </View>
  );
}

export default ProgressBar;

const styles = StyleSheet.create({
  // the Hearth pass: the same 4pt green line as everywhere else
  track: {
    height: SIZES.progress,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.hairline,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.cta,
  },
});
