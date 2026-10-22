import { View, Pressable } from 'react-native';
import { SPACING, RADIUS, BORDER, SHADOWS } from '../../theme';
import { themedStyles } from '../../utils/themedStyles';

// a surface that groups related things, all three looks share the same padding and corners
// variants: flat (sits on the page with a border), raised (lifted with a shadow), interactive (raised and tappable)
// props: variant, onPress (interactive only), accessibilityLabel, accessibilityHint, style, children
// the fintech pass: flat is the default now, a white card with a hairline border, and only raised gets a soft shadow
function Card(props) {
  const variant = props.variant || 'flat';

  if (variant === 'interactive') {
    return (
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityHint={props.accessibilityHint}
        style={({ pressed }) => [styles.card, styles.flat, props.style, pressed && styles.pressed]}
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

// the Hearth pass: flat and interactive cards aren't boxes anymore, just a stretch of the page with room
// above and below (rows inside bring their own hairlines), raised is the one white box with a hairline edge
// for the rare spot that really needs one
const styles = themedStyles((COLORS) => ({
  card: {
    paddingVertical: SPACING.sm,
  },
  flat: {
    backgroundColor: 'transparent',
  },
  raised: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: BORDER.hairline,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.low,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
  },
}));
