import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { statusTone, tone_colors } from './uiHelpers';
import { SPACING, TYPE, RADIUS } from '../../theme';

// a small colored pill for a status or tag, it always shows the words (and an icon) so it's never color only
// props: label (the status text, like Open or Resolved), tone (optional, a status name to borrow colors from),
//   show_icon (default true), style
// the fintech pass: tone can also be a plain tone name (danger, warning, info, neutral...) with icon picking the icon,
// for tags that aren't statuses, like an expiring lease
function StatusPill(props) {
  const plain_tone = tone_colors[props.tone];
  const tone = plain_tone
    ? { fill: plain_tone.tint, text: plain_tone.text, icon: props.icon || null }
    : statusTone(props.tone || props.label);
  const show_icon = props.show_icon !== false && tone.icon;
  return (
    <View
      style={[styles.pill, { backgroundColor: tone.fill }, props.style]}
      accessibilityLabel={props.label}
    >
      {show_icon ? (
        <Ionicons name={tone.icon} size={12} color={tone.text} style={styles.icon} />
      ) : null}
      <Text style={[styles.text, { color: tone.text }]}>{props.label}</Text>
    </View>
  );
}

export default StatusPill;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xxs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  icon: {
    marginRight: SPACING.xs,
  },
  text: {
    ...TYPE.label,
    fontSize: TYPE.caption.fontSize,
    lineHeight: TYPE.caption.lineHeight,
  },
});
