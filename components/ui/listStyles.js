import { StyleSheet } from 'react-native';
import { chip_styles } from './Chip';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES } from '../../theme';

// the pieces every list screen's filter bar shares (search box, segmented control, chips, offline note, empty text)
// screens spread these into their own style names so the JSX didn't have to change, and they all match now
export const list_styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  search_input: {
    ...TYPE.input,
    minHeight: SIZES.touch,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md - SPACING.xs,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm + SPACING.xs,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    padding: SPACING.xs,
    marginBottom: SPACING.sm + SPACING.xs,
  },
  segment_option: {
    flex: 1,
    minHeight: SIZES.touch - SPACING.xs,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  segment_active: {
    backgroundColor: COLORS.primary,
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
    ...TYPE.label,
    color: COLORS.text_muted,
  },
  offline_banner: {
    backgroundColor: COLORS.warning,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + SPACING.xs,
    marginBottom: SPACING.sm + SPACING.xs,
  },
  offline_text: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.on_light,
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
    minHeight: SIZES.touch,
    backgroundColor: COLORS.surface_sunken,
    color: COLORS.text,
    borderRadius: RADIUS.md,
    borderWidth: BORDER.thin,
    borderColor: COLORS.border,
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
});
