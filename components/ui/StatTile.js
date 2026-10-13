import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, NUMBERS } from '../../theme';

// one number in a home screen's summary row, like 3 open work orders
// props: value, label, icon, color (a text-safe theme color for the icon and number), style
function StatTile(props) {
  const color = props.color || COLORS.text;
  return (
    <View
      style={[styles.tile, props.style]}
      accessible
      accessibilityLabel={props.value + ' ' + props.label}
    >
      <View style={styles.top_row}>
        {props.icon ? <Ionicons name={props.icon} size={16} color={color} /> : null}
        <Text style={[styles.value, { color: color }]}>{props.value}</Text>
      </View>
      <Text style={styles.label}>{props.label}</Text>
    </View>
  );
}

export default StatTile;

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm + SPACING.xs,
    paddingHorizontal: SPACING.sm + SPACING.xs,
  },
  top_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + SPACING.xxs,
  },
  value: {
    ...TYPE.title,
    ...NUMBERS,
  },
  label: {
    ...TYPE.caption,
    color: COLORS.text_muted,
  },
});
