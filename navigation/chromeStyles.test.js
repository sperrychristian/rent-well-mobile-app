import { COLORS, LIGHT_COLORS, DARK_COLORS, SIZES, TYPE, setActiveScheme } from '../theme';
import { contrastRatio, meetsAA } from '../utils/contrast';
import { shared_tab_options, shared_drawer_options, shared_screen_options } from './screenOptions';

// the tab bar and drawer colors, sizes, and fonts, checked the same way theme.test.js checks the screens

// the dark mode pass: the same pairs in both palettes, and the options read the active one
describe.each([
  ['light', LIGHT_COLORS],
  ['dark', DARK_COLORS],
])('tab bar and drawer contrast (%s)', (scheme, PALETTE) => {
  const pairs = [
    ['picked tab label and icon', 'cta', 'background'],
    ['other tab labels and icons', 'text_muted', 'background'],
    ['unread count on its badge', 'on_cta', 'danger'],
    ['drawer row label', 'text', 'background'],
    ['picked drawer row label', 'cta', 'surface_raised'],
    ['drawer role line and section headers', 'text_muted', 'background'],
    ['header title', 'title', 'background'],
  ];

  afterAll(() => setActiveScheme('light'));

  test.each(pairs)('%s meets AA', (name, text_token, background_token) => {
    expect({ name, ok: meetsAA(PALETTE[text_token], PALETTE[background_token]) }).toEqual({
      name,
      ok: true,
    });
  });

  test('the overdue dot stands out from the paper (3 to 1 for a graphic)', () => {
    expect(contrastRatio(PALETTE.danger, PALETTE.background)).toBeGreaterThanOrEqual(3);
  });

  test('the options use the same tokens from the active palette', () => {
    setActiveScheme(scheme);
    expect(COLORS.background).toBe(PALETTE.background);
    expect(shared_tab_options.tabBarActiveTintColor).toBe(PALETTE.cta);
    expect(shared_tab_options.tabBarInactiveTintColor).toBe(PALETTE.text_muted);
    expect(shared_tab_options.tabBarStyle.backgroundColor).toBe(PALETTE.background);
    expect(shared_tab_options.tabBarStyle.borderTopColor).toBe(PALETTE.hairline);
    expect(shared_tab_options.tabBarBadgeStyle.backgroundColor).toBe(PALETTE.danger);
    expect(shared_drawer_options.drawerStyle.backgroundColor).toBe(PALETTE.background);
    expect(shared_drawer_options.overlayColor).toBe(PALETTE.backdrop);
    expect({ ...shared_screen_options }.headerStyle.backgroundColor).toBe(PALETTE.background);
    setActiveScheme('light');
  });
});

describe('tab bar and drawer sizes', () => {
  test('every touch target is at least 44', () => {
    expect(shared_tab_options.tabBarItemStyle.minHeight).toBeGreaterThanOrEqual(SIZES.touch);
    expect(SIZES.tab_bar).toBeGreaterThanOrEqual(SIZES.touch);
    expect(SIZES.drawer_row).toBeGreaterThanOrEqual(SIZES.touch);
  });

  test('tab labels are at least 11 and fit under the icon box at the 1.3 font cap', () => {
    expect(TYPE.caption.fontSize).toBeGreaterThanOrEqual(11);
    // the library's icon box is 28 tall and the item has 5 of padding top and bottom
    const label_line = (TYPE.caption.fontSize + 2) * 1.3;
    expect(28 + label_line).toBeLessThanOrEqual(SIZES.tab_bar - 10 + 0.5);
  });

  test('the drawer swipe starts close to the edge and the iPad breakpoint is 768', () => {
    expect(shared_drawer_options.swipeEdgeWidth).toBe(SIZES.drawer_swipe_edge);
    expect(SIZES.drawer_swipe_edge).toBeLessThanOrEqual(32);
    expect(SIZES.wide_layout).toBe(768);
  });
});
