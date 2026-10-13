import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from './useReduceMotion';
import { MOTION } from '../../theme';

// fades its children in with a small rise, index staggers a group so they come in one after another
// with Reduce Motion on it just shows them, no movement at all
// props: index (default 0), style, children
function FadeInView(props) {
  const reduce_motion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // null means the setting hasn't been read yet, so I wait instead of starting and then snapping
    if (reduce_motion === null) {
      return undefined;
    }
    if (reduce_motion) {
      progress.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: MOTION.entrance - MOTION.stagger * 2,
      delay: (props.index || 0) * MOTION.stagger,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduce_motion, progress, props.index]);

  const rise = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    <Animated.View style={[props.style, { opacity: progress, transform: [{ translateY: rise }] }]}>
      {props.children}
    </Animated.View>
  );
}

export default FadeInView;
