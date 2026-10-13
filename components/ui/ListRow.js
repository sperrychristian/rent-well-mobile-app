import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES, OPACITY } from '../../theme';

// one row in a list: something on the left (an icon or an avatar), a title and a subtitle, and a value or chevron on the right
// props: title, subtitle, icon, icon_color, avatar_name, trailing (text or a node), chevron, onPress,
//   divider (a line under it), accessibilityLabel, accessibilityHint, style
function ListRow(props) {
  const leading = props.avatar_name ? (
    <Avatar name={props.avatar_name} />
  ) : props.icon ? (
    <View style={styles.icon_box}>
      <Ionicons name={props.icon} size={SIZES.icon} color={props.icon_color || COLORS.info_text} />
    </View>
  ) : null;

  const trailing =
    typeof props.trailing === 'string' ? (
      <Text style={styles.trailing_text}>{props.trailing}</Text>
    ) : (
      props.trailing || null
    );

  const content = (
    <>
      {leading}
      <View style={styles.middle}>
        <Text style={styles.title}>{props.title}</Text>
        {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
      </View>
      {trailing}
      {props.chevron || (props.onPress && props.chevron !== false) ? (
        <Ionicons name="chevron-forward" size={SIZES.icon} color={COLORS.text_muted} />
      ) : null}
    </>
  );

  const row_style = [styles.row, props.divider && styles.divider, props.style];

  if (!props.onPress) {
    return <View style={row_style}>{content}</View>;
  }
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={
        props.accessibilityLabel || [props.title, props.subtitle].filter(Boolean).join(', ')
      }
      accessibilityHint={props.accessibilityHint}
      style={({ pressed }) => [...row_style, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export default ListRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: SIZES.touch + SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  divider: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.border,
  },
  pressed: {
    opacity: OPACITY.pressed,
  },
  icon_box: {
    width: SIZES.avatar,
    height: SIZES.avatar,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface_raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
  },
  title: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
  subtitle: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  trailing_text: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
});
