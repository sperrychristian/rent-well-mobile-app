import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useWorkOrders } from './WorkOrdersContext';
import {
  getLedgers,
  saveLedgerChange,
  catchUpLedgers,
  savePaymentInstructions,
} from '../util/http';
import { ApiError } from '../util/apiHelpers';
import { generatePushId } from '../util/data/pushId';
import { storageKey } from '../util/storageKeys';
import { todayString } from '../util/formatDate';
import { findPayment as findPaymentIn } from '../features/payments/utils/ledgerApi';
import { monthSummary, syncLedger } from '../features/payments/utils/ledgerMath';
import {
  demoCreatePayment,
  demoConfirmPayment,
  demoRejectPayment,
  demoVoidPayment,
  demoAddCharge,
  demoVoidCharge,
  demoSetSchedule,
} from '../features/payments/utils/demoLedger';
import {
  buildSampleLedgers,
  buildSampleInstructions,
} from '../features/payments/data/sampleLedger';
import { demo_tenant } from '../features/tenants/data/sampleTenants';

// the rent ledger for both modes behind one useLedger(), screens never check which one they got
// demo: sample ledgers in memory only, never saved, and a fresh set every time the demo starts
// real: the server's ledgers (the Rent ledger section of docs/API.md), with a saved copy for offline,
// and real mode shows the server's own statuses and balances instead of working them out here
// milestone 2: real mode reads Firebase now, and the demo's ledger math and rule functions work out
// every balance and make every change
const LedgerContext = createContext(null);

// the last ledgers from the server, so the screen isn't empty when the server can't be reached
const cache_key = 'rent_well_ledger_cache';
// version 2 is the real API's shape, an older saved copy is skipped
// (version 3 is the Firebase shape, the same shape the demo's ledgers use)
const cache_version = 3;

// what useLedger() hands back while signed out, so a screen that renders anyway doesn't crash
function offValue() {
  const turnedAway = () => Promise.reject(new ApiError(401, 'UNAUTHORIZED', 'Log in first.'));
  return {
    mode: 'off',
    is_demo: false,
    role: null,
    today: todayString(),
    status: 'ready',
    error_message: '',
    from_cache: false,
    refreshing: false,
    refresh: () => Promise.resolve(),
    ledgers: [],
    current_ledger: null,
    past_ledgers: [],
    is_read_only: true,
    getLedger: () => null,
    findPayment: () => null,
    current_summary: null,
    getMonthSummary: () => Promise.resolve(null),
    instructionsFor: () => undefined,
    ensurePayment: () => Promise.resolve(null),
    recordPayment: turnedAway,
    claimPayment: turnedAway,
    confirmPayment: turnedAway,
    rejectPayment: turnedAway,
    voidPayment: turnedAway,
    addCharge: turnedAway,
    voidCharge: turnedAway,
    setRentSchedule: turnedAway,
    setPaymentInstructions: turnedAway,
  };
}

// a fresh store whenever the mode or account changes, so the demo resets on exit and accounts never mix
export function LedgerProvider(props) {
  const { user } = useAuth();
  const local = useWorkOrders();
  const mode = local.demo_mode ? 'demo' : user ? 'real' : 'off';
  if (mode === 'off') {
    return <LedgerContext.Provider value={offValue()}>{props.children}</LedgerContext.Provider>;
  }
  if (mode === 'demo') {
    return <DemoLedgerStore role={local.demo_role}>{props.children}</DemoLedgerStore>;
  }
  return (
    <RemoteLedgerStore key={user.id} user={user}>
      {props.children}
    </RemoteLedgerStore>
  );
}

// the tenant's own ledgers: the active one to pay on, and any ended ones as read-only history
function splitTenantLedgers(ledgers) {
  const current = ledgers.find((ledger) => ledger.tenancy_status !== 'ended') || null;
  return {
    current_ledger: current,
    past_ledgers: ledgers.filter((ledger) => ledger.tenancy_status === 'ended'),
  };
}

