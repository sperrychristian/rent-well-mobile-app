import { View, Text, Pressable, StyleSheet } from 'react-native';
import IconCircle from './IconCircle';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, NUMBERS } from '../../theme';

// one key number: a small uppercase label, the value big, and a short caption under it
// props: label, value (a number or already formatted text), caption, icon, tone (for the icon circle),
//   onPress (optional, makes the whole tile tappable), accessibilityHint, style
function KpiTile(props) {
  const content = (
    <>
      <View style={styles.top_row}>
        <Text style={styles.label} numberOfLines={2}>
          {props.label}
        </Text>
        {props.icon ? <IconCircle icon={props.icon} tone={props.tone} size={28} /> : null}
      </View>
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
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    padding: SPACING.md - SPACING.xs,
    gap: SPACING.xs,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
    borderColor: COLORS.border_strong,
  },
  top_row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  label: {
    ...TYPE.overline,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.text_muted,
    flexShrink: 1,
  },
  value: {
    ...TYPE.title,
    color: COLORS.text,
  },
  caption: {
    ...TYPE.caption,
    color: COLORS.text_muted,
  },
});
