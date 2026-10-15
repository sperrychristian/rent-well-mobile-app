import { View, Pressable, StyleSheet } from 'react-native';
import Wordmark from '../../../components/ui/Wordmark';
import Avatar from '../../../components/ui/Avatar';
import { SPACING, SIZES, OPACITY } from '../../../theme';

// the Hearth top of both homes: the wordmark on the left and the person's initials on the right
// the initials open Settings and Profile, the same place the header's gear goes
// props: name (whose initials), onProfile
function HomeTopBar(props) {
  return (
    <View style={styles.bar}>
      <Wordmark size="small" tagline={null} align="left" />
      <Pressable
        onPress={props.onProfile}
        accessibilityRole="button"
        accessibilityLabel="Settings and profile"
        style={({ pressed }) => [styles.avatar_press, pressed && styles.pressed]}
      >
        <Avatar name={props.name} size={SIZES.header_avatar} />
      </Pressable>
    </View>
  );
}

export default HomeTopBar;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  avatar_press: {
    minWidth: SIZES.touch,
    minHeight: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: OPACITY.faint,
  },
});
