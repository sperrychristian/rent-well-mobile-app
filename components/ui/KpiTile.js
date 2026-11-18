import { View, Text, Pressable } from 'react-native';
import { SPACING, TYPE, NUMBERS, OPACITY } from '../../constants/theme';
import { themedStyles } from '../../util/themedStyles';
import { useFitFontSize, number_steps } from '../../util/fitFontSize';

// one key number: a small uppercase label, the value big, and a short caption under it
// the icon sits on top and the label goes under the value, so the numbers line up even when a label wraps
// props: label, value (a number or already formatted text), caption, icon, tone (for the icon circle),
//   onPress (optional, makes the whole tile tappable), accessibilityHint, style
// the Hearth pass: no tile and no icon, just a muted label, the number in Fraunces, and a muted caption,
// so a row of them reads like figures in a magazine (icon and tone are still accepted and ignored)
function KpiTile(props) {
  // the number's size comes from the tile's measured width (util/fitFontSize.js), not iOS shrink to fit
  const fit = useFitFontSize(props.value, TYPE.number, number_steps, 1.3);
  const content = (
    <>
      <Text style={styles.label} numberOfLines={2}>
        {props.label}
      </Text>
      <Text
        style={[styles.value, NUMBERS, fit.fit_style]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {props.value}
      </Text>
      {props.caption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {props.caption}
        </Text>
      ) : null}
    </>
  );
  const label = props.label + ', ' + props.value + (props.caption ? ', ' + props.caption : '');
  if (!props.onPress) {
    return (
      <View
        style={[styles.tile, props.style]}
        onLayout={fit.onLayout}
        accessible
        accessibilityLabel={label}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={props.accessibilityHint}
      onLayout={fit.onLayout}
      style={({ pressed }) => [styles.tile, props.style, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export default KpiTile;

const styles = themedStyles((COLORS) => ({
  tile: {
    flex: 1,
    paddingVertical: SPACING.sm,
    gap: SPACING.xxs,
  },
  pressed: {
    opacity: OPACITY.faint,
  },
  label: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  value: {
    ...TYPE.number,
    color: COLORS.text,
  },
  caption: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
}));
