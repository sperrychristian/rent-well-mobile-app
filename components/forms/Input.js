import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES, NUMBERS } from '../../theme';
import { themedStyles } from '../../utils/themedStyles';

// the lecture's Input: a label and a text box, and everything the box needs comes in textInputConfig
// (keyboardType, maxLength, multiline, placeholder, onChangeText, value), so one component fits every field
// props: label, style, invalid, textInputConfig, plus the parts the assignment adds:
//   errorText (the message right under the box), counter ({ count, max } for the "42/500" line),
//   helperText (a hint when there's no error), accessory (a button inside the box, like the calendar)
// the text box's ref rides along in textInputConfig too (React 19 passes ref like any other prop)
// counter_warning is the share of the limit where the counter turns amber
export const counter_warning = 0.9;

function Input(props) {
  const { is_dark } = useTheme();
  const config = props.textInputConfig || {};
  const read_only = config.editable === false;

  // step 1: start with the base look, then add the multiline and invalid looks on top when they apply
  const inputStyles = [styles.input];
  if (config.multiline) {
    inputStyles.push(styles.inputMultiline);
  }
  if (read_only) {
    inputStyles.push(styles.inputReadOnly);
  }
  if (props.invalid) {
    inputStyles.push(styles.invalidInput);
  }

  // step 2: the counter text, and what a screen reader hears about it
  const counter = props.counter;
  const counter_near_limit = counter ? counter.count >= counter.max * counter_warning : false;
  const counter_spoken = counter ? counter.count + ' of ' + counter.max + ' characters used' : '';
  const hint = [props.errorText, props.helperText, counter_spoken].filter(Boolean).join('. ');

  return (
    <View style={[styles.inputContainer, props.style]}>
      <Text style={[styles.label, props.invalid && styles.invalidLabel]}>{props.label}</Text>
      <View style={styles.box_row}>
        <TextInput
          style={inputStyles}
          placeholderTextColor={COLORS.text_muted}
          keyboardAppearance={is_dark ? 'dark' : 'light'}
          accessibilityLabel={props.label}
          accessibilityHint={hint || undefined}
          accessibilityState={{ disabled: read_only }}
          {...config}
        />
        {props.accessory ? <View style={styles.accessory}>{props.accessory}</View> : null}
      </View>
      {props.errorText || counter || props.helperText ? (
        <View style={styles.under_row}>
          {props.errorText ? (
            // a small alert icon next to the message so the error is never color only
            <View style={styles.error_row}>
              <Ionicons
                name="alert-circle-outline"
                size={SIZES.icon_small}
                color={COLORS.danger_text}
              />
              <Text style={styles.errorText} accessibilityLiveRegion="polite">
                {props.errorText}
              </Text>
            </View>
          ) : (
            <Text style={styles.helper}>{props.helperText || ''}</Text>
          )}
          {counter ? (
            <Text
              style={[styles.counter, counter_near_limit && styles.counterWarning]}
              accessibilityLabel={counter_spoken}
              testID="input-counter"
            >
              {counter.count + '/' + counter.max}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default Input;

const styles = themedStyles((COLORS) => ({
  inputContainer: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text_muted,
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  invalidLabel: {
    color: COLORS.danger_text,
  },
  box_row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  input: {
    ...TYPE.input,
    flex: 1,
    // without this a text box in a row can be wider than the screen on the web
    minWidth: 0,
    minHeight: SIZES.button_medium,
    backgroundColor: COLORS.surface_sunken,
    color: COLORS.text,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border_strong,
    paddingHorizontal: SPACING.md - SPACING.xs,
    paddingVertical: SPACING.sm + SPACING.xxs,
  },
  inputMultiline: {
    minHeight: SIZES.row_min_height * 2,
    textAlignVertical: 'top',
  },
  // a field the server can't change: the same box, quieter, so it reads as information
  inputReadOnly: {
    backgroundColor: COLORS.surface_raised,
    color: COLORS.text_muted,
  },
  invalidInput: {
    borderColor: COLORS.danger_text,
    borderWidth: BORDER.thin,
  },
  accessory: {
    marginLeft: SPACING.sm,
    justifyContent: 'center',
  },
  under_row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  error_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexShrink: 1,
  },
  errorText: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    flexShrink: 1,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    flexShrink: 1,
  },
  counter: {
    ...TYPE.caption,
    ...NUMBERS,
    color: COLORS.text_muted,
  },
  counterWarning: {
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.warning_text,
  },
}));
