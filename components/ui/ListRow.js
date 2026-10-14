import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { toneColors } from './uiHelpers';
import { lineIcon } from './lineIcon';
import { COLORS, SPACING, TYPE, BORDER, SIZES, NUMBERS } from '../../theme';

// one row in a list: something on the left (an icon or an avatar), a title and a subtitle, and a value or chevron on the right
// props: title, subtitle, icon, icon_color, avatar_name, trailing (text or a node), chevron, onPress,
//   icon_tone (the fintech pass draws the icon in a tinted circle, brand by default),
//   divider (a line under it), accessibilityLabel, accessibilityHint, style
// the Hearth pass: no card and no circle, a plain 24pt line icon in green, a 17 medium title, a muted subtitle
// (subtitle_tone danger makes it terracotta for anything overdue), a hairline on top of every row, and the
// last row (the one with no divider) gets a hairline under it too, so a list reads as one ruled block
function ListRow(props) {
  const icon_color = props.icon_tone ? toneColors(props.icon_tone).text : COLORS.cta;
  const leading = props.avatar_name ? (
    <Avatar name={props.avatar_name} />
  ) : props.icon ? (
    <View
      style={styles.icon_box}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={lineIcon(props.icon)} size={SIZES.row_icon} color={icon_color} />
    </View>
  ) : null;
  const trailing =
    typeof props.trailing === 'string' ? (
      <Text style={[styles.trailing_text, NUMBERS]}>{props.trailing}</Text>
    ) : (
      props.trailing || null
    );
  const content = (
    <>
      {leading}
      <View style={styles.middle}>
        <Text style={styles.title}>{props.title}</Text>
        {props.subtitle ? (
          <Text
            style={[styles.subtitle, props.subtitle_tone === 'danger' && styles.subtitle_danger]}
          >
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {props.chevron || (props.onPress && props.chevron !== false) ? (
        <Ionicons name="chevron-forward" size={SIZES.chevron} color={COLORS.text_muted} />
      ) : null}
    </>
  );
  const row_style = [styles.row, !props.divider && styles.last, props.style];
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
    minHeight: SIZES.row_min_height,
    paddingVertical: SPACING.sm + SPACING.xs,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  // the last row closes the list with a line under it
  last: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.hairline,
  },
  pressed: {
    backgroundColor: COLORS.surface_raised,
  },
  icon_box: {
    width: SIZES.row_icon,
    alignItems: 'center',
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
  subtitle_danger: {
    color: COLORS.danger_text,
  },
  trailing_text: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
});
