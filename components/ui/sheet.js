import { View, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, BORDER, SHADOWS, SIZES } from '../../theme';

// the shared look for every bottom sheet and pop-up modal, the modals keep their own layout and spread these in
// (the fintech pass: white sheets on a soft ink backdrop, a hairline border, and one soft floating shadow)

// the little grab bar at the top of a bottom sheet, it's only a visual cue so screen readers skip it
export function SheetHandle() {
  return <View style={sheet_styles.handle} accessible={false} importantForAccessibility="no" />;
}

export const sheet_styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
  },
  // a sheet that comes up from the bottom
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    ...SHADOWS.high,
  },
  // a box in the middle of the screen
  // the Hearth pass: sheets and pop-ups are the one place with a shadow, on 12 corners
  dialog: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    padding: SPACING.md,
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
    ...SHADOWS.high,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.border_strong,
    marginBottom: SPACING.sm,
  },
  // the row of buttons at the bottom, Cancel on the left and the main action on the right
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  // inputs inside a sheet sit on the page color so they stand out from the sheet
  input: {
    backgroundColor: COLORS.surface_sunken,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.hairline,
    borderRadius: RADIUS.sm,
    color: COLORS.text,
  },
});
