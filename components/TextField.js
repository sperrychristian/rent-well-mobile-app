import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONTS } from '../theme';

// a labeled text box with its error right underneath, extra props go straight to the TextInput
// props: label, error, value, onChangeText, plus anything TextInput takes
function TextField(props) {
  const { label, error, style, ...input_props } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.input_error, style]}
        placeholderTextColor={COLORS.secondary}
        {...input_props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export default TextField;

const styles = StyleSheet.create({
  field: {
    marginBottom: SPACING.sm,
  },
  label: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.background,
    color: COLORS.text,
    fontFamily: FONTS.body,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: SPACING.sm,
  },
  input_error: {
    borderColor: COLORS.danger,
  },
  error: {
    color: COLORS.danger,
    fontFamily: FONTS.body_bold,
    fontSize: 12,
    marginTop: 4,
  },
});
