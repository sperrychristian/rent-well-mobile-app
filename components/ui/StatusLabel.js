import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { statusTone, tone_colors } from './uiHelpers';
import { lineIcon } from './lineIcon';
import { SPACING, TYPE, SIZES } from '../../theme';

// a status as a small line icon and colored words, no pill behind it (the Hearth pass)
// green for paid or done, terracotta for overdue or urgent, muted for neutral, and always the words too
// props: label (the words), tone (a status name like Open or Paid, or a plain tone: success, danger, warning,
//   info, accent, neutral, brand), icon (picks the icon for a plain tone), show_icon (default true), style
function StatusLabel(props) {
  const plain_tone = tone_colors[props.tone];
  const tone = plain_tone
    ? { text: plain_tone.text, icon: props.icon || null }
    : statusTone(props.tone || props.label);
  const color = tone.label_color || tone.text;
  const icon = props.icon || tone.icon;
  const show_icon = props.show_icon !== false && icon;
  return (
    <View style={[styles.row, props.style]} accessibilityLabel={props.label}>
      {show_icon ? (
        <Ionicons
          name={lineIcon(icon)}
          size={SIZES.icon_small}
          color={color}
          style={styles.icon}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : null}
      <Text style={[styles.text, { color: color }]}>{props.label}</Text>
    </View>
  );
}

export default StatusLabel;

const styles = StyleSheet.create({
  // the icon sits on the first line when the words wrap
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
  },
  icon: {
    marginTop: SPACING.xxs,
  },
  text: {
    ...TYPE.label,
    flexShrink: 1,
  },
});
