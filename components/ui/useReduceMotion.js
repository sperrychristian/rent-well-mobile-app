import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

// true when the phone's Reduce Motion setting is on, every animation in the app checks this and skips itself
// it's null for the split second before the setting is read, so an entrance can wait instead of jumping
export function useReduceMotion() {
  const [reduce_motion, setReduceMotion] = useState(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) {
          setReduceMotion(!!enabled);
        }
      })
      .catch(() => {
        if (active) {
          setReduceMotion(false);
        }
      });
    // it can change while the app is open, from Settings or Control Center
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) =>
      setReduceMotion(!!enabled),
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduce_motion;
}
