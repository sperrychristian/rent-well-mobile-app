import { createNavigationContainerRef } from '@react-navigation/native';
import { holdIfLocked, takeHeldNavigation } from './appLock';
import { navigation_map, main_route } from '../navigation/navigationMap';

// lets code outside the screens move around, like a push tap opening a thread or an expired session going to login
export const navigation_ref = createNavigationContainerRef();

// assignment 12: signed out only has the five signed-out screens registered (no Main), so a link to any
// other screen goes to Login instead of failing
export function routeWhileSignedOut(route_name, root_route_names) {
  const signed_out = !root_route_names.includes(main_route);
  const is_public = !!navigation_map[route_name] && navigation_map[route_name].role === 'auth';
  return signed_out && !is_public ? 'Login' : route_name;
}

// a push tap on a cold launch can come in before the navigator is ready, so this waits a little for it
export function navigateWhenReady(route_name, params, tries_left) {
  // the app lock keeps a push tap until Face ID passes, then openHeldNavigation sends it back through here
  if (holdIfLocked(route_name, params)) {
    return;
  }
  const tries = tries_left === undefined ? 10 : tries_left;
  if (navigation_ref.isReady()) {
    const root = navigation_ref.getRootState ? navigation_ref.getRootState() : null;
    const target =
      root && root.routeNames ? routeWhileSignedOut(route_name, root.routeNames) : route_name;
    navigation_ref.navigate(target, target === route_name ? params : undefined);
  } else if (tries > 0) {
    setTimeout(() => navigateWhenReady(route_name, params, tries - 1), 300);
  }
}

// after unlocking, the push tap that came in while locked opens now
export function openHeldNavigation() {
  const target = takeHeldNavigation();
  if (target) {
    navigateWhenReady(target.route_name, target.params);
  }
}

// clears the history so back can't return to screens from the last account
export function resetTo(route_name, params) {
  if (navigation_ref.isReady()) {
    navigation_ref.reset({ index: 0, routes: [{ name: route_name, params: params }] });
  }
}
