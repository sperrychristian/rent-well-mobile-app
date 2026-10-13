import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import Badge from './Badge';
import { COLORS, SPACING, TYPE, RADIUS, SIZES } from '../../theme';

// one tappable card in a home screen grid: a colored icon square, a title, a short line, and an optional count badge
// props: title, detail, icon, fill (a theme fill color for the icon square), icon_color (default white),
//   badge_count, badge_label, onPress, accessibilityLabel, style
function FeatureTile(props) {
  return (
    <Card
      variant="interactive"
      onPress={props.onPress}
      accessibilityLabel={props.accessibilityLabel || props.title}
      style={[styles.tile, props.style]}
    >
      <View style={styles.top_row}>
        <View style={[styles.icon_square, { backgroundColor: props.fill || COLORS.primary }]}>
          <Ionicons
            name={props.icon}
            size={SIZES.icon_large - 4}
            color={props.icon_color || COLORS.text_light}
          />
        </View>
        <Badge count={props.badge_count} label={props.badge_label} />
      </View>
      <Text style={styles.title}>{props.title}</Text>
      {props.detail ? <Text style={styles.detail}>{props.detail}</Text> : null}
    </Card>
  );
}

export default FeatureTile;

const styles = StyleSheet.create({
  tile: {
    minHeight: 120,
  },
  top_row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm + SPACING.xs,
  },
  icon_square: {
    width: SIZES.avatar,
    height: SIZES.avatar,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TYPE.subheading,
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.text,
  },
  detail: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.xxs,
  },
});
