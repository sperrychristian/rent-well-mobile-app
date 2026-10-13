import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toneColors } from './uiHelpers';
import { SIZES, RADIUS } from '../../theme';

// a soft tinted circle with an icon in the matching darker color, the leading piece of rows, tiles, and actions
// it's decoration next to a label, so screen readers skip it and read the label instead
// props: icon, tone (brand, success, info, accent, warning, danger, neutral), size (default SIZES.icon_circle), style
function IconCircle(props) {
  const size = props.size || SIZES.icon_circle;
  const colors = toneColors(props.tone || 'brand');
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, backgroundColor: colors.tint },
        props.style,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={props.icon} size={Math.round(size * 0.5)} color={colors.text} />
    </View>
  );
}

export default IconCircle;

const styles = StyleSheet.create({
  circle: {
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
