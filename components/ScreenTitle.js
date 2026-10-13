import { useEffect, useState } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReduceMotion } from './ui/useReduceMotion';
import { COLORS, SPACING, TYPE, RADIUS, BORDER } from '../theme';

// used AI to help create a shimmer behind each screen title

function ScreenTitle(props) {
  // I need the card width so I know how far the shine has to travel
  const [card_width, setCardWidth] = useState(0);
  // useState keeps the same animated value for the life of the card, without reading a ref during render
  const [shimmer_value] = useState(() => new Animated.Value(0));
  // with Reduce Motion on the shine stays parked off the card, so nothing moves
  const reduce_motion = useReduceMotion();

  // I loop the sweep forever, with a rest between passes
  useEffect(() => {
    if (reduce_motion !== false) {
      shimmer_value.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer_value, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.delay(2000),
        // I snap it back to the start while it's off the card so the next pass begins clean
        Animated.timing(shimmer_value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce_motion, shimmer_value]);

  const slide_x = shimmer_value.interpolate({
    inputRange: [0, 1],
    outputRange: [-card_width, card_width],
  });

  return (
    // overflow hidden keeps the shine clipped to the rounded corners
    <View style={styles.card} onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}>
      {/* the moving shine sits behind the text */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: slide_x }] }]}
      >
        <LinearGradient
          colors={[COLORS.shimmer_edge, COLORS.shimmer_peak, COLORS.shimmer_edge]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      {/* the title itself never moves */}
      <Text style={styles.title} accessibilityRole="header">
        {props.children}
      </Text>
    </View>
  );
}

export default ScreenTitle;

const styles = StyleSheet.create({
  // the hero card on the two homes: a raised navy panel with an amber edge along the bottom
  card: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.surface_raised,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border_strong,
    borderBottomWidth: BORDER.thick + 1,
    borderBottomColor: COLORS.cta,
    overflow: 'hidden',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPE.title,
    color: COLORS.title_text,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
