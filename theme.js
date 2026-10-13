// the design system lives here: every color, size, and font in the app comes from these tokens
// the design pass made the navy the real base (dark navy surfaces with light text) and added a sunrise amber
// for the main call to action, theme.test.js checks the contrast of every text and surface pair below
// the fintech pass flipped it to a light theme: white cards on a soft cool gray, ink navy text, one indigo
// brand color for the main action, and a soft tint behind each state color for pills and banners

export const COLORS = {
  // ----- base -----
  // primary is the indigo brand color, selected chips and the plain buttons use it with white text
  primary: '#4F46E5',
  background: '#F5F7FA',
  text: '#0F1B2D',
  // muted is the card and input surface (same as surface), the name stayed so old styles keep working
  muted: '#FFFFFF',
  // title is the header and heading color, ink navy on the light theme
  title: '#0F1B2D',
  title_text: '#0F1B2D',

  // ----- surfaces and lines -----
  surface: '#FFFFFF',
  // rows and secondary buttons inside a white card, a hair grayer than the card
  surface_raised: '#F1F4F8',
  // text boxes sit on this so they read as fields
  surface_sunken: '#F8FAFC',
  border: '#E3E8EF',
  border_strong: '#C3CBD6',
  text_muted: '#5B6779',
  // ink text for the light fills (amber, yellow)
  on_light: '#0F1B2D',

  // ----- the brand call to action (the name stayed from the amber days) -----
  cta: '#4F46E5',
  cta_pressed: '#4338CA',
  on_cta: '#FFFFFF',
  focus: '#4F46E5',
  brand_tint: '#EEF0FE',
  // the quieter text on top of the indigo summary card
  on_brand_muted: '#E0E4FD',

  // ----- actions and states as fills, white text on them is AA -----
  success: '#157A3E',
  action: '#2563EB',
  info: '#2563EB',
  accent: '#7C3AED',
  highlight: '#FACC15',
  warning: '#F79009',
  danger: '#D92D20',
  secondary: '#5B6779',

  // ----- the same states as text or icons on white or gray -----
  success_text: '#157A3E',
  info_text: '#1D4ED8',
  accent_text: '#6D28D9',
  warning_text: '#A95A00',
  danger_text: '#B42318',

  // ----- soft tints behind each state, for pills and banners (the matching _text color sits on them) -----
  success_tint: '#E7F6EC',
  info_tint: '#EAF1FE',
  accent_tint: '#F2ECFE',
  warning_tint: '#FEF4E2',
  danger_tint: '#FDECEA',
  neutral_tint: '#EEF1F5',

  // ----- text on colored buttons -----
  text_light: '#FFFFFF',
  text_dark: '#0F1B2D',

  // ----- other surfaces -----
  surface_light: '#FFFFFF',
  toast_background: '#0F1B2D',
  skeleton: '#E9EEF4',
  skeleton_shine: '#F2F5F9',

  // ----- priority -----
  priority_emergency: '#B42318',
  priority_low: '#0E7490',

  // ----- expense tags -----
  tag_billed: '#0F766E',
  tag_recurring: '#475569',
  tag_missing_receipt: '#A95A00',

  // ----- overlays -----
  backdrop: 'rgba(15,27,45,0.45)',
  photo_backdrop: 'black',
  shadow: '#0F1B2D',
  shimmer_edge: 'rgba(255,255,255,0)',
  shimmer_peak: 'rgba(255,255,255,0.22)',

  // ----- pixel art palette, only the PixelArt drawings use these -----
  // the house logomark is recolored into the brand: indigo roof, soft indigo walls, ink door
  pixel_sun: '#F79009',
  pixel_roof: '#4F46E5',
  pixel_roof_dark: '#3730A3',
  pixel_chimney: '#64748B',
  pixel_chimney_dark: '#475569',
  pixel_wall: '#E0E4FD',
  pixel_wall_shade: '#C7CDFB',
  pixel_frame: '#FFFFFF',
  pixel_glass: '#93B4F5',
  pixel_glass_light: '#DCE7FD',
  pixel_door: '#312E81',
  pixel_door_dark: '#1E1B4B',
  pixel_grass: '#86D3A2',
  pixel_grass_dark: '#4FAE74',
  pixel_path: '#C3CBD6',
  pixel_paper: '#E9EEF6',
  pixel_ink: '#5B6779',
  pixel_steel: '#8FA3BF',
  pixel_bubble: '#5B8DEF',
  pixel_coin: '#F7A93B',
  pixel_coin_dark: '#C47A14',
  // the two quiet tones every empty-state drawing is redrawn in, so they read as accents and not as art
  pixel_duo_light: '#DCE1F9',
  pixel_duo_dark: '#9AA3D6',
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
  heading: 'Inter_800ExtraBold',
  subheading: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
  body_bold: 'Inter_700Bold',
};

// the type scale: each style has its font, size, and line height so text lines up the same everywhere
// line heights are about 1.3 to 1.5 times the size, which keeps larger system font sizes from clipping
// the fintech pass tightened it: bold display figures with tight tracking, semibold headings, and small caps labels
export const TYPE = {
  display: { fontFamily: FONTS.body_bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: FONTS.body_bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: FONTS.subheading, fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  subheading: { fontFamily: FONTS.subheading, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: FONTS.body, fontSize: 16, lineHeight: 24 },
  body_small: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: FONTS.subheading, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 16 },
  // the small uppercase label over a section or a figure
  overline: {
    fontFamily: FONTS.subheading,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  button: { fontFamily: FONTS.subheading, fontSize: 16, lineHeight: 22 },
  // text boxes skip the line height on purpose, iOS pushes single-line input text off center when it's set
  input: { fontFamily: FONTS.body, fontSize: 16 },
};

// every number that lines up in a column (money, counts) uses tabular figures so the digits don't wiggle
export const NUMBERS = { fontVariant: ['tabular-nums'] };

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const BORDER = {
  hairline: 1,
  thin: 1.5,
  thick: 2,
};

// shadows need both the iOS shadow props and Android elevation, so each preset has both
// the fintech pass keeps them very soft, cards get a hairline border instead, and only floating things lift
export const SHADOWS = {
  none: {
    shadowOpacity: 0,
    elevation: 0,
  },
  low: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  high: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
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
  button_small: 36,
  button_medium: 48,
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
};

export const MOTION = {
  fast: 150,
  normal: 250,
  entrance: 480,
  stagger: 70,
};
