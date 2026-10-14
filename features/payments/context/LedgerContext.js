import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../auth/context/AuthContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import {
  getLedgers,
  getLedger as getLedgerRequest,
  getPayment,
  createPayment,
  confirmPayment as confirmPaymentRequest,
  rejectPayment as rejectPaymentRequest,
  voidPayment as voidPaymentRequest,
  addCharge as addChargeRequest,
  voidCharge as voidChargeRequest,
  setRentSchedule as setRentScheduleRequest,
  updateProperty as updatePropertyRequest,
  uploadImage,
} from '../../../services/api';
import { ApiError } from '../../../services/apiHelpers';
import { onSocketEvent } from '../../../services/socket';
import { listenForLedgerTaps } from '../../../services/push';
import { navigateWhenReady } from '../../../services/navigationRef';
import { storageKey } from '../../../utils/storageKeys';
import { todayString } from '../../../utils/formatDate';
import {
  fromApiLedger,
  toApiPayment,
  toApiCharge,
  toApiSchedule,
  replaceLedger,
  findPayment as findPaymentIn,
} from '../utils/ledgerApi';
import {
  demoCreatePayment,
  demoConfirmPayment,
  demoRejectPayment,
  demoVoidPayment,
  demoAddCharge,
  demoVoidCharge,
  demoSetSchedule,
} from '../utils/demoLedger';
import { buildSampleLedgers, buildSampleInstructions } from '../data/sampleLedger';
import { demo_tenant } from '../../tenants/data/sampleTenants';

// the rent ledger for both modes behind one useLedger(), screens never check which one they got
// demo: sample ledgers in memory only, never saved, and a fresh set every time the demo starts
// real: the server's ledgers (draft contract, docs/API-ledger-draft.md), with a saved copy for offline
const LedgerContext = createContext(null);

// the last ledgers from the server, so the screen isn't empty when the server can't be reached
const cache_key = 'rent_well_ledger_cache';
const cache_version = 1;

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
    instructionsFor: () => '',
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
    instructionsFor: (property_id) => instructions[property_id] || '',
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

// ----- real mode -----

