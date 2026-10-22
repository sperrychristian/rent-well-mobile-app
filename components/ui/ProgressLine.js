import { View } from 'react-native';
import { SIZES, RADIUS } from '../../theme';
import { themedStyles } from '../../utils/themedStyles';

// the Hearth progress line: 4pt of forest green with a round end on a hairline-colored track
// props: share (0 to 1), label (what screen readers hear), style
function ProgressLine(props) {
  const share = Math.min(Math.max(Number(props.share) || 0, 0), 1);
  const percent = Math.round(share * 100);
  return (
    <View
      style={[styles.track, props.style]}
      accessibilityRole="progressbar"
      accessibilityLabel={props.label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View style={[styles.fill, { width: percent + '%' }]} />
    </View>
  );
}

export default ProgressLine;

const styles = themedStyles((COLORS) => ({
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
}));
