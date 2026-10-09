import { Text, StyleSheet, Pressable } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../theme';
import { Ionicons } from '@expo/vector-icons';

function PrimaryButton(props) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [styles.button, props.style, pressed && styles.pressed]}
    >
      {/* only draw the icon if one was passed in */}
      {props.icon && (
        <Ionicons
          name={props.icon}
          size={22}
          color={props.text_color || COLORS.text}
          style={styles.icon}
        />
      )}
      <Text style={[styles.button_text, props.text_color && { color: props.text_color }]}>
        {props.title}
      </Text>
    </Pressable>
  );
}

export default PrimaryButton;

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    marginHorizontal: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  button_text: {
    color: COLORS.text,
    fontSize: FONT_SIZES.body,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
