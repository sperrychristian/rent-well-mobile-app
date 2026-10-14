import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPE, NUMBERS, OPACITY } from '../../theme';

// one key number: a small uppercase label, the value big, and a short caption under it
// the icon sits on top and the label goes under the value, so the numbers line up even when a label wraps
// props: label, value (a number or already formatted text), caption, icon, tone (for the icon circle),
//   onPress (optional, makes the whole tile tappable), accessibilityHint, style
// the Hearth pass: no tile and no icon, just a muted label, the number in Fraunces, and a muted caption,
// so a row of them reads like figures in a magazine (icon and tone are still accepted and ignored)
function KpiTile(props) {
  const content = (
    <>
      <Text style={styles.label} numberOfLines={2}>
        {props.label}
      </Text>
      <Text style={[styles.value, NUMBERS]} numberOfLines={1} adjustsFontSizeToFit>
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
      <View style={[styles.tile, props.style]} accessible accessibilityLabel={label}>
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
      style={({ pressed }) => [styles.tile, props.style, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export default KpiTile;

const styles = StyleSheet.create({
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
});
