import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPE, SIZES } from '../../theme';

// a small heading over a group of rows or cards, with an optional count and an action on the right
// props: title, count, action_label, onAction, style
function SectionHeader(props) {
  return (
    <View style={[styles.row, props.style]}>
      <Text style={styles.title} accessibilityRole="header">
        {props.title}
        {props.count !== undefined && props.count !== null ? (
          <Text style={styles.count}>{'  ' + props.count}</Text>
        ) : null}
      </Text>
      {props.action_label ? (
        <Pressable
          onPress={props.onAction}
          hitSlop={SPACING.sm}
          accessibilityRole="button"
          accessibilityLabel={props.action_label}
          style={styles.action}
        >
          <Text style={styles.action_text}>{props.action_label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default SectionHeader;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPE.label,
    color: COLORS.text_muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  count: {
    color: COLORS.text_muted,
  },
  action: {
    minHeight: SIZES.touch,
    justifyContent: 'center',
  },
  action_text: {
    ...TYPE.label,
    color: COLORS.info_text,
  },
});
