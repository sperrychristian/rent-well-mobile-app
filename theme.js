// the design system lives here: every color, size, and font in the app comes from these tokens
// the design pass made the navy the real base (dark navy surfaces with light text) and added a sunrise amber
// for the main call to action, theme.test.js checks the contrast of every text and surface pair below
// the fintech pass flipped it to a light theme: white cards on a soft cool gray, ink navy text, one indigo
// brand color for the main action, and a soft tint behind each state color for pills and banners
// the Hearth pass made it warm and quiet: paper background, ink text, hairlines instead of cards,
// one forest green for actions and good news, and terracotta for anything overdue or urgent
// the token names stayed the same so every screen picks up the new look without changes

export const COLORS = {
  // ----- base -----
  // primary is the indigo brand color, selected chips and the plain buttons use it with white text
  primary: '#2F5D4A',
  background: '#F7F3EC',
  text: '#2A2520',
  // muted is the card and input surface (same as surface), the name stayed so old styles keep working
  muted: '#FFFFFF',
  // title is the header and heading color, ink navy on the light theme
  title: '#2A2520',
  title_text: '#2A2520',

  // ----- surfaces and lines -----
  surface: '#FFFFFF',
  // rows and secondary buttons inside a white card, a hair grayer than the card
  surface_raised: '#F1EBE0',
  // text boxes sit on this so they read as fields
  surface_sunken: '#FFFFFF',
  border: '#E4DCCF',
  border_strong: '#CFC4B2',
  text_muted: '#6B6259',
  // ink text for the light fills (amber, yellow)
  on_light: '#2A2520',

  // Hearth: the hairline under rows and around inputs (same as border, named for what it's for)
  hairline: '#E4DCCF',

  // ----- the brand call to action (the name stayed from the amber days) -----
  cta: '#2F5D4A',
  cta_pressed: '#244A3A',
  on_cta: '#FFFFFF',
  focus: '#2F5D4A',
  brand_tint: '#E8EFEA',
  // the quieter text on top of the indigo summary card
  on_brand_muted: '#DCE8E1',

  // ----- actions and states as fills, white text on them is AA -----
  success: '#2F5D4A',
  action: '#3E5C76',
  info: '#3E5C76',
  accent: '#6B4E71',
  highlight: '#E9C46A',
  warning: '#D9A441',
  danger: '#A8442A',
  secondary: '#6B6259',

  // ----- the same states as text or icons on white or gray -----
  success_text: '#2F5D4A',
  info_text: '#3E5C76',
  accent_text: '#6B4E71',
  warning_text: '#83560F',
  danger_text: '#A8442A',

  // ----- soft tints behind each state, for pills and banners (the matching _text color sits on them) -----
  success_tint: '#E8EFEA',
  info_tint: '#E9EEF2',
  accent_tint: '#F0EAF0',
  warning_tint: '#F6ECD9',
  danger_tint: '#F6E6DF',
  neutral_tint: '#EFE9DF',

  // ----- text on colored buttons -----
  text_light: '#FFFFFF',
  text_dark: '#2A2520',

  // ----- other surfaces -----
  surface_light: '#FFFFFF',
  toast_background: '#2A2520',
  skeleton: '#EDE6DA',
  skeleton_shine: '#F3EEE6',

  // ----- priority -----
  priority_emergency: '#A8442A',
  priority_low: '#3E5C76',

  // ----- expense tags -----
  tag_billed: '#2F5D4A',
  tag_recurring: '#5E554C',
  tag_missing_receipt: '#83560F',

  // ----- overlays -----
  backdrop: 'rgba(42,37,32,0.40)',
  photo_backdrop: 'black',
  shadow: '#2A2520',
  shimmer_edge: 'rgba(255,255,255,0)',
  shimmer_peak: 'rgba(255,255,255,0.22)',
};

// one step for every gap, padding, and margin
export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // Hearth: the big gap above a hero number and between sections
  xxxl: 64,
};

export const FONT_SIZES = {
  caption: 12,
  small: 14,
  label: 13,
  body: 16,
  heading: 18,
  title: 24,
  display: 32,
};

export const FONTS = {
  // Hearth: DM Sans for everything you read, Fraunces only for the wordmark, big numbers, and names
  heading: 'DMSans_600SemiBold',
  subheading: 'DMSans_600SemiBold',
  medium: 'DMSans_500Medium',
  body: 'DMSans_400Regular',
  body_bold: 'DMSans_600SemiBold',
  serif: 'Fraunces_400Regular',
  serif_medium: 'Fraunces_500Medium',
};

