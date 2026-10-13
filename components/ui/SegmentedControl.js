import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES, SHADOWS, NUMBERS } from '../../theme';

// a row of tabs in a gray track where the picked one sits on a white pill, for filters that act like tabs
// props: options (a list of { value, label, count }), value (the picked value), onChange, style, label (for screen readers)
function SegmentedControl(props) {
  return (
    <View
      style={[styles.track, props.style]}
      accessibilityRole="tablist"
      accessibilityLabel={props.label}
    >
      {props.options.map((option) => {
        const selected = option.value === props.value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => props.onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: selected }}
            accessibilityLabel={
              option.label + (option.count !== undefined ? ', ' + option.count : '')
            }
            style={({ pressed }) => [
              styles.option,
              selected && styles.option_selected,
              pressed && !selected && styles.pressed,
            ]}
          >
            <Text style={[styles.text, selected && styles.text_selected]} numberOfLines={1}>
              {option.label}
              {option.count !== undefined ? (
                <Text style={[styles.count, NUMBERS]}>{'  ' + option.count}</Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default SegmentedControl;

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: COLORS.neutral_tint,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
    gap: SPACING.xs,
  },
  option: {
    flex: 1,
    minHeight: SIZES.touch - SPACING.xs * 2,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  option_selected: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    ...SHADOWS.low,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
  },
  text: {
    ...TYPE.label,
    color: COLORS.text_muted,
  },
  text_selected: {
    color: COLORS.text,
  },
  count: {
    color: COLORS.text_muted,
  },
});
