import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPE, NUMBERS } from '../../theme';

// the big fact at the top of a screen: a small label, the key figure large, a caption, and room for extras under it
// variants: brand (the indigo card with white text, for the one overview card on a home screen) and plain (white card)
// props: label, value (already formatted), caption, variant, children (a sparkline, stat row, or buttons), style
// the Hearth pass: no card for either variant, a muted label, the figure as a big Fraunces hero number
// (size small makes it the 30pt secondary number), a muted caption, and whatever goes under it
function SummaryBlock(props) {
  const is_small = props.size === 'small';
  return (
    <View style={[styles.block, props.style]} accessibilityRole="summary">
      <View
        accessible
        accessibilityLabel={
          props.label + ', ' + props.value + (props.caption ? ', ' + props.caption : '')
        }
      >
        <Text style={styles.label}>{props.label}</Text>
        <Text
          style={[styles.value, is_small && styles.value_small, NUMBERS]}
          numberOfLines={1}
          adjustsFontSizeToFit
          // the hero is already 58, so it only grows a little with the system text size and shrinks to fit
          maxFontSizeMultiplier={1.2}
        >
          {props.value}
        </Text>
        {props.caption ? <Text style={styles.caption}>{props.caption}</Text> : null}
      </View>
      {props.children}
    </View>
  );
}

export default SummaryBlock;

const styles = StyleSheet.create({
  block: {
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  label: {
    ...TYPE.body,
    color: COLORS.text_muted,
  },
  value: {
    ...TYPE.hero,
    color: COLORS.text,
  },
  value_small: {
    ...TYPE.number,
  },
  caption: {
    ...TYPE.body,
    color: COLORS.text_muted,
  },
});
