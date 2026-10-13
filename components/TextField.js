import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES } from '../theme';

// a labeled text box with its error right underneath, extra props go straight to the TextInput
// props: label, error, value, onChangeText, plus anything TextInput takes
// the design pass added helper (a hint line under the box when there's no error) and an amber ring while it's focused
function TextField(props) {
  const { label, error, helper, style, onFocus, onBlur, ...input_props } = props;
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.input_focused, error && styles.input_error, style]}
        placeholderTextColor={COLORS.text_muted}
        keyboardAppearance="dark"
        accessibilityLabel={label}
        accessibilityHint={error || helper}
        {...input_props}
        // the focus ring is only a look, the screen's own onFocus and onBlur still run
        onFocus={(event) => {
          setFocused(true);
          if (onFocus) {
            onFocus(event);
          }
        }}
        onBlur={(event) => {
          setFocused(false);
          if (onBlur) {
            onBlur(event);
          }
        }}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

export default TextField;

const styles = StyleSheet.create({
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text,
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  input: {
    ...TYPE.input,
    minHeight: SIZES.touch + SPACING.xs,
    backgroundColor: COLORS.surface_sunken,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.thin,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md - SPACING.xs,
    paddingVertical: SPACING.sm + SPACING.xxs,
  },
  input_focused: {
    borderColor: COLORS.focus,
  },
  input_error: {
    borderColor: COLORS.danger_text,
  },
  error: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    marginTop: SPACING.xs,
  },
  helper: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.xs,
  },
});
