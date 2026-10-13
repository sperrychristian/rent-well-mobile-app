import { View, Text, StyleSheet } from 'react-native';
import { badgeLabel } from './uiHelpers';
import { COLORS, FONTS, SPACING, RADIUS, BORDER } from '../../theme';

// a small count bubble, it hides itself at zero
// props: count, label (what a screen reader says, like "3 unread messages"), tone (danger or cta), style
function Badge(props) {
  const text = badgeLabel(props.count);
  if (text === '') {
    return null;
  }
  const is_cta = props.tone === 'cta';
  return (
    <View
      style={[styles.badge, is_cta ? styles.cta : styles.danger, props.style]}
      accessibilityLabel={props.label || text}
    >
      <Text style={[styles.text, is_cta && styles.cta_text]}>{text}</Text>
    </View>
  );
}

export default Badge;

const styles = StyleSheet.create({
  badge: {
    minWidth: 22,
    minHeight: 22,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xs + SPACING.xxs,
    alignItems: 'center',
    justifyContent: 'center',
    // the ring keeps it readable where it overlaps a button corner
    borderWidth: BORDER.thick,
    borderColor: COLORS.background,
  },
  danger: {
    backgroundColor: COLORS.danger,
  },
  cta: {
    backgroundColor: COLORS.cta,
  },
  text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 12,
    lineHeight: 16,
  },
  cta_text: {
    color: COLORS.on_cta,
  },
});
