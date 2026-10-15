import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toneColors } from './uiHelpers';
import { lineIcon } from './lineIcon';
import { SIZES } from '../../theme';

// a soft tinted circle with an icon in the matching darker color, the leading piece of rows, tiles, and actions
// it's decoration next to a label, so screen readers skip it and read the label instead
// props: icon, tone (brand, success, info, accent, warning, danger, neutral), size (default SIZES.icon_circle), style
// the Hearth pass took the circle away: it's just the line icon now, in the tone's color, and it keeps a square
// box the size it was so nothing next to it moves
function IconCircle(props) {
  const size = props.size || SIZES.icon_circle;
  const colors = toneColors(props.tone || 'brand');
  return (
    <View
      style={[styles.circle, { width: size, height: size }, props.style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons
        name={lineIcon(props.icon)}
        size={Math.min(Math.round(size * 0.6), SIZES.row_icon)}
        color={colors.text}
      />
    </View>
  );
}

export default IconCircle;

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
