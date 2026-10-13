import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SHADOWS, NUMBERS } from '../../theme';

// the big fact at the top of a screen: a small label, the key figure large, a caption, and room for extras under it
// variants: brand (the indigo card with white text, for the one overview card on a home screen) and plain (white card)
// props: label, value (already formatted), caption, variant, children (a sparkline, stat row, or buttons), style
function SummaryBlock(props) {
  const is_brand = props.variant === 'brand';
  return (
    <View
      style={[styles.block, is_brand ? styles.brand : styles.plain, props.style]}
      accessibilityRole="summary"
    >
      <View
        accessible
        accessibilityLabel={
          props.label + ', ' + props.value + (props.caption ? ', ' + props.caption : '')
        }
      >
        <Text style={[styles.label, is_brand && styles.label_brand]}>{props.label}</Text>
        <Text
          style={[styles.value, NUMBERS, is_brand && styles.value_brand]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {props.value}
        </Text>
        {props.caption ? (
          <Text style={[styles.caption, is_brand && styles.caption_brand]}>{props.caption}</Text>
        ) : null}
      </View>
      {props.children}
    </View>
  );
}

export default SummaryBlock;

const styles = StyleSheet.create({
  block: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg - SPACING.xs,
    gap: SPACING.xs,
  },
  plain: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
  },
  // the one floating card on a home screen, so it gets the soft shadow
  brand: {
    backgroundColor: COLORS.cta,
    ...SHADOWS.medium,
  },
  label: {
    ...TYPE.overline,
    color: COLORS.text_muted,
  },
  label_brand: {
    color: COLORS.on_brand_muted,
  },
  value: {
    ...TYPE.display,
    fontSize: 36,
    lineHeight: 44,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  value_brand: {
    color: COLORS.on_cta,
  },
  caption: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  caption_brand: {
    color: COLORS.on_brand_muted,
  },
});
