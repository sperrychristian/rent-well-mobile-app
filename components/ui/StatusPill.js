import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { statusTone } from './uiHelpers';
import { SPACING, TYPE, RADIUS } from '../../theme';

// a small colored pill for a status or tag, it always shows the words (and an icon) so it's never color only
// props: label (the status text, like Open or Resolved), tone (optional, a status name to borrow colors from),
//   show_icon (default true), style
function StatusPill(props) {
  const tone = statusTone(props.tone || props.label);
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
    fontSize: 12,
    lineHeight: 16,
  },
});
