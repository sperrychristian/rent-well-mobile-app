import { useMessages } from '../features/messages/context/MessagesContext';
import { useWorkOrders } from '../context/WorkOrdersContext';
import { useLedger } from '../features/payments/context/LedgerContext';
import { behindSummary } from '../features/payments/utils/ledgerHelpers';
import { deriveLedger } from '../features/payments/utils/ledgerMath';
import { openCount } from '../features/workOrders/utils/workOrderHelpers';

// what each tab's badge shows, from numbers the app already has: unread messages, anything overdue,
// and work orders nobody has started yet (Open), with the words a screen reader says for each
// it's pure so the tests can check it without the providers
export function tabBadges(counts) {
  const badges = {};
  if (counts.unread > 0) {
    badges.Messages = { count: counts.unread, spoken: counts.unread + ' unread' };
  }
  if (counts.overdue) {
    badges.Payments = { dot: true, spoken: 'something is overdue' };
  }
  if (counts.role === 'owner' && counts.open_orders > 0) {
    badges.WorkOrders = {
      dot: true,
      spoken:
        counts.open_orders === 1 ? '1 work order needs you' : counts.open_orders + ' need you',
    };
  }
  return badges;
}

// the same numbers the homes show, read from the shared contexts in both the demo and real mode
// owners: any tenant behind on rent, tenants: their own ledger has something overdue
export function useTabBadges(role) {
  const { unread_total } = useMessages();
  const { orders } = useWorkOrders();
  const ledger_store = useLedger();
  let overdue = false;
  if (role === 'owner') {
    overdue = behindSummary(ledger_store.ledgers, ledger_store.today).count > 0;
  } else if (ledger_store.current_ledger) {
    overdue = deriveLedger(ledger_store.current_ledger, ledger_store.today).overdue_cents > 0;
  }
  return tabBadges({
    role: role,
    unread: unread_total || 0,
    overdue: overdue,
    open_orders: role === 'owner' ? openCount(orders) : 0,
  });
}
