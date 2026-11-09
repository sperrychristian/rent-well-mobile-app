import { useWorkOrders } from './WorkOrdersContext';
import { useTenants } from './TenantsContext';
import { useLedger } from './LedgerContext';
import { useMessages } from './MessagesContext';
import { useRemoteExpenses } from './ExpensesContext';

// one answer for "is this screen's data ready?" across the stores it reads, so every screen shows the same
// loading, error, and banner states in Firebase mode (the demo and signed out are always ready)
// stores: 'orders', 'tenants', 'ledger', 'messages', 'expenses', 'cloud'
// gives back { status ('loading' | 'error' | 'ready'), message, retry, banner, clearBanner }
//   status only blocks the screen when there's nothing trustworthy to show yet
//   banner is a refresh that failed while older data is still on screen, or a save that didn't go through
export function useScreenData(stores) {
  const work_orders = useWorkOrders();
  const tenants = useTenants();
  const ledger = useLedger();
  const messages = useMessages();
  const expenses = useRemoteExpenses();

  // step 1: each store's own status in one shape
  const states = {
    orders: work_orders.is_remote
      ? {
          status: work_orders.orders_status,
          error: work_orders.orders_error,
          stale: work_orders.orders_from_cache,
          retry: work_orders.refreshOrders,
        }
      : null,
    tenants:
      tenants && tenants.mode === 'real'
        ? { status: tenants.status, error: tenants.error_message, retry: tenants.refresh }
        : null,
    ledger:
      ledger.mode === 'real'
        ? {
            status: ledger.status,
            error: ledger.error_message,
            stale: ledger.from_cache,
            retry: ledger.refresh,
          }
        : null,
    messages:
      messages && messages.mode === 'real'
        ? {
            status: messages.status,
            error: messages.error_message,
            retry: messages.reloadConversations,
          }
        : null,
    expenses: expenses
      ? {
          status: expenses.status,
          error: expenses.error_message,
          stale: expenses.from_cache,
          retry: expenses.refresh,
        }
      : null,
    // the landlord's trips, documents, checklists, and settings: the phone copy under them might be the
    // starting sample data, so these block until the database has answered
    cloud:
      work_orders.cloud_status && work_orders.cloud_status !== 'off'
        ? {
            status: work_orders.cloud_status,
            error: work_orders.cloud_status === 'error' ? work_orders.cloud_error : '',
            save_error: work_orders.cloud_status === 'ready' ? work_orders.cloud_error : '',
            retry: work_orders.refreshCloud,
            clear: work_orders.clearCloudError,
          }
        : null,
  };
  const picked = stores.map((name) => states[name]).filter(Boolean);

  // step 2: loading or error blocks, a ready store with an error message becomes the banner
  const failed = picked.filter((state) => state.status === 'error');
  const loading = picked.filter((state) => state.status === 'loading');
  const banner_state = picked.find(
    (state) => state.status === 'ready' && (state.save_error || (state.error && state.stale)),
  );
  const retryAll = () =>
    Promise.all(picked.map((state) => Promise.resolve(state.retry && state.retry()))).catch(
      () => {},
    );

  let status = 'ready';
  if (failed.length > 0) {
    status = 'error';
  } else if (loading.length > 0) {
    status = 'loading';
  }
  return {
    status: status,
    message: failed.length > 0 ? failed[0].error : '',
    retry: retryAll,
    banner: banner_state ? banner_state.save_error || banner_state.error : '',
    banner_is_save: !!(banner_state && banner_state.save_error),
    clearBanner: banner_state && banner_state.clear ? banner_state.clear : null,
  };
}
