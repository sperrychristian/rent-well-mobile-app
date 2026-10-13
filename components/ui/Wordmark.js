import { View, Text, StyleSheet } from 'react-native';
import PixelArt from './pixel/PixelArt';
import { COLORS, SPACING, TYPE, FONTS } from '../../theme';

// the Rent Well lockup: the pixel house, the name in the pixel font, and a one-line tagline in Inter
// the pixel font is only ever this big, it gets hard to read small, everything else stays Inter
// props: size (large for Welcome, medium for the chooser and the auth screens, small for tight spots),
//   tagline (default "Property management made simple", pass null to hide it), style
const sizes = {
  large: { pixel: 7, name: 44, line: 52, gap: SPACING.md },
  medium: { pixel: 4, name: 32, line: 40, gap: SPACING.sm },
  small: { pixel: 3, name: 28, line: 34, gap: SPACING.xs },
};

function Wordmark(props) {
  const size = sizes[props.size] || sizes.large;
  const tagline = props.tagline === undefined ? 'Property management made simple' : props.tagline;
  return (
    <View
      style={[styles.lockup, props.style]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={'Rent Well' + (tagline ? ', ' + tagline : '')}
    >
      <PixelArt name="house" pixel={size.pixel} />
      <Text
        style={[styles.name, { fontSize: size.name, lineHeight: size.line, marginTop: size.gap }]}
        // it's already big, so it can grow a little with the system font size but not past the screen
        maxFontSizeMultiplier={1.3}
      >
        Rent <Text style={styles.name_accent}>Well</Text>
      </Text>
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>
  );
}

export default Wordmark;

const styles = StyleSheet.create({
  lockup: {
    alignItems: 'center',
  },
  name: {
    fontFamily: FONTS.wordmark,
    color: COLORS.title,
    letterSpacing: 1,
    textAlign: 'center',
  },
  // the second word picks up the sunrise amber
  name_accent: {
    color: COLORS.cta,
  },
  tagline: {
    ...TYPE.body,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});
