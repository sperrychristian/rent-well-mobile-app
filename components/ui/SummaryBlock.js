import { View, Text } from 'react-native';
import { SPACING, TYPE, NUMBERS } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';
import { useFitFontSize, hero_steps, number_steps } from '../../util/fitFontSize';

// the big fact at the top of a screen: a small label, the key figure large, a caption, and room for extras under it
// variants: brand (the indigo card with white text, for the one overview card on a home screen) and plain (white card)
// props: label, value (already formatted), caption, variant, children (a sparkline, stat row, or buttons), style
// the Hearth pass: no card for either variant, a muted label, the figure as a big Fraunces hero number
// (size small makes it the 30pt secondary number), a muted caption, and whatever goes under it
function SummaryBlock(props) {
  const is_small = props.size === 'small';
  // the size is picked from the measured width now (util/fitFontSize.js), not iOS shrink to fit
  const fit = useFitFontSize(
    props.value,
    is_small ? TYPE.number : TYPE.hero,
    is_small ? number_steps : hero_steps,
    1.2,
  );
  return (
    <View style={[styles.block, props.style]} accessibilityRole="summary">
      <View
        accessible
        onLayout={fit.onLayout}
        accessibilityLabel={
          props.label + ', ' + props.value + (props.caption ? ', ' + props.caption : '')
        }
      >
        <Text style={styles.label}>{props.label}</Text>
        <Text
          style={[styles.value, is_small && styles.value_small, NUMBERS, fit.fit_style]}
          numberOfLines={1}
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

const styles = themedStyles((COLORS) => ({
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
}));
