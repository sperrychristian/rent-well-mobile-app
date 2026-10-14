import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Text, View, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useReduceMotion } from './useReduceMotion';
import { lineIcon } from './lineIcon';
import { COLORS, SPACING, TYPE, RADIUS, SIZES } from '../../theme';

// a short dark bar at the bottom for routine success ("Payment recorded"), it goes away by itself
// one host at the root so a toast still shows after the form that started it closes or the screen goes back
// screens call useToast().show(text, icon), screen readers hear the same words
const ToastContext = createContext(null);

const show_ms = 2600;

export function ToastProvider(props) {
  const reduce_motion = useReduceMotion();
  // the insets come from the nearest safe area provider when there is one, otherwise a plain gap
  const insets = useContext(SafeAreaInsetsContext);
  const [toast, setToast] = useState(null);
  const [fade] = useState(() => new Animated.Value(0));
  const timer = useRef(null);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const show = useCallback(
    (text, icon) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      setToast({ text: text, icon: icon || 'checkmark-circle' });
      AccessibilityInfo.announceForAccessibility(text);
      if (reduce_motion === false) {
        fade.setValue(0);
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      } else {
        fade.setValue(1);
      }
      timer.current = setTimeout(() => setToast(null), show_ms);
    },
    [reduce_motion, fade],
  );

  return (
    <ToastContext.Provider value={show}>
      {props.children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { bottom: (insets ? insets.bottom : 0) + SPACING.lg, opacity: fade },
          ]}
        >
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <Ionicons name={lineIcon(toast.icon)} size={SIZES.icon} color={COLORS.text_light} />
            <Text style={styles.text}>{toast.text}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

// { show } for screens, it does nothing (and doesn't crash) when there's no provider, like in a test
export function useToast() {
  const show = useContext(ToastContext);
  return { show: show || (() => {}) };
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    maxWidth: SIZES.content_max_width,
    minHeight: SIZES.touch,
    // the Hearth pass: an ink pill with white words, no edge or shadow
    backgroundColor: COLORS.toast_background,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  text: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.text_light,
    flexShrink: 1,
  },
});
