import { createNavigationContainerRef } from '@react-navigation/native';
import { holdIfLocked, takeHeldNavigation } from './appLock';

// lets code outside the screens move around, like a push tap opening a thread or an expired session going to login
export const navigation_ref = createNavigationContainerRef();

// a push tap on a cold launch can come in before the navigator is ready, so this waits a little for it
export function navigateWhenReady(route_name, params, tries_left) {
  // the app lock keeps a push tap until Face ID passes, then openHeldNavigation sends it back through here
  if (holdIfLocked(route_name, params)) {
    return;
  }
  const tries = tries_left === undefined ? 10 : tries_left;
  if (navigation_ref.isReady()) {
    navigation_ref.navigate(route_name, params);
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
