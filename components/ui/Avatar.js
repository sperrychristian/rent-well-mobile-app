import { View, Text, StyleSheet } from 'react-native';
import { initialsFor, avatarFill } from './uiHelpers';
import { COLORS, SIZES, FONTS } from '../../theme';

// a circle with someone's initials, the same name always gets the same color
// props: name, size (default SIZES.avatar), style
function Avatar(props) {
  const size = props.size || SIZES.avatar;
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarFill(props.name),
        },
        props.style,
      ]}
      // the name is read out by the row it sits in, so the circle itself stays quiet
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}
        allowFontScaling={false}
      >
        {initialsFor(props.name)}
      </Text>
    </View>
  );
}

export default Avatar;

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
  },
});
