import { View, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, BORDER, SHADOWS, OPACITY } from '../../theme';

// a surface that groups related things, all three looks share the same padding and corners
// variants: flat (sits on the page with a border), raised (lifted with a shadow), interactive (raised and tappable)
// props: variant, onPress (interactive only), accessibilityLabel, accessibilityHint, style, children
function Card(props) {
  const variant = props.variant || 'raised';

  if (variant === 'interactive') {
    return (
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityHint={props.accessibilityHint}
        style={({ pressed }) => [
          styles.card,
          styles.raised,
          props.style,
          pressed && styles.pressed,
        ]}
      >
        {props.children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, variant === 'flat' ? styles.flat : styles.raised, props.style]}>
      {props.children}
    </View>
  );
}

export default Card;

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: BORDER.hairline,
  },
  flat: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  raised: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  pressed: {
    opacity: OPACITY.pressed,
    backgroundColor: COLORS.surface_raised,
  },
});
