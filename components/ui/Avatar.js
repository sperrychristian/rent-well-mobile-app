import { View, Text, StyleSheet } from 'react-native';
import { initialsFor } from './uiHelpers';
import { COLORS, SIZES, FONTS, BORDER } from '../../theme';

// a circle with someone's initials, the same name always gets the same color
// props: name, size (default SIZES.avatar), style
function Avatar(props) {
  const size = props.size || SIZES.avatar;
  // the fintech pass: a soft tint with the initials in its darker color
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          // the Hearth pass: a hairline ring with ink initials, no color behind them
          borderWidth: BORDER.hairline,
          borderColor: COLORS.border_strong,
        },
        props.style,
      ]}
      // the name is read out by the row it sits in, so the circle itself stays quiet
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={[styles.initials, { fontSize: Math.round(size * 0.38), color: COLORS.text }]}
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
    fontFamily: FONTS.medium,
  },
});
