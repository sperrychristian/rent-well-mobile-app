import { View, Text, Pressable, StyleSheet } from 'react-native';
import IconCircle from './IconCircle';
import Badge from './Badge';
import { COLORS, SPACING, TYPE, RADIUS, SIZES } from '../../theme';

// one round shortcut in a Quick Actions row: an icon circle with a short label under it, and an optional badge
// props: label, icon, tone, badge_count, badge_label, onPress, accessibilityLabel, style
function QuickAction(props) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={
        props.accessibilityLabel ||
        props.label + (props.badge_count ? ', ' + (props.badge_label || props.badge_count) : '')
      }
      style={({ pressed }) => [styles.action, props.style, pressed && styles.pressed]}
    >
      <View>
        <IconCircle icon={props.icon} tone={props.tone} size={SIZES.avatar_large - SPACING.xs} />
        <Badge count={props.badge_count} label={props.badge_label} style={styles.badge} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export default QuickAction;

const styles = StyleSheet.create({
  action: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs + SPACING.xxs,
    minHeight: SIZES.touch,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
  },
  badge: {
    position: 'absolute',
    top: -SPACING.xs,
    right: -SPACING.sm,
  },
  label: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.text,
    textAlign: 'center',
  },
});
