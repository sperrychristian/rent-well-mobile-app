import { Text, Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toneColors } from '../../../components/ui/uiHelpers';
import { COLORS, SPACING, TYPE, SIZES, OPACITY } from '../../../theme';

// the one line under a home's hero number: a line icon and words in the tone's color
// terracotta for "2 tenants are behind", green for all paid up, it opens Payments when it's tappable
// props: text, tone (danger, success, warning, neutral), icon, onPress (optional), accessibilityHint
function HeroNote(props) {
  const color = props.tone === 'neutral' ? COLORS.text_muted : toneColors(props.tone).text;
  const content = (
    <>
      <Ionicons name={props.icon} size={SIZES.icon} color={color} />
      <Text style={[styles.text, { color: color }]}>{props.text}</Text>
      {props.onPress ? (
        <Ionicons name="chevron-forward" size={SIZES.chevron} color={color} />
      ) : null}
    </>
  );
  if (!props.onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={props.text}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.text}
      accessibilityHint={props.accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export default HeroNote;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: SIZES.touch,
  },
  pressed: {
    opacity: OPACITY.faint,
  },
  text: {
    ...TYPE.body,
    fontFamily: TYPE.label.fontFamily,
    flexShrink: 1,
  },
});