let demo_count = 0;
function makeDemoId() {
  demo_count++;
  return 'demo-ledger-' + Date.now() + '-' + demo_count;
}

// ----- demo -----

function DemoLedgerStore(props) {
  const role = props.role;
  const today = todayString();
  // built once when the demo starts (this remounts on every new demo), shared by both demo sides
  const [ledgers, setLedgers] = useState(() => buildSampleLedgers(todayString()));
  const [instructions, setInstructions] = useState(() => buildSampleInstructions());
  const [refreshing, setRefreshing] = useState(false);
  const ledgers_ref = useRef(ledgers);

  // runs a pure demo action on the newest list, an error comes out as the same ApiError the server gives
  function run(change) {
    const result = change(ledgers_ref.current);
    ledgers_ref.current = result.ledgers;
    setLedgers(result.ledgers);
    return result;
  }

  const with_instructions = useMemo(
    () =>
      ledgers.map((ledger) => ({
        ...ledger,
        payment_instructions: instructions[ledger.property_id] || '',
      })),
    [ledgers, instructions],
  );

  // the demo tenant is Sam, the tenant side only ever sees Sam's ledgers
  const visible =
    role === 'tenant'
      ? with_instructions.filter((ledger) => ledger.tenant_id === demo_tenant.id)
      : with_instructions;
  const split = splitTenantLedgers(visible);

  // a demo receipt stays a local photo, it's only kept in memory for this demo
  function withReceipt(value, receipt) {
    return receipt ? { ...value, receipt_key: null, receipt_uri: receipt.uri } : value;
  }

  async function createIn(tenancy_id, value, receipt, as_role) {
    const now = new Date().toISOString();
    return run((current) =>
      demoCreatePayment(
        current,
        tenancy_id,
        withReceipt(value, receipt),
        as_role,
        now,
        todayString(),
        makeDemoId,
      ),
    ).payment;
  }

  const value = {
    mode: 'demo',
    is_demo: true,
    role: role,
    today: today,
    status: 'ready',
    error_message: '',
    from_cache: false,
    refreshing: refreshing,
    // nothing to fetch in the demo, the spinner just shows for a moment so pull to refresh feels normal
    refresh: async () => {
      setRefreshing(true);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setRefreshing(false);
    },
    ledgers: visible,
    current_ledger: role === 'tenant' ? split.current_ledger : null,
    past_ledgers: role === 'tenant' ? split.past_ledgers : [],
    is_read_only: role === 'tenant' && !split.current_ledger,
    getLedger: (tenancy_id) => visible.find((ledger) => ledger.tenancy_id === tenancy_id) || null,
    findPayment: (payment_id) => findPaymentIn(visible, payment_id),
    instructionsFor: (property_id) => instructions[property_id],
    // the demo works its month out here, real mode asks the server
    current_summary: null,
    getMonthSummary: async (month, property_id) =>
      monthSummary(
        visible.filter((ledger) => !property_id || ledger.property_id === property_id),
        month,
        todayString(),
      ),
    ensurePayment: async (payment_id) => findPaymentIn(visible, payment_id),
    recordPayment: (tenancy_id, fields, receipt) => createIn(tenancy_id, fields, receipt, 'owner'),
    claimPayment: (tenancy_id, fields, receipt) => createIn(tenancy_id, fields, receipt, 'tenant'),
    confirmPayment: async (payment_id) =>
      run((current) =>
        demoConfirmPayment(current, payment_id, new Date().toISOString(), todayString()),
      ).payment,
    rejectPayment: async (payment_id, reason) =>
      run((current) =>
        demoRejectPayment(current, payment_id, reason, new Date().toISOString(), todayString()),
      ).payment,
    voidPayment: async (payment_id, reason) =>
      run((current) =>
        demoVoidPayment(current, payment_id, reason, new Date().toISOString(), todayString()),
      ).payment,
    addCharge: async (tenancy_id, fields) =>
      run((current) =>
        demoAddCharge(
          current,
          tenancy_id,
          fields,
          new Date().toISOString(),
          todayString(),
          makeDemoId,
        ),
      ).ledger,
    voidCharge: async (charge_id, reason) =>
      run((current) =>
        demoVoidCharge(current, charge_id, reason, new Date().toISOString(), todayString()),
      ).ledger,
    setRentSchedule: async (tenancy_id, fields) =>
      run((current) => demoSetSchedule(current, tenancy_id, fields, todayString())).ledger,
    setPaymentInstructions: async (property_id, text) => {
      setInstructions((current) => ({ ...current, [property_id]: text.trim() }));
    },
  };

  return <LedgerContext.Provider value={value}>{props.children}</LedgerContext.Provider>;
}

