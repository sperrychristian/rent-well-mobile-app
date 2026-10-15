import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPE, NUMBERS } from '../../theme';

// a money text box: a $ in front, the number pad with a decimal point, and tabular digits
// style is the screen's own field style (it goes on the outside so the border, fill, and padding stay the same),
// everything else goes straight to the TextInput, so the screen's value and onChangeText work like before
function CurrencyInput(props) {
  const { style, accessibilityLabel, placeholder, ...input_props } = props;
  return (
    <View style={[style, styles.wrap]}>
      <Text style={styles.prefix} accessible={false} importantForAccessibility="no">
        $
      </Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={COLORS.text_muted}
        keyboardType="decimal-pad"
        keyboardAppearance="light"
        accessibilityLabel={
          accessibilityLabel || (placeholder ? placeholder + ', dollars' : 'Amount in dollars')
        }
        {...input_props}
        style={[styles.input, NUMBERS]}
      />
    </View>
  );
}

export default CurrencyInput;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: {
    ...TYPE.input,
    color: COLORS.text_muted,
    marginRight: SPACING.xs,
  },
  // the outside box already has the padding and border, so the text box itself is bare
  input: {
    ...TYPE.input,
    flex: 1,
    color: COLORS.text,
    padding: 0,
    alignSelf: 'stretch',
  },
});
