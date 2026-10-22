import { StyleSheet } from 'react-native';
import { themed } from '../theme';

// a style sheet that follows the theme: build gets the active palette (named COLORS in each file, so the
// styles inside read exactly like before) and runs once per palette, so light and dark each have their own
// sheet and switching never rebuilds them while a screen draws
export function themedStyles(build) {
  return themed((palette) => StyleSheet.create(build(palette)));
}
