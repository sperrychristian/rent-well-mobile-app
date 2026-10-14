import { Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPE, RADIUS, BORDER } from '../../theme';

// a filter or choice chip, selected ones fill with the steel blue and get a check so it's not color only
// (the fintech pass: white with a hairline border, and a soft indigo tint with an indigo border when picked,
// so the screens' ink chip text stays readable whether it's picked or not)
// props: label, selected, onPress, icon, style, accessibilityLabel
// chips are short, so they get vertical hitSlop to reach the 44pt tap height
function Chip(props) {
  return (
    <Pressable
      onPress={props.onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel || props.label}
      accessibilityState={{ selected: !!props.selected }}
      style={({ pressed }) => [
        styles.chip,
        props.selected && styles.selected,
        props.style,
        pressed && styles.pressed,
      ]}
    >
      {props.selected ? (
        <Ionicons name="checkmark" size={14} color={COLORS.cta} style={styles.icon} />
      ) : props.icon ? (
        <Ionicons name={props.icon} size={14} color={COLORS.text} style={styles.icon} />
      ) : null}
      <Text style={[styles.text, props.selected && styles.selected_text]}>{props.label}</Text>
    </Pressable>
  );
}

export default Chip;

// the same look as a plain object, for screens whose chips are still their own Pressables
export const chip_styles = StyleSheet.create({
  chip: {
    paddingVertical: SPACING.xs + SPACING.xxs,
    paddingHorizontal: SPACING.md - SPACING.xxs,
    borderRadius: RADIUS.pill,
    backgroundColor: 'transparent',
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border_strong,
  },
  // the Hearth pass: see-through chips, the picked one gets a green edge and green words, no fill
  chip_active: {
    backgroundColor: 'transparent',
    borderColor: COLORS.cta,
  },
  chip_text: {
    ...TYPE.label,
    color: COLORS.text,
  },
});

const styles = StyleSheet.create({
  chip: {
    ...chip_styles.chip,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selected: {
    ...chip_styles.chip_active,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
  },
  icon: {
    marginRight: SPACING.xs,
  },
  text: {
    ...chip_styles.chip_text,
  },
  selected_text: {
    color: COLORS.cta,
  },
});
