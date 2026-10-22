import { COLORS, SIZES, TYPE } from '../theme';
import { contrastRatio, meetsAA } from '../utils/contrast';
import { shared_tab_options, shared_drawer_options } from './screenOptions';

// the tab bar and drawer colors, sizes, and fonts, checked the same way theme.test.js checks the screens

describe('tab bar and drawer contrast', () => {
  const pairs = [
    ['picked tab label and icon', COLORS.cta, COLORS.background],
    ['other tab labels and icons', COLORS.text_muted, COLORS.background],
    ['unread count on its badge', COLORS.on_cta, COLORS.danger],
    ['drawer row label', COLORS.text, COLORS.background],
    ['picked drawer row label', COLORS.cta, COLORS.surface_raised],
    ['drawer role line and section headers', COLORS.text_muted, COLORS.background],
    ['header title', COLORS.title, COLORS.background],
  ];

  test.each(pairs)('%s meets AA', (name, text_color, background) => {
    expect({ name, ok: meetsAA(text_color, background) }).toEqual({ name, ok: true });
  });

  test('the overdue dot stands out from the paper (3 to 1 for a graphic)', () => {
    expect(contrastRatio(COLORS.danger, COLORS.background)).toBeGreaterThanOrEqual(3);
  });

  test('the options use the same tokens', () => {
    expect(shared_tab_options.tabBarActiveTintColor).toBe(COLORS.cta);
    expect(shared_tab_options.tabBarInactiveTintColor).toBe(COLORS.text_muted);
    expect(shared_tab_options.tabBarStyle.backgroundColor).toBe(COLORS.background);
    expect(shared_tab_options.tabBarStyle.borderTopColor).toBe(COLORS.hairline);
    expect(shared_tab_options.tabBarBadgeStyle.backgroundColor).toBe(COLORS.danger);
    expect(shared_drawer_options.drawerStyle.backgroundColor).toBe(COLORS.background);
    expect(shared_drawer_options.overlayColor).toBe(COLORS.backdrop);
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
