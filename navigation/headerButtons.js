import { useNavigation } from '@react-navigation/native';
import HeaderIconButton from '../components/HeaderIconButton';
import { useAuth } from '../features/auth/context/AuthContext';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { useTenants } from '../features/tenants/context/TenantsContext';

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
  const { role } = useAuth();
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
  const { role } = useAuth();
  const { demo_mode } = useWorkOrders();
  if (!demo_mode && role !== 'owner') {
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