// the type scale: each style has its font, size, and line height so text lines up the same everywhere
// line heights are about 1.3 to 1.5 times the size, which keeps larger system font sizes from clipping
// the fintech pass tightened it: bold display figures with tight tracking, semibold headings, and small caps labels
export const TYPE = {
  // the Hearth pass: Fraunces for the few big moments (display, title, figure, and the new hero and number),
  // DM Sans everywhere else, row titles at 17 medium, and section labels in spaced-out caps
  display: { fontFamily: FONTS.serif, fontSize: 32, lineHeight: 40, letterSpacing: -0.4 },
  title: { fontFamily: FONTS.serif_medium, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  heading: { fontFamily: FONTS.subheading, fontSize: 17, lineHeight: 24 },
  subheading: { fontFamily: FONTS.medium, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: FONTS.body, fontSize: 16, lineHeight: 24 },
  body_small: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 16 },
  // the smallest text, for tags and message times
  micro: { fontFamily: FONTS.body, fontSize: 11, lineHeight: 15 },
  // message bubbles, a touch smaller than body so a thread fits more
  body_compact: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 21 },
  // the big key figure on a summary card or an invite code
  figure: { fontFamily: FONTS.serif, fontSize: 36, lineHeight: 44, letterSpacing: -0.6 },
  // the small uppercase label over a section or a figure
  overline: {
    fontFamily: FONTS.subheading,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
  },
  button: { fontFamily: FONTS.subheading, fontSize: 16, lineHeight: 22 },
  // text boxes skip the line height on purpose, iOS pushes single-line input text off center when it's set
  input: { fontFamily: FONTS.body, fontSize: 16 },
  // Hearth: the one big number at the top of a screen (collected this month, a balance)
  hero: { fontFamily: FONTS.serif, fontSize: 58, lineHeight: 66, letterSpacing: -1 },
  // a second big number, smaller than the hero
  number: { fontFamily: FONTS.serif, fontSize: 30, lineHeight: 38, letterSpacing: -0.4 },
  // a person's or property's name at the top of a detail screen
  name: { fontFamily: FONTS.serif_medium, fontSize: 30, lineHeight: 38, letterSpacing: -0.3 },
  // the title of an empty state
  empty_title: { fontFamily: FONTS.serif_medium, fontSize: 22, lineHeight: 28 },
  // the Rent Well name next to the house mark
  wordmark: { fontFamily: FONTS.serif_medium, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
};

// every number that lines up in a column (money, counts) uses tabular figures so the digits don't wiggle
export const NUMBERS = { fontVariant: ['tabular-nums'] };

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  // Hearth: every button is a full pill at 52 tall
  button: 26,
  pill: 999,
};

export const BORDER = {
  hairline: 1,
  thin: 1.5,
  thick: 2,
};

// shadows need both the iOS shadow props and Android elevation, so each preset has both
// the fintech pass keeps them very soft, cards get a hairline border instead, and only floating things lift
// the Hearth pass took them off everything but the sheets and pop-ups, so low and medium are flat now
// (the names stayed so the old styles still work)
export const SHADOWS = {
  none: {
    shadowOpacity: 0,
    elevation: 0,
  },
  low: {
    shadowOpacity: 0,
    elevation: 0,
  },
  medium: {
    shadowOpacity: 0,
    elevation: 0,
  },
  high: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const OPACITY = {
  pressed: 0.75,
  disabled: 0.45,
  subtle: 0.8,
  faint: 0.6,
};

// sizes that more than one component needs
export const SIZES = {
  // the smallest tap target, from Apple's 44pt guideline
  touch: 44,
  button_small: 40,
  button_medium: 52,
  button_large: 56,
  icon_small: 16,
  icon: 20,
  icon_large: 28,
  avatar: 40,
  avatar_large: 56,
  // the soft circle behind a row's leading icon
  icon_circle: 40,
  thumb: 56,
  // keeps forms and lists a phone width on an iPad
  content_max_width: 600,
  // Hearth: the side padding on every screen, the shortest a list row gets, its icon and chevron,
  // the progress line, and the outlined initials circle in the dashboard's top bar
  screen_padding: 24,
  row_min_height: 64,
  row_icon: 24,
  chevron: 18,
  progress: 4,
  header_avatar: 44,
  // the tabs and drawer: the tab icon, the tab bar's height above the home indicator, the small overdue dot and the unread count on a tab,
  // how wide the drawer is and how tall its rows are, how far in from the left edge a swipe opens it,
  // and the screen width where the drawer stays open on the side (an iPad)
  tab_icon: 24,
  tab_bar: 56,
  tab_dot: 8,
  drawer_width: 300,
  drawer_row: 52,
  drawer_swipe_edge: 24,
  wide_layout: 768,
};

export const MOTION = {
  fast: 150,
  normal: 250,
  entrance: 480,
  stagger: 70,
};
