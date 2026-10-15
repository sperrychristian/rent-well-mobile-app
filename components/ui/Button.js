import { Text, StyleSheet, Pressable, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, OPACITY, SIZES } from '../../theme';
import { lineIcon } from './lineIcon';

// the one button for the whole app, every look comes from a variant so screens don't style their own
// variants: primary (amber, the main action), secondary (outlined), tertiary (text only), destructive (red),
//   (the fintech pass made primary the indigo brand color, amber is only for warnings now)
//   and plain (the steel blue PrimaryButton has always had, screens recolor it with style)
// sizes: small, medium (default), large, every one is at least 44 tall with the hitSlop
// props: title, icon, variant, size, loading, disabled, onPress, style, text_color, accessibilityLabel, accessibilityHint
// the Hearth pass: every button is a full pill, primary is the forest green with white text, secondary is
// a see-through pill with a warm outline, tertiary is green text only, and destructive is terracotta words
// in a terracotta outline (never a filled red block), plain looks like primary now
const variants = {
  primary: {
    fill: COLORS.cta,
    text: COLORS.on_cta,
    border: COLORS.cta,
    pressed: COLORS.cta_pressed,
  },
  secondary: {
    fill: 'transparent',
    text: COLORS.text,
    border: COLORS.border_strong,
    pressed: COLORS.surface_raised,
  },
  tertiary: {
    fill: 'transparent',
    text: COLORS.cta,
    border: 'transparent',
    pressed: COLORS.surface_raised,
  },
  destructive: {
    fill: 'transparent',
    text: COLORS.danger_text,
    border: COLORS.danger_text,
    pressed: COLORS.danger_tint,
  },
  // the fintech pass: plain is the indigo with white text now, screens that recolor it keep white text on top
  plain: { fill: COLORS.primary, text: COLORS.text_light, border: COLORS.primary, pressed: null },
};

const heights = {
  small: SIZES.button_small,
  medium: SIZES.button_medium,
  large: SIZES.button_large,
};

function Button(props) {
  const look = variants[props.variant] || variants.primary;
  const size = props.size || 'medium';
  const is_disabled = !!props.disabled || !!props.loading;
  const label_color = props.text_color || look.text;
  // the small one is under 44 tall, so it gets the rest of the tap area as hitSlop
  const slop = size === 'small' ? (SIZES.touch - SIZES.button_small) / 2 : 0;

  return (
    <Pressable
      onPress={is_disabled ? undefined : props.onPress}
      disabled={is_disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel || props.title}
      accessibilityHint={props.accessibilityHint}
      accessibilityState={{ disabled: is_disabled, busy: !!props.loading }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: heights[size] || heights.medium,
          backgroundColor: look.fill,
          borderColor: look.border,
        },
        size === 'small' && styles.small,
        size === 'large' && styles.large,
        props.style,
        pressed && !is_disabled && styles.pressed,
        pressed && !is_disabled && look.pressed && { backgroundColor: look.pressed },
        is_disabled && styles.disabled,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={label_color} style={styles.icon} />
      ) : props.icon ? (
        // only draw the icon if one was passed in
        <Ionicons
          name={lineIcon(props.icon)}
          size={size === 'small' ? 18 : 22}
          color={label_color}
          style={styles.icon}
        />
      ) : null}
      <View style={styles.label_wrap}>
        <Text
          style={[styles.label, size === 'small' && styles.label_small, { color: label_color }]}
        >
          {props.title}
        </Text>
      </View>
    </Pressable>
  );
}

export default Button;

const styles = StyleSheet.create({
  button: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.button,
    borderWidth: BORDER.hairline,
    marginHorizontal: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  small: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm + SPACING.xs,
  },
  large: {
    paddingVertical: SPACING.sm + SPACING.xs,
    borderRadius: RADIUS.button,
  },
  // a little dim and shrink so a tap feels like a press, it doesn't move anything so reduce motion is fine
  // (the variants with a pressed color darken instead of fading)
  pressed: {
    opacity: OPACITY.subtle,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: OPACITY.disabled,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  // flexShrink lets a long title wrap instead of running off the button at big font sizes
  label_wrap: {
    flexShrink: 1,
  },
  label: {
    ...TYPE.button,
    textAlign: 'center',
  },
  label_small: {
    fontSize: TYPE.body_small.fontSize,
    lineHeight: TYPE.body_small.lineHeight,
  },
});
