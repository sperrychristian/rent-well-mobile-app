import { useAppRole } from '../../auth/hooks/useAppRole';
import OwnerPaymentsView from '../components/OwnerPaymentsView';
import TenantPaymentsView from '../components/TenantPaymentsView';

// stub for the assignment: one screen for both roles, the note says what each one will see
// the demo has no account, so it gets the owner version like the rest of the demo
// (the payments pass: still one screen for both roles, the landlord gets OwnerPaymentsView with the real ledger
// and the tenant gets TenantPaymentsView, both read the same useLedger() in the demo and in real mode)
function PaymentsScreen(props) {
  // the demo picks a side now, so the tenant demo gets the tenant version
  const role = useAppRole();
  if (role === 'tenant') {
    return <TenantPaymentsView navigation={props.navigation} />;
  }
  return <OwnerPaymentsView navigation={props.navigation} />;
}

export default PaymentsScreen;
