import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import Badge from './Badge';
import { COLORS, SPACING, TYPE, RADIUS, SIZES } from '../../theme';
import IconCircle from './IconCircle';

// one tappable card in a home screen grid: a colored icon square, a title, a short line, and an optional count badge
// props: title, detail, icon, fill (a theme fill color for the icon square), icon_color (default white),
//   badge_count, badge_label, onPress, accessibilityLabel, style
// the fintech pass: tone picks a tinted icon circle instead (fill and icon_color still work for a solid square)
function FeatureTile(props) {
  return (
    <Card
      variant="interactive"
      onPress={props.onPress}
      accessibilityLabel={props.accessibilityLabel || props.title}
      style={[styles.tile, props.style]}
    >
      <View style={styles.top_row}>
        {props.tone || !props.fill ? (
          <IconCircle icon={props.icon} tone={props.tone || 'brand'} />
        ) : (
          <View style={[styles.icon_square, { backgroundColor: props.fill }]}>
            <Ionicons
              name={props.icon}
              size={SIZES.icon_large - 4}
              color={props.icon_color || COLORS.text_light}
            />
          </View>
        )}
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
    minHeight: 112,
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
    color: COLORS.text,
  },
  detail: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.xxs,
  },
});