// ----- real mode (Firebase) -----

function RemoteLedgerStore(props) {
  const user = props.user;
  const role = user.role === 'tenant' ? 'tenant' : 'owner';
  const [ledgers, setLedgers] = useState([]);
  // loading, ready, or error for the first load
  const [status, setStatus] = useState('loading');
  const [error_message, setErrorMessage] = useState('');
  // true while what's on screen is the saved copy because the database couldn't be reached
  const [from_cache, setFromCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ledgers_ref = useRef(ledgers);
  // only save the cache once the database has answered, so an old cache never overwrites itself with less
  const synced = useRef(false);
  const today = todayString();

  function keep(next) {
    ledgers_ref.current = next;
    setLedgers(next);
  }

  // step 1: read the ledgers, step 2: the landlord's phone bills any rent and late fees that came due
  // (the old server's nightly job), each one only if no phone made it already, so a repeat never double charges
  // a tenant's phone works the same charges out on screen without writing them, the landlord's run saves them
  async function fetchAll() {
    if (role === 'tenant') {
      const mine = await getLedgers({ tenant_user_id: user.id });
      return mine.map((ledger) => syncLedger(ledger, todayString()));
    }
    const loaded = await getLedgers({ owner_id: user.id });
    const caught_up = await catchUpLedgers(loaded, todayString());
    return caught_up.ledgers;
  }

  // a full reload, quiet ones keep the list on screen if they fail
  async function loadLedgers(quiet) {
    try {
      const next = await fetchAll();
      synced.current = true;
      keep(next);
      setStatus('ready');
      setFromCache(false);
      setErrorMessage('');
    } catch (error) {
      console.log('Could not load the rent ledger', error.message);
      setErrorMessage(error.message);
      if (ledgers_ref.current.length > 0) {
        setFromCache(true);
        setStatus('ready');
      } else if (!quiet) {
        setStatus('error');
      }
    }
  }

  // the saved copy shows first, then the database's replaces it
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey(cache_key, user.id))
      .then((text) => {
        const saved = text ? JSON.parse(text) : null;
        if (active && saved && saved.version === cache_version && !synced.current) {
          keep(saved.ledgers);
          setFromCache(true);
          setStatus('ready');
        }
      })
      .catch((error) => console.log('Could not read the saved rent ledger', error))
      .finally(() => {
        if (active) {
          loadLedgers(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (!synced.current) {
      return;
    }
    AsyncStorage.setItem(
      storageKey(cache_key, user.id),
      JSON.stringify({ version: cache_version, ledgers: ledgers }),
    ).catch((error) => console.log('Could not save the rent ledger', error));
  }, [ledgers, user.id]);

  // runs one of the demo's rule functions on the newest ledgers, shows the result right away,
  // writes only what changed for that tenancy, and puts the old ledgers back if the write fails
  async function run(change) {
    const before_list = ledgers_ref.current;
    const result = change(before_list);
    const changed = result.ledger;
    const before = before_list.find((item) => item.tenancy_id === changed.tenancy_id);
    keep(result.ledgers);
    try {
      await saveLedgerChange(before, changed);
    } catch (error) {
      keep(before_list);
      throw error;
    }
    // another phone may have changed this ledger too, so the saved copy comes back quietly
    loadLedgers(true);
    return result;
  }

  function createIn(tenancy_id, fields, as_role) {
    const now = new Date().toISOString();
    return run((current) =>
      demoCreatePayment(current, tenancy_id, fields, as_role, now, todayString(), generatePushId),
    ).then((result) => result.payment);
  }

  const split = splitTenantLedgers(ledgers);

  const value = {
    mode: 'real',
    is_demo: false,
    role: role,
    today: today,
    status: status,
    error_message: error_message,
    from_cache: from_cache,
    refreshing: refreshing,
    // pull to refresh on Payments runs the catch-up again too
    refresh: async () => {
      setRefreshing(true);
      await loadLedgers(false);
      setRefreshing(false);
    },
    // a reload with no spinner, for when a screen comes back into view
    reloadQuietly: () => loadLedgers(true),
    ledgers: ledgers,
    current_ledger: role === 'tenant' ? split.current_ledger : null,
    past_ledgers: role === 'tenant' ? split.past_ledgers : [],
    // a tenant with no active tenancy only gets history, and only once the database has said so
    is_read_only: role === 'tenant' && status === 'ready' && !split.current_ledger,
    getLedger: (tenancy_id) => ledgers.find((ledger) => ledger.tenancy_id === tenancy_id) || null,
    findPayment: (payment_id) => findPaymentIn(ledgers, payment_id),
    instructionsFor: (property_id) => {
      const ledger = ledgers.find((item) => item.property_id === property_id);
      // undefined means no ledger here has said, so the screen can fall back to the property's own copy
      return ledger ? ledger.payment_instructions : undefined;
    },
    // worked out here from the ledgers, the same way the demo does it
    current_summary: null,
    getMonthSummary: async (month, property_id) =>
      monthSummary(
        ledgers_ref.current.filter((ledger) => !property_id || ledger.property_id === property_id),
        month,
        todayString(),
      ),
    ensurePayment: async (payment_id) => {
      if (!findPaymentIn(ledgers_ref.current, payment_id)) {
        await loadLedgers(true);
      }
      return findPaymentIn(ledgers_ref.current, payment_id);
    },
    // receipt photos wait for Firebase Storage, so the receipt argument is left out of the saved payment
    recordPayment: (tenancy_id, fields) => createIn(tenancy_id, fields, 'owner'),
    claimPayment: (tenancy_id, fields) => createIn(tenancy_id, fields, 'tenant'),
    confirmPayment: async (payment_id) =>
      (
        await run((current) =>
          demoConfirmPayment(current, payment_id, new Date().toISOString(), todayString()),
        )
      ).payment,
    rejectPayment: async (payment_id, reason) =>
      (
        await run((current) =>
          demoRejectPayment(current, payment_id, reason, new Date().toISOString(), todayString()),
        )
      ).payment,
    voidPayment: async (payment_id, reason) =>
      (
        await run((current) =>
          demoVoidPayment(current, payment_id, reason, new Date().toISOString(), todayString()),
        )
      ).payment,
    addCharge: async (tenancy_id, fields) =>
      (
        await run((current) =>
          demoAddCharge(
            current,
            tenancy_id,
            fields,
            new Date().toISOString(),
            todayString(),
            generatePushId,
          ),
        )
      ).ledger,
    voidCharge: async (charge_id, reason) =>
      (
        await run((current) =>
          demoVoidCharge(current, charge_id, reason, new Date().toISOString(), todayString()),
        )
      ).ledger,
    // a new schedule bills any rent it says is already due right away (through createIfAbsent)
    setRentSchedule: async (tenancy_id, fields) =>
      (await run((current) => demoSetSchedule(current, tenancy_id, fields, todayString()))).ledger,
    setPaymentInstructions: async (property_id, text) => {
      await savePaymentInstructions(property_id, text.trim());
      keep(
        ledgers_ref.current.map((ledger) =>
          ledger.property_id === property_id
            ? { ...ledger, payment_instructions: text.trim() }
            : ledger,
        ),
      );
    },
  };

  return <LedgerContext.Provider value={value}>{props.children}</LedgerContext.Provider>;
}

// screens call this in both modes and get the same shape
export function useLedger() {
  const value = useContext(LedgerContext);
  return value || offValue();
}