function RemoteLedgerStore(props) {
  const user = props.user;
  const role = user.role === 'tenant' ? 'tenant' : 'owner';
  const today = todayString();
  const [ledgers, setLedgers] = useState([]);
  // loading, ready, or error for the first load
  const [status, setStatus] = useState('loading');
  const [error_message, setErrorMessage] = useState('');
  // true while what's on screen is the saved copy because the server couldn't be reached
  const [from_cache, setFromCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // instructions saved this session show right away, before the ledgers reload with them
  const [saved_instructions, setSavedInstructions] = useState({});
  const ledgers_ref = useRef(ledgers);
  // only save the cache once the server has answered, so an old cache never overwrites itself with less
  const synced = useRef(false);

  useEffect(() => {
    ledgers_ref.current = ledgers;
  }, [ledgers]);

  function upsert(api_ledger) {
    const ledger = fromApiLedger(api_ledger);
    ledgers_ref.current = replaceLedger(ledgers_ref.current, ledger);
    setLedgers(ledgers_ref.current);
    return ledger;
  }

  // a full reload, quiet ones keep the list on screen if they fail
  async function loadLedgers(quiet) {
    try {
      const api_ledgers = await getLedgers();
      synced.current = true;
      const next = api_ledgers.map(fromApiLedger);
      ledgers_ref.current = next;
      setLedgers(next);
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

  // the saved copy shows first, then the server's replaces it
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey(cache_key, user.id))
      .then((text) => {
        const saved = text ? JSON.parse(text) : null;
        if (active && saved && saved.version === cache_version && !synced.current) {
          ledgers_ref.current = saved.ledgers;
          setLedgers(saved.ledgers);
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

  // ledger:updated says which tenancy changed (and may carry the whole ledger), a reconnect reloads quietly,
  // and a tapped push opens the payment or the ledger it's about
  const latest = useRef({ upsert, loadLedgers });
  useEffect(() => {
    latest.current = { upsert, loadLedgers };
  });
  useEffect(() => {
    const stop_updated = onSocketEvent('ledger:updated', (payload) => {
      if (!payload) {
        return;
      }
      if (payload.ledger) {
        latest.current.upsert(payload.ledger);
      } else if (payload.tenancyId) {
        getLedgerRequest(payload.tenancyId)
          .then((ledger) => latest.current.upsert(ledger))
          .catch((error) => console.log('Could not reload a ledger', error.message));
      }
    });
    const stop_connect = onSocketEvent('connect', () => latest.current.loadLedgers(true));
    const stop_taps = listenForLedgerTaps((target) => {
      if (target.payment_id) {
        navigateWhenReady('PaymentDetail', { paymentId: target.payment_id });
      } else if (role === 'owner') {
        navigateWhenReady('TenantLedger', { tenancyId: target.tenancy_id });
      } else {
        navigateWhenReady('Payments');
      }
    });
    return () => {
      stop_updated();
      stop_connect();
      stop_taps();
    };
  }, [role]);

  // uploads the receipt photo first when there is one, the payment just carries its key
  async function sendPayment(tenancy_id, fields, receipt) {
    const receipt_key = receipt ? await uploadImage(receipt.uri, receipt.mime_type) : null;
    const before = new Set(
      (
        ledgers_ref.current.find((ledger) => ledger.tenancy_id === tenancy_id) || { payments: [] }
      ).payments.map((payment) => payment.id),
    );
    const ledger = upsert(
      await createPayment(tenancy_id, toApiPayment({ ...fields, receipt_key: receipt_key })),
    );
    // the new one is the payment that wasn't there before
    return ledger.payments.find((payment) => !before.has(payment.id)) || null;
  }

  function paymentAfter(ledger, payment_id) {
    return ledger.payments.find((payment) => payment.id === payment_id) || null;
  }

  const split = splitTenantLedgers(ledgers);

  function instructionsFor(property_id) {
    if (saved_instructions[property_id] !== undefined) {
      return saved_instructions[property_id];
    }
    const ledger = ledgers.find((item) => item.property_id === property_id);
    return ledger ? ledger.payment_instructions : '';
  }

  const value = {
    mode: 'real',
    is_demo: false,
    role: role,
    today: today,
    status: status,
    error_message: error_message,
    from_cache: from_cache,
    refreshing: refreshing,
    refresh: async () => {
      setRefreshing(true);
      await loadLedgers(false);
      setRefreshing(false);
    },
    ledgers: ledgers.map((ledger) =>
      saved_instructions[ledger.property_id] !== undefined
        ? { ...ledger, payment_instructions: saved_instructions[ledger.property_id] }
        : ledger,
    ),
    current_ledger: role === 'tenant' ? split.current_ledger : null,
    past_ledgers: role === 'tenant' ? split.past_ledgers : [],
    // a tenant with no active tenancy only gets history, and only once the server has said so
    is_read_only: role === 'tenant' && status === 'ready' && !split.current_ledger,
    getLedger: (tenancy_id) => ledgers.find((ledger) => ledger.tenancy_id === tenancy_id) || null,
    findPayment: (payment_id) => findPaymentIn(ledgers, payment_id),
    instructionsFor: instructionsFor,
    // a push tap can open a payment that isn't loaded yet
    ensurePayment: async (payment_id) => {
      const found = findPaymentIn(ledgers_ref.current, payment_id);
      if (found) {
        return found;
      }
      const data = await getPayment(payment_id);
      upsert(data.ledger);
      return findPaymentIn(ledgers_ref.current, payment_id);
    },
    recordPayment: (tenancy_id, fields, receipt) => sendPayment(tenancy_id, fields, receipt),
    claimPayment: (tenancy_id, fields, receipt) =>
      sendPayment(tenancy_id, { ...fields, is_refund: false }, receipt),
    confirmPayment: async (payment_id) =>
      paymentAfter(upsert(await confirmPaymentRequest(payment_id)), payment_id),
    rejectPayment: async (payment_id, reason) =>
      paymentAfter(upsert(await rejectPaymentRequest(payment_id, reason)), payment_id),
    voidPayment: async (payment_id, reason) =>
      paymentAfter(upsert(await voidPaymentRequest(payment_id, reason)), payment_id),
    addCharge: async (tenancy_id, fields) =>
      upsert(await addChargeRequest(tenancy_id, toApiCharge(fields))),
    voidCharge: async (charge_id, reason) => upsert(await voidChargeRequest(charge_id, reason)),
    setRentSchedule: async (tenancy_id, fields) =>
      upsert(await setRentScheduleRequest(tenancy_id, toApiSchedule(fields))),
    setPaymentInstructions: async (property_id, text) => {
      await updatePropertyRequest(property_id, { paymentInstructions: text.trim() });
      setSavedInstructions((current) => ({ ...current, [property_id]: text.trim() }));
    },
  };

  return <LedgerContext.Provider value={value}>{props.children}</LedgerContext.Provider>;
}

// screens call this in both modes and get the same shape
export function useLedger() {
  const value = useContext(LedgerContext);
  return value || offValue();
}
