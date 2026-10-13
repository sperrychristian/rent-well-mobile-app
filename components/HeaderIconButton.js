import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

// an icon button for the header, the label is what a screen reader says since there's no text
// props: icon, label, onPress
function HeaderIconButton(props) {
  return (
    <Pressable
      onPress={props.onPress}
      hitSlop={10}
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
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.5,
  },
});
