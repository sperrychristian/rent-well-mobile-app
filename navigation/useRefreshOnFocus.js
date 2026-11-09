import { useEffect, useRef } from 'react';
import { useWorkOrders } from '../store/WorkOrdersContext';
import { useTenants } from '../store/TenantsContext';
import { useLedger } from '../store/LedgerContext';
import { useMessages } from '../store/MessagesContext';
import { useRemoteExpenses } from '../store/ExpensesContext';

// REST has no live listener in React Native, so a screen reloads its data quietly when it comes back into view
// (after another screen on top closes, or after switching tabs), the first time it opens the providers load it
// stores is a list of what this screen shows: 'orders', 'tenants', 'ledger', 'messages', 'expenses', 'cloud'
// (cloud is the landlord's trips, documents, checklists, and settings), the demo never reloads anything
export function useRefreshOnFocus(navigation, stores) {
  const work_orders = useWorkOrders();
  const tenants = useTenants();
  const ledger = useLedger();
  const messages = useMessages();
  const expenses = useRemoteExpenses();

  // step 1: the newest reload functions, the listener below only gets added once
  const reloads = {
    orders: work_orders.reloadQuietly,
    tenants: tenants && tenants.mode === 'real' ? tenants.reloadQuietly : null,
    ledger: ledger.reloadQuietly,
    messages: messages && messages.mode === 'real' ? messages.reloadQuietly : null,
    expenses: expenses ? expenses.reloadQuietly : null,
    cloud:
      work_orders.cloud_status && work_orders.cloud_status !== 'off'
        ? work_orders.refreshCloud
        : null,
  };
  const latest = useRef({ reloads, stores });
  useEffect(() => {
    latest.current = { reloads, stores };
  });

  // step 2: leaving the screen arms it, and coming back runs each reload once
  useEffect(() => {
    if (!navigation || !navigation.addListener) {
      return undefined;
    }
    let armed = false;
    const stop_blur = navigation.addListener('blur', () => {
      armed = true;
    });
    const stop_focus = navigation.addListener('focus', () => {
      if (!armed) {
        return;
      }
      armed = false;
      latest.current.stores.forEach((name) => {
        const reload = latest.current.reloads[name];
        if (reload) {
          Promise.resolve(reload()).catch(() => {});
        }
      });
    });
    return () => {
      stop_blur();
      stop_focus();
    };
  }, [navigation]);
}
