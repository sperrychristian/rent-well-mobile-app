import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useNavigation, useNavigationState, DrawerActions } from '@react-navigation/native';
import HeaderIconButton from '../components/HeaderIconButton';
import { useAppRole } from '../features/auth/hooks/useAppRole';
import { useTenants } from '../features/tenants/context/TenantsContext';
import { headerTitle, tabs_route } from './navigationMap';
import { SIZES, SPACING } from '../theme';

// the buttons on the right of the header, each one is its own small component so it can check the role
// they render inside the navigator, so they can use the same contexts the screens use

// the gear on both homes
export function SettingsHeaderButton() {
  const navigation = useNavigation();
  return (
    <HeaderIconButton
      icon="settings-outline"
      label="Settings and profile"
      onPress={() => navigation.navigate('Settings')}
    />
  );
}

// owners (real or the demo) add a work order from the list, tenants never see the owner list anyway
export function AddWorkOrderHeaderButton() {
  const navigation = useNavigation();
  // the role is the demo's side while the demo runs
  const role = useAppRole();
  if (role === 'tenant') {
    return null;
  }
  return (
    <HeaderIconButton
      icon="add-circle-outline"
      label="Add a work order"
      onPress={() => navigation.navigate('NewWorkOrder')}
    />
  );
}

// invites are for owners, the demo counts as one, so a tenant opening Messages gets nothing here
export function InviteHeaderButton() {
  const navigation = useNavigation();
  // the tenant side of the demo is a tenant here, so only owners and the landlord demo get it
  const role = useAppRole();
  if (role !== 'owner') {
    return null;
  }
  return (
    <HeaderIconButton
      icon="person-add-outline"
      label="Invite a tenant"
      onPress={() => navigation.navigate('InviteTenant')}
    />
  );
}

// a tenant reports a new issue from their list, unless their rental ended and it's read only
export function AddRequestHeaderButton() {
  const navigation = useNavigation();
  const { is_read_only } = useTenants();
  if (is_read_only) {
    return null;
  }
  return (
    <HeaderIconButton
      icon="add-circle-outline"
      label="Report an issue"
      onPress={() => navigation.navigate('NewWorkOrder')}
    />
  );
}

// the menu button on the left of every tab and drawer screen, it opens the drawer
// on an iPad the drawer stays open on the side, so there's nothing to open and the button hides
export function HeaderMenuButton() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  if (width >= SIZES.wide_layout) {
    return null;
  }
  return (
    <View style={styles.left}>
      <HeaderIconButton
        icon="menu-outline"
        label="Open the menu"
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      />
    </View>
  );
}

// a drawer screen opened by a link inside another section (Expenses to Mileage, Tenants to Properties)
// gets a back arrow to that section, one opened from the menu or a tab gets the menu button
// the drawer menu clears that history when you pick something (see DrawerContent), so this stays true
export function DrawerHeaderLeft() {
  const navigation = useNavigation();
  const came_from = useNavigationState((state) => previousDrawerRoute(state));
  if (!came_from) {
    return <HeaderMenuButton />;
  }
  return (
    <View style={styles.left}>
      <HeaderIconButton
        icon="chevron-back-outline"
        label={'Back to ' + headerTitle(came_from)}
        onPress={() => navigation.goBack()}
      />
    </View>
  );
}

// the drawer screen before this one in the drawer's history, or null when it was the tabs (or nothing)
export function previousDrawerRoute(state) {
  if (!state || !state.history) {
    return null;
  }
  const visits = state.history.filter((entry) => entry.type === 'route');
  if (visits.length < 2) {
    return null;
  }
  const previous = state.routes.find((route) => route.key === visits[visits.length - 2].key);
  return previous && previous.name !== tabs_route ? previous.name : null;
}

const styles = StyleSheet.create({
  // the tab and drawer headers put the left button right on the edge, this lines it up with the screen padding
  left: {
    marginLeft: SPACING.xs,
  },
});
