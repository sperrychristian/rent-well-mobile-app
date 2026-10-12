import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../../theme';

// a red circle with the unread count, it hides itself at zero
// props: count, style (to position it)
function UnreadBadge(props) {
  if (!props.count) {
    return null;
  }
  const label = props.count > 99 ? '99+' : String(props.count);
  return (
    <View
      style={[styles.badge, props.style]}
      accessibilityLabel={
        props.count + (props.count === 1 ? ' unread message' : ' unread messages')
      }
    >
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export default UnreadBadge;

const styles = StyleSheet.create({
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 12,
  },
});
