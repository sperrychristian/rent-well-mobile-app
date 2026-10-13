// the design system lives here: every color, size, and font in the app comes from these tokens
// the design pass made the navy the real base (dark navy surfaces with light text) and added a sunrise amber
// for the main call to action, theme.test.js checks the contrast of every text and surface pair below

export const COLORS = {
  // ----- base -----
  // primary is the steel blue for selected chips and the plain buttons, light text sits on it
  primary: '#36598F',
  background: '#0E1726',
  text: '#EEF2F8',
  // muted is the card and input surface (same as surface), the name stayed so old styles keep working
  muted: '#17243A',
  // title is the header and heading color, it's light now that the base is navy
  title: '#F5F7FB',
  title_text: '#FFFFFF',

  // ----- surfaces and lines -----
  surface: '#17243A',
  surface_raised: '#203150',
  surface_sunken: '#0A1220',
  border: '#2B3D5C',
  border_strong: '#41587F',
  text_muted: '#A9B5C9',
  // a dark navy for text on the light fills (amber, yellow, orange)
  on_light: '#0E1726',

  // ----- the warm accent, sunrise amber for the main call to action and highlights -----
  cta: '#F7A93B',
  cta_pressed: '#E0922A',
  on_cta: '#0E1726',
  focus: '#F7A93B',

  // ----- actions and states (fills, white text on them is AA) -----
  success: '#1A7843',
  action: '#2C64D8',
  info: '#2C64D8',
  accent: '#7448CF',
  highlight: '#F6C445',
  warning: '#F0A23A',
  danger: '#C7352F',
  secondary: '#4F5D78',

  // ----- the same states as text or icons on the navy surfaces -----
  success_text: '#5FD394',
  info_text: '#8DB5FF',
  accent_text: '#B89CFF',
  warning_text: '#FFC266',
  danger_text: '#FF8A84',

  // ----- text on colored buttons -----
  text_light: '#FFFFFF',
  text_dark: '#0E1726',

  // ----- other surfaces -----
  surface_light: '#FFFFFF',
  toast_background: '#27395A',
  skeleton: '#22334F',
  skeleton_shine: '#2C4063',

  // ----- priority -----
  priority_emergency: '#A61B1B',
  priority_low: '#2A7686',

  // ----- expense tags -----
  tag_billed: '#0E6E87',
  tag_recurring: '#4E5A70',
  tag_missing_receipt: '#9A5A00',

  // ----- overlays -----
  backdrop: 'rgba(3,8,18,0.72)',
  photo_backdrop: 'black',
  shadow: 'black',
  shimmer_edge: 'rgba(255,255,255,0)',
  shimmer_peak: 'rgba(255,255,255,0.18)',
  // the faint pixel grid behind the Welcome hero
  grid_line: 'rgba(141,181,255,0.07)',

  // ----- pixel art palette, only the PixelArt drawings use these -----
  pixel_sun: '#FFD43B',
  pixel_roof: '#D9534A',
  pixel_roof_dark: '#9E3A35',
  pixel_chimney: '#A65A32',
  pixel_chimney_dark: '#7A3F1F',
  pixel_wall: '#EBD5A4',
  pixel_wall_shade: '#CDB27C',
  pixel_frame: '#F3F4F6',
  pixel_glass: '#6FC4EF',
  pixel_glass_light: '#C3E8FA',
  pixel_door: '#6E4426',
  pixel_door_dark: '#4A2E19',
  pixel_grass: '#4FAF52',
  pixel_grass_dark: '#3A8C3E',
  pixel_path: '#A3A3A3',
  pixel_paper: '#E9EEF6',
  pixel_ink: '#5B6B86',
  pixel_steel: '#8FA3BF',
  pixel_bubble: '#5B8DEF',
  pixel_coin: '#F7A93B',
  pixel_coin_dark: '#C47A14',
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
  // the pixel font is only for the Rent Well wordmark at big sizes, it gets hard to read small
  wordmark: 'PixelifySans_700Bold',
};

// the type scale: each style has its font, size, and line height so text lines up the same everywhere
// line heights are about 1.3 to 1.5 times the size, which keeps larger system font sizes from clipping
export const TYPE = {
  display: { fontFamily: FONTS.heading, fontSize: 32, lineHeight: 40 },
  title: { fontFamily: FONTS.heading, fontSize: 24, lineHeight: 32 },
  heading: { fontFamily: FONTS.body_bold, fontSize: 18, lineHeight: 24 },
  subheading: { fontFamily: FONTS.subheading, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: FONTS.body, fontSize: 16, lineHeight: 24 },
  body_small: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: FONTS.body_bold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: FONTS.body_bold, fontSize: 16, lineHeight: 22 },
  // text boxes skip the line height on purpose, iOS pushes single-line input text off center when it's set
  input: { fontFamily: FONTS.body, fontSize: 16 },
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const BORDER = {
  hairline: 1,
  thin: 1.5,
  thick: 2,
};

// shadows need both the iOS shadow props and Android elevation, so each preset has both
export const SHADOWS = {
  none: {
    shadowOpacity: 0,
    elevation: 0,
  },
  low: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  high: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
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
  // keeps forms and lists a phone width on an iPad
  content_max_width: 600,
};

export const MOTION = {
  fast: 150,
  normal: 250,
  entrance: 480,
  stagger: 70,
};
