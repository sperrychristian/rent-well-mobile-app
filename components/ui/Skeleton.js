import { useEffect, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useReduceMotion } from './useReduceMotion';
import { COLORS, SPACING, RADIUS, BORDER } from '../../theme';

// grey placeholder rows that stand in for a list while it loads, so the screen doesn't jump when the data shows up
// they pulse gently, or sit still when Reduce Motion is on
// props: rows (how many, default 4), style
function SkeletonList(props) {
  const reduce_motion = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    if (reduce_motion !== false) {
      pulse.setValue(0.8);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce_motion, pulse]);

  const count = props.rows || 4;
  return (
    <View
      style={[styles.list, props.style]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {Array.from({ length: count }).map((unused, index) => (
        <Animated.View key={index} style={[styles.row, { opacity: pulse }]}>
          <View style={styles.circle} />
          <View style={styles.lines}>
            <View style={[styles.line, styles.line_long]} />
            <View style={[styles.line, styles.line_short]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

export default SkeletonList;

const styles = StyleSheet.create({
  list: {
    alignSelf: 'stretch',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.skeleton,
  },
  lines: {
    flex: 1,
    gap: SPACING.sm,
  },
  line: {
    height: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.skeleton_shine,
  },
  line_long: {
    width: '75%',
  },
  line_short: {
    width: '45%',
    backgroundColor: COLORS.skeleton,
  },
});
