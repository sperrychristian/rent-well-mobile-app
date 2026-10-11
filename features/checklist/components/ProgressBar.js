import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../../theme';

// a thin bar that fills up as items get checked off, props are done and total
function ProgressBar(props) {
  // an empty room would divide by zero, so it just shows an empty bar
  const fraction = props.total > 0 ? props.done / props.total : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: fraction * 100 + '%' }]} />
    </View>
  );
}

export default ProgressBar;

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.success,
  },
});
