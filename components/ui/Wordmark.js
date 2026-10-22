import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPE } from '../../theme';
import { themedStyles } from '../../utils/themedStyles';

// the Rent Well lockup: the pixel house, the name in the pixel font, and a one-line tagline in Inter
// the pixel font is only ever this big, it gets hard to read small, everything else stays Inter
// props: size (large for Welcome, medium for the chooser and the auth screens, small for tight spots),
//   tagline (default "Property management made simple", pass null to hide it), style
// the fintech pass: the name is bold Inter with tight tracking now (no pixel font), and the house is a small
// logomark in the brand colors, sitting in a soft tinted tile next to the name
// the Hearth pass: a small forest green line house next to the name in Fraunces, no tile and no pixels,
// and align (center or left) so the dashboard's top bar can put it on the left
const sizes = {
  large: { icon: 34, name: 40, line: 48, gap: SPACING.sm },
  medium: { icon: 26, name: 30, line: 38, gap: SPACING.sm },
  small: { icon: 20, name: 22, line: 28, gap: SPACING.xs + SPACING.xxs },
};

function Wordmark(props) {
  const size = sizes[props.size] || sizes.large;
  const tagline = props.tagline === undefined ? 'Property management made simple' : props.tagline;
  const is_left = props.align === 'left';
  return (
    <View
      style={[styles.lockup, is_left && styles.left, props.style]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={'Rent Well' + (tagline ? ', ' + tagline : '')}
    >
      <View style={[styles.row, { gap: size.gap }]}>
        <Ionicons name="home-outline" size={size.icon} color={COLORS.cta} />
        <Text
          style={[styles.name, { fontSize: size.name, lineHeight: size.line }]}
          // it's already big, so it can grow a little with the system font size but not past the screen
          maxFontSizeMultiplier={1.3}
        >
          Rent Well
        </Text>
      </View>
      {tagline ? (
        <Text style={[styles.tagline, is_left && styles.tagline_left]}>{tagline}</Text>
      ) : null}
    </View>
  );
}

export default Wordmark;

const styles = themedStyles((COLORS) => ({
  lockup: {
    alignItems: 'center',
  },
  left: {
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    ...TYPE.wordmark,
    color: COLORS.title,
  },
  tagline: {
    ...TYPE.body,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  tagline_left: {
    textAlign: 'left',
  },
}));
