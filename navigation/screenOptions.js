import { COLORS, TYPE } from '../theme';
import { headerTitle } from './navigationMap';

// one header style for every screen, all from theme.js
// the header blends into the screen background so the ScreenTitle card stays the big title
// and the header is the slim bar with the back arrow, the plain title, and any buttons
// (the card is only on the Dashboard and the tenant home now, everywhere else the header title is the only title)
export const shared_screen_options = {
  headerShown: true,
  // the fintech pass: a white bar with the thin line under it (headerShadowVisible draws that line)
  headerStyle: { backgroundColor: COLORS.surface },
  headerTintColor: COLORS.title,
  // the design pass: a bolder title on the navy, the same size the system header uses
  headerTitleStyle: {
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.title,
    fontSize: TYPE.heading.fontSize,
  },
  headerTitleAlign: 'center',
  headerShadowVisible: true,
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
