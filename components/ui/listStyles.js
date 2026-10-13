import { StyleSheet } from 'react-native';
import { chip_styles } from './Chip';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES, SHADOWS, NUMBERS } from '../../theme';

// the pieces every list screen's filter bar shares (search box, segmented control, chips, offline note, empty text)
// screens spread these into their own style names so the JSX didn't have to change, and they all match now
// the fintech pass: the segment is a gray track with a white pill (same as SegmentedControl), banners are tinted
export const list_styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  search_input: {
    ...TYPE.input,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border_strong,
    minHeight: SIZES.touch,
    paddingHorizontal: SPACING.md - SPACING.xs,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm + SPACING.xs,
  },
  segment: {
    backgroundColor: COLORS.neutral_tint,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    padding: SPACING.xs,
    marginBottom: SPACING.sm + SPACING.xs,
  },
  segment_option: {
    borderRadius: RADIUS.sm,
    flex: 1,
    minHeight: SIZES.touch - SPACING.xs,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
  },
  segment_active: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    ...SHADOWS.low,
  },
  segment_text: {
    ...TYPE.label,
    color: COLORS.text,
    textAlign: 'center',
  },
  chip_row: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingBottom: SPACING.sm + SPACING.xs,
  },
  chip: chip_styles.chip,
  chip_active: chip_styles.chip_active,
  chip_text: chip_styles.chip_text,
  label: {
    ...TYPE.overline,
    color: COLORS.text_muted,
  },
  offline_banner: {
    backgroundColor: COLORS.warning_tint,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.warning,
    padding: SPACING.sm + SPACING.xs,
    marginBottom: SPACING.sm + SPACING.xs,
  },
  offline_text: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.warning_text,
    textAlign: 'center',
  },
  empty_text: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  // a text box inside a card, it sits a shade darker than the card so it reads as a field
  field_input: {
    ...TYPE.input,
    backgroundColor: COLORS.surface_sunken,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border_strong,
    minHeight: SIZES.touch,
    paddingHorizontal: SPACING.md - SPACING.xs,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  // one row in a plain list, used where a screen draws its own rows instead of cards
  row: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm + SPACING.xs,
  },
  detail: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
  },
  title: {
    ...TYPE.subheading,
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.text,
  },
  // amounts in rows and columns, tabular digits so they line up
  money: {
    ...TYPE.subheading,
    ...NUMBERS,
    color: COLORS.text,
  },
});
