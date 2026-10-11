import { createNavigationContainerRef } from '@react-navigation/native';

// lets code outside the screens move around, like a push tap opening a thread or an expired session going to login
export const navigation_ref = createNavigationContainerRef();

// clears the history so back can't return to screens from the last account
export function resetTo(route_name, params) {
  if (navigation_ref.isReady()) {
    navigation_ref.reset({ index: 0, routes: [{ name: route_name, params: params }] });
  }
}
