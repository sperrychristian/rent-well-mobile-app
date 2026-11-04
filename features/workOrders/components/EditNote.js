import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// the short line a detail screen shows instead of the Edit button, so it never just disappears without a reason
// props: reason
function EditNote(props) {
  if (!props.reason) {
    return null;
  }
  return (
    <View style={styles.row} accessible accessibilityLabel={'Editing is off. ' + props.reason}>
      <Ionicons name="lock-closed-outline" size={SIZES.icon_small} color={COLORS.text_muted} />
      <Text style={styles.text}>{props.reason}</Text>
    </View>
  );
}

export default EditNote;

const styles = themedStyles((COLORS) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  text: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    flexShrink: 1,
  },
}));
