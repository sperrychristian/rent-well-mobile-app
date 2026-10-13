import { useAuth } from '../context/AuthContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';

// the role the screens act for: the demo's picked side while the demo runs, otherwise the signed-in account's role
// gives back 'owner', 'tenant', or null when nobody is signed in and it's not the demo
export function useAppRole() {
  const { user } = useAuth();
  const { demo_mode, demo_role } = useWorkOrders();
  if (demo_mode) {
    return demo_role;
  }
  return user ? user.role : null;
}
