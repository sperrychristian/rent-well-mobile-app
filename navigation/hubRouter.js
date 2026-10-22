import { StackActions } from '@react-navigation/native';
import { parentsOf, main_route } from './navigationMap';

// the tabs and drawer live inside the root stack's Main screen, so a plain navigate('Payments') from a
// detail screen (or from a push tap through the navigation ref) has nowhere to go in the root stack.
// this wraps those names in their parents, so every screen and helper keeps calling them by name like before

// the params for Main that open one tab or drawer screen inside it, with the screen's own params passed along
export function nestedParams(route_name, params) {
  const parents = parentsOf(route_name);
  // the innermost one first: { screen: 'Payments', params } then { screen: 'Tabs', params: that }
  let nested = { screen: route_name, params: params };
  for (let index = parents.length - 1; index > 0; index--) {
    nested = { screen: parents[index], params: nested };
  }
  return nested;
}

// true when the name is a tab or drawer screen, which only exist inside Main
export function isHubRoute(route_name) {
  return parentsOf(route_name).length > 0;
}

// a reset to a home ("Dashboard") becomes a reset to Main with that tab picked, other routes stay the same
export function wrapResetRoutes(routes) {
  return routes.map((route) =>
    isHubRoute(route.name)
      ? { name: main_route, params: nestedParams(route.name, route.params) }
      : route,
  );
}

// go back to the Main that's already in the stack (pop: true) and open the screen inside it,
// so a detail screen comes off and the tab bar shows where you landed
function navigateToHub(route_name, params) {
  return {
    type: 'NAVIGATE',
    payload: { name: main_route, params: nestedParams(route_name, params), pop: true },
  };
}

// the root stack's router with the hub names handled, passed to UNSTABLE_router in App.js
// it only reads the static map, which is what React Navigation asks for (no state from outside)
export function hubRouter(original) {
  return {
    getStateForAction(state, action, options) {
      const payload = action.payload || {};
      if ((action.type === 'NAVIGATE' || action.type === 'PUSH') && isHubRoute(payload.name)) {
        return original.getStateForAction(
          state,
          navigateToHub(payload.name, payload.params),
          options,
        );
      }
      // after a tenant sends a request, the form is replaced by My Requests: drop the form, then open the tab
      if (action.type === 'REPLACE' && isHubRoute(payload.name)) {
        const popped =
          state.index > 0 ? original.getStateForAction(state, StackActions.pop(), options) : state;
        return original.getStateForAction(
          popped || state,
          navigateToHub(payload.name, payload.params),
          options,
        );
      }
      if (
        action.type === 'RESET' &&
        payload.routes &&
        payload.routes.some((route) => isHubRoute(route.name))
      ) {
        return original.getStateForAction(
          state,
          { ...action, payload: { ...payload, routes: wrapResetRoutes(payload.routes) } },
          options,
        );
      }
      return original.getStateForAction(state, action, options);
    },
  };
}
