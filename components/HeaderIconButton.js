import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, OPACITY } from '../theme';

// an icon button for the header, the label is what a screen reader says since there's no text
// props: icon, label, onPress
// it's a full 44pt square now so it's easy to hit, and it gets a soft circle while pressed
function HeaderIconButton(props) {
  return (
    <Pressable
      onPress={props.onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={props.icon} size={24} color={COLORS.title} />
    </Pressable>
  );
}

export default HeaderIconButton;

const styles = StyleSheet.create({
  button: {
    width: SIZES.touch,
    height: SIZES.touch,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: OPACITY.pressed,
    backgroundColor: COLORS.surface_raised,
  },
});
