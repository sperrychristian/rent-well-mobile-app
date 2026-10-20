import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPE, FONTS, SIZES, BORDER, SPACING } from '../theme';
import { headerTitle, navigation_map } from './navigationMap';
import { HeaderMenuButton, DrawerHeaderLeft } from './headerButtons';

// one header style for every screen, all from theme.js
// the header blends into the screen background so the ScreenTitle card stays the big title
// and the header is the slim bar with the back arrow, the plain title, and any buttons
// (the card is only on the Dashboard and the tenant home now, everywhere else the header title is the only title)
export const shared_screen_options = {
  headerShown: true,
  // the fintech pass: a white bar with the thin line under it (headerShadowVisible draws that line)
  headerStyle: { backgroundColor: COLORS.background },
  headerTintColor: COLORS.title,
  // the design pass: a bolder title on the navy, the same size the system header uses
  headerTitleStyle: {
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.title,
    fontSize: TYPE.heading.fontSize,
  },
  headerTitleAlign: 'center',
  // the Hearth pass: the bar is the same paper as the page, with no line or shadow under it
  headerShadowVisible: false,
  // just the arrow, the previous screen's title next to it made the bar crowded
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: COLORS.background },
};

// each screen's options: the title comes from the navigation map (with a short id when it depends on a param)
// extra is for screen-specific things like headerRight
export function optionsFor(route_name, extra) {
  return ({ route }) => ({
    title: headerTitle(route_name, route.params),
    ...(extra || {}),
  });
}

// the tabs and drawer draw their own header (not the native stack's), so they get the same look here:
// the same paper bar, ink title and no line, and the page color goes on sceneStyle instead of contentStyle
const hub_header_options = {
  headerShown: true,
  headerStyle: shared_screen_options.headerStyle,
  headerTintColor: shared_screen_options.headerTintColor,
  headerTitleStyle: shared_screen_options.headerTitleStyle,
  headerTitleAlign: shared_screen_options.headerTitleAlign,
  headerShadowVisible: false,
  sceneStyle: { backgroundColor: COLORS.background },
};

// the tab bar: paper with one hairline on top, green for the tab you're on and muted for the rest,
// line icons only, and DM Sans labels that never go under 12
export const shared_tab_options = {
  ...hub_header_options,
  headerLeft: () => <HeaderMenuButton />,
  tabBarActiveTintColor: COLORS.cta,
  tabBarInactiveTintColor: COLORS.text_muted,
  tabBarStyle: {
    backgroundColor: COLORS.background,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
    // flat like the rest of Hearth, no shadow above the bar on Android either
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarItemStyle: { minHeight: SIZES.touch },
  // the count on Messages, terracotta with white numbers like every other urgent fill
  tabBarBadgeStyle: {
    backgroundColor: COLORS.danger,
    color: COLORS.on_cta,
    fontFamily: FONTS.heading,
  },
};

// the drawer: paper, no shadow, a soft ink backdrop over the screen, and a swipe that only starts close
// to the left edge so it doesn't grab the horizontal chip rows on the screens
// (the iOS back swipe lives on the root stack's detail screens, which sit above the drawer, so they never meet)
export const shared_drawer_options = {
  ...hub_header_options,
  headerLeft: () => <DrawerHeaderLeft />,
  drawerStyle: {
    backgroundColor: COLORS.background,
    width: SIZES.drawer_width,
    borderRightWidth: BORDER.hairline,
    borderRightColor: COLORS.hairline,
  },
  overlayColor: COLORS.backdrop,
  swipeEdgeWidth: SIZES.drawer_swipe_edge,
};

// the line icon under a tab, the same outline icon whether it's picked or not, only the color changes
// dot is the small terracotta mark for "something here needs you"
function TabIcon(props) {
  return (
    <>
      <Ionicons name={props.icon} size={SIZES.tab_icon} color={props.color} />
      {props.dot ? <View style={styles.dot} accessible={false} testID="tab-dot" /> : null}
    </>
  );
}

// the tab's label, DM Sans at 12, and it can grow with the system font size but not so far it wraps
function TabLabel(props) {
  return (
    <Text
      style={[styles.label, { color: props.color }]}
      numberOfLines={1}
      maxFontSizeMultiplier={1.3}
    >
      {props.text}
    </Text>
  );
}

// a tab's options: the header title from the map, the short label and icon from the map, and its badge
// badge is { count } for a number (Messages) or { dot: true } for the overdue or needs-you mark,
// spoken is what a screen reader hears about it, like "3 unread"
export function tabOptionsFor(route_name, badge, extra) {
  const screen = navigation_map[route_name];
  const count = badge && badge.count ? badge.count : 0;
  const has_dot = !!(badge && badge.dot);
  const spoken = badge && badge.spoken ? ', ' + badge.spoken : '';
  return ({ route }) => ({
    title: headerTitle(route_name, route.params),
    tabBarLabel: ({ color }) => <TabLabel text={screen.nav_label} color={color} />,
    tabBarIcon: ({ color }) => <TabIcon icon={screen.nav_icon} color={color} dot={has_dot} />,
    tabBarBadge: count > 0 ? (count > 99 ? '99+' : count) : undefined,
    tabBarAccessibilityLabel: screen.nav_label + spoken,
    tabBarButtonTestID: 'tab-' + route_name,
    ...(extra || {}),
  });
}

// a drawer screen's options: the header title, and the label and icon the drawer list uses
export function drawerOptionsFor(route_name, extra) {
  const screen = navigation_map[route_name];
  return ({ route }) => ({
    title: headerTitle(route_name, route.params),
    drawerLabel: screen.nav_label,
    ...(extra || {}),
  });
}

const styles = StyleSheet.create({
  label: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.caption.fontSize,
    lineHeight: TYPE.caption.lineHeight,
  },
  dot: {
    position: 'absolute',
    top: 0,
    right: -SPACING.xs,
    width: SIZES.tab_dot,
    height: SIZES.tab_dot,
    borderRadius: SIZES.tab_dot / 2,
    backgroundColor: COLORS.danger,
  },
});
