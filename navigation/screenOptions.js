import { COLORS, FONTS } from '../theme';
import { headerTitle } from './navigationMap';

// one header style for every screen, all from theme.js
// the header blends into the screen background so the ScreenTitle card stays the big title
// and the header is the slim bar with the back arrow, the plain title, and any buttons
// (the card is only on the Dashboard and the tenant home now, everywhere else the header title is the only title)
export const shared_screen_options = {
  headerShown: true,
  headerStyle: { backgroundColor: COLORS.background },
  headerTintColor: COLORS.title,
  headerTitleStyle: { fontFamily: FONTS.subheading, color: COLORS.title, fontSize: 17 },
  headerTitleAlign: 'center',
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
