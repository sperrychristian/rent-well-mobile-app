import { chip_styles } from './Chip';
import { SPACING, TYPE, RADIUS, BORDER, SIZES, NUMBERS } from '../../theme';
import { themedStyles } from '../../utils/themedStyles';

// the pieces every list screen's filter bar shares (search box, segmented control, chips, offline note, empty text)
// screens spread these into their own style names so the JSX didn't have to change, and they all match now
// the fintech pass: the segment is a gray track with a white pill (same as SegmentedControl), banners are tinted
export const list_styles = themedStyles((COLORS) => ({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // the Hearth pass: white boxes with a hairline edge and small corners, 52 tall like the buttons
  search_input: {
    ...TYPE.input,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.hairline,
    minHeight: SIZES.button_medium,
    paddingHorizontal: SPACING.md - SPACING.xs,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm + SPACING.xs,
  },
  // the Hearth pass: tabs on a hairline, the picked one underlined in green, no track or pill
  segment: {
    borderBottomWidth: BORDER.hairline,
    borderBottomColor: COLORS.hairline,
    flexDirection: 'row',
    marginBottom: SPACING.sm + SPACING.xs,
  },
  segment_option: {
    flex: 1,
    minHeight: SIZES.touch,
    borderBottomWidth: BORDER.thick,
    borderBottomColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
  },
  segment_active: {
    borderBottomColor: COLORS.cta,
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
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.sm,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.hairline,
    minHeight: SIZES.button_medium,
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
  // the Hearth pass: no box, a hairline on top like the shared ListRow
  row: {
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
    minHeight: SIZES.row_min_height,
    paddingVertical: SPACING.md,
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
}));
