import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPE, SIZES } from '../../theme';
import { list_styles } from '../ui/listStyles';
import { themedStyles } from '../../utils/themedStyles';

// a labeled row of chips where one can be picked, with the same inline error the Input shows
// props: label, options ([{ key, label, spoken }]), selected (a key), onSelect(key), invalid, errorText,
//   helperText, disabled (shows the choice but it can't change), style
function ChoiceChips(props) {
  return (
    <View style={[styles.field, props.style]}>
      <Text
        style={[styles.label, props.invalid && styles.invalid_label]}
        accessibilityRole="header"
      >
        {props.label}
      </Text>
      <View style={styles.chip_wrap} accessibilityRole="radiogroup">
        {props.options.map((option) => {
          const is_picked = props.selected === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={props.disabled ? undefined : () => props.onSelect(option.key)}
              disabled={props.disabled}
              hitSlop={{ top: 8, bottom: 8 }}
              style={[
                styles.chip,
                is_picked && styles.chip_active,
                props.invalid && styles.chip_invalid,
              ]}
              accessibilityRole="radio"
              accessibilityLabel={option.spoken || option.label}
              accessibilityHint={props.errorText || undefined}
              accessibilityState={{
                selected: is_picked,
                checked: is_picked,
                disabled: !!props.disabled,
              }}
            >
              <Text style={styles.chip_text}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {props.errorText ? (
        <View style={styles.error_row}>
          <Ionicons
            name="alert-circle-outline"
            size={SIZES.icon_small}
            color={COLORS.danger_text}
          />
          <Text style={styles.error_text} accessibilityLiveRegion="polite">
            {props.errorText}
          </Text>
        </View>
      ) : props.helperText ? (
        <Text style={styles.helper}>{props.helperText}</Text>
      ) : null}
    </View>
  );
}

export default ChoiceChips;

const styles = themedStyles((COLORS) => ({
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text_muted,
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  invalid_label: {
    color: COLORS.danger_text,
  },
  chip_wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    ...list_styles.chip,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  chip_active: {
    ...list_styles.chip_active,
  },
  chip_invalid: {
    borderColor: COLORS.danger_text,
  },
  chip_text: {
    ...list_styles.chip_text,
  },
  error_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  error_text: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    flexShrink: 1,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.xs,
  },
}));
