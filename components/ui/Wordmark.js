import { View, Text, StyleSheet } from 'react-native';
import PixelArt from './pixel/PixelArt';
import { COLORS, SPACING, TYPE, FONTS, RADIUS } from '../../theme';

// the Rent Well lockup: the pixel house, the name in the pixel font, and a one-line tagline in Inter
// the pixel font is only ever this big, it gets hard to read small, everything else stays Inter
// props: size (large for Welcome, medium for the chooser and the auth screens, small for tight spots),
//   tagline (default "Property management made simple", pass null to hide it), style
// the fintech pass: the name is bold Inter with tight tracking now (no pixel font), and the house is a small
// logomark in the brand colors, sitting in a soft tinted tile next to the name
const sizes = {
  large: { pixel: 3, name: 34, line: 40, gap: SPACING.md, tile: 76 },
  medium: { pixel: 2, name: 26, line: 32, gap: SPACING.sm + SPACING.xs, tile: 52 },
  small: { pixel: 2, name: 22, line: 28, gap: SPACING.sm, tile: 48 },
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
      <View style={[styles.row, { gap: size.gap }]}>
        <View style={[styles.tile, { width: size.tile, height: size.tile }]}>
          <PixelArt name="house_mark" pixel={size.pixel} />
        </View>
        <Text
          style={[styles.name, { fontSize: size.name, lineHeight: size.line }]}
          // it's already big, so it can grow a little with the system font size but not past the screen
          maxFontSizeMultiplier={1.3}
        >
          Rent Well
        </Text>
      </View>
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>
  );
}

export default Wordmark;

const styles = StyleSheet.create({
  lockup: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // the logomark sits in a soft indigo tile, like an app icon
  tile: {
    backgroundColor: COLORS.brand_tint,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: FONTS.heading,
    color: COLORS.title,
    letterSpacing: -1,
  },
  tagline: {
    ...TYPE.body,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.sm + SPACING.xs,
  },
});
