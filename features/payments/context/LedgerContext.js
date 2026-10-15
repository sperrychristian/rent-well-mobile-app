import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../auth/context/AuthContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import {
  getTenants,
  getTenancyLedger,
  getMyLedgers,
  getLedgerSummary,
  getPayment,
  createPayment,
  claimPayment as claimPaymentRequest,
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
  fromApiPayment,
  fromApiEvent,
  fromApiSummary,
  toApiPayment,
  toApiClaim,
  toApiCharge,
  toApiSchedule,
  replaceLedger,
  findPayment as findPaymentIn,
} from '../utils/ledgerApi';
import { monthSummary, monthOf } from '../utils/ledgerMath';
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
// real: the server's ledgers (the Rent ledger section of docs/API.md), with a saved copy for offline,
// and real mode shows the server's own statuses and balances instead of working them out here
const LedgerContext = createContext(null);

// the last ledgers from the server, so the screen isn't empty when the server can't be reached
const cache_key = 'rent_well_ledger_cache';
// version 2 is the real API's shape, an older saved copy is skipped
const cache_version = 2;

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

// ----- real mode -----

function RemoteLedgerStore(props) {
  const user = props.user;
  const role = user.role === 'tenant' ? 'tenant' : 'owner';
  const [ledgers, setLedgers] = useState([]);
  // loading, ready, or error for the first load
  const [status, setStatus] = useState('loading');
  const [error_message, setErrorMessage] = useState('');
  // true while what's on screen is the saved copy because the server couldn't be reached
  const [from_cache, setFromCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // instructions saved this session show right away, before the ledgers reload with them
  const [saved_instructions, setSavedInstructions] = useState({});
  // this month's GET /ledger/summary for the owner, so the dashboard shows the server's collected number
  const [current_summary, setCurrentSummary] = useState(null);
  // the timeline and receipt number for payments that have been opened (GET /payments/:id), by id
  const [details, setDetails] = useState({});
  const ledgers_ref = useRef(ledgers);
  // only save the cache once the server has answered, so an old cache never overwrites itself with less
  const synced = useRef(false);
  // "today" is the property's own date on the server, so the screens use the date the ledgers came back with
  const today = ledgers.length > 0 && ledgers[0].today ? ledgers[0].today : todayString();

  useEffect(() => {
    ledgers_ref.current = ledgers;
  }, [ledgers]);

  function upsert(api_ledger) {
    const ledger = fromApiLedger(api_ledger);
    ledgers_ref.current = replaceLedger(ledgers_ref.current, ledger);
    setLedgers(ledgers_ref.current);
    return ledger;
  }

  // the owner has one ledger per tenancy (current and past), the tenant gets all of theirs in one call
  async function fetchAll() {
    if (role === 'tenant') {
      return (await getMyLedgers()).map(fromApiLedger);
    }
    const tenants = await getTenants();
    const tenancy_ids = [];
    tenants.forEach((tenant) => {
      [...(tenant.activeTenancies || []), ...(tenant.endedTenancies || [])].forEach((tenancy) => {
        if (!tenancy_ids.includes(tenancy.id)) {
          tenancy_ids.push(tenancy.id);
        }
      });
    });
    const api_ledgers = await Promise.all(tenancy_ids.map((id) => getTenancyLedger(id)));
    return api_ledgers.map(fromApiLedger);
  }

  // the owner's month from the server, quietly, a failure just leaves the last one
  async function loadCurrentSummary() {
    if (role !== 'owner') {
      return;
    }
    try {
      setCurrentSummary(await getLedgerSummary(monthOf(todayString())));
    } catch (error) {
      console.log('Could not load the rent summary', error.message);
    }
  }

  // a full reload, quiet ones keep the list on screen if they fail
  async function loadLedgers(quiet) {
    try {
      const next = await fetchAll();
      synced.current = true;
      ledgers_ref.current = next;
      setLedgers(next);
      setStatus('ready');
      setFromCache(false);
      setErrorMessage('');
      loadCurrentSummary();
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

  // after a change (or a ledger:updated) only the one tenancy is fetched again
  async function reloadTenancy(tenancy_id) {
    if (role === 'tenant') {
      const next = (await getMyLedgers()).map(fromApiLedger);
      ledgers_ref.current = next;
      setLedgers(next);
      return next.find((ledger) => ledger.tenancy_id === tenancy_id) || null;
    }
    const ledger = upsert(await getTenancyLedger(tenancy_id));
    loadCurrentSummary();
    return ledger;
  }

  // GET /payments/:id: the payment, its timeline, and the receipt number once it's confirmed
  async function loadDetail(payment_id) {
    const data = await getPayment(payment_id);
    const payment = fromApiPayment(data.payment);
    setDetails((current) => ({
      ...current,
      [payment_id]: {
        events: (data.events || []).map(fromApiEvent),
        receipt_number: data.receipt ? data.receipt.receiptNumber : null,
      },
    }));
    return payment;
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

  // ledger:updated says which tenancy changed (and may carry the whole ledger), a reconnect reloads quietly,
  // and a tapped push opens the payment or the ledger it's about
  // (the real server only says what changed, { tenancyId, reason, paymentId, chargeId }, so I refetch that
  // tenancy and any payment that's open on screen)
  const latest = useRef({ reloadTenancy, loadLedgers, loadDetail, details });
  useEffect(() => {
    latest.current = { reloadTenancy, loadLedgers, loadDetail, details };
  });
  useEffect(() => {
    const stop_updated = onSocketEvent('ledger:updated', (payload) => {
      if (!payload || !payload.tenancyId) {
        return;
      }
      latest.current
        .reloadTenancy(payload.tenancyId)
        .catch((error) => console.log('Could not reload a ledger', error.message));
      if (payload.paymentId && latest.current.details[payload.paymentId]) {
        latest.current
          .loadDetail(payload.paymentId)
          .catch((error) => console.log('Could not reload a payment', error.message));
      }
    });
    const stop_connect = onSocketEvent('connect', () => latest.current.loadLedgers(true));
    const stop_taps = listenForLedgerTaps((target) => {
      if (target.payment_id) {
        navigateWhenReady('PaymentDetail', { paymentId: target.payment_id });
      } else if (role === 'owner' && target.tenancy_id) {
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
  async function sendPayment(tenancy_id, fields, receipt, is_claim) {
    const receipt_key = receipt ? await uploadImage(receipt.uri, receipt.mime_type) : null;
    const value = { ...fields, receipt_key: receipt_key };
    const api_payment = is_claim
      ? await claimPaymentRequest(toApiClaim(tenancy_id, value))
      : await createPayment(tenancy_id, toApiPayment(value));
    await reloadTenancy(tenancy_id);
    return fromApiPayment(api_payment);
  }

  // confirm, reject, and void answer with the payment, then its tenancy gets refetched for the new balances
  async function changePayment(request) {
    const payment = fromApiPayment(await request);
    if (payment.tenancy_id) {
      await reloadTenancy(payment.tenancy_id);
    }
    if (details[payment.id]) {
      loadDetail(payment.id).catch(() => {});
    }
    return payment;
  }

  const split = splitTenantLedgers(ledgers);

  function instructionsFor(property_id) {
    if (saved_instructions[property_id] !== undefined) {
      return saved_instructions[property_id];
    }
    const ledger = ledgers.find((item) => item.property_id === property_id);
    // undefined means no ledger here has said, so the screen can fall back to the property's own copy
    return ledger ? ledger.payment_instructions : undefined;
  }

  // a payment with its timeline filled in once it's been opened
  function withDetail(found) {
    if (!found || !details[found.payment.id]) {
      return found;
    }
    const detail = details[found.payment.id];
    return {
      ...found,
      payment: { ...found.payment, events: detail.events, receipt_number: detail.receipt_number },
    };
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
    findPayment: (payment_id) => withDetail(findPaymentIn(ledgers, payment_id)),
    instructionsFor: instructionsFor,
    current_summary: current_summary ? fromApiSummary(current_summary, []) : null,
    // the owner's month from the server, pending claims come from the ledgers already on hand
    getMonthSummary: async (month, property_id) => {
      const pending = [];
      ledgers_ref.current
        .filter((ledger) => !property_id || ledger.property_id === property_id)
        .forEach((ledger) =>
          ledger.payments
            .filter((payment) => payment.status === 'pending_confirmation')
            .forEach((payment) => pending.push({ payment, ledger })),
        );
      return fromApiSummary(await getLedgerSummary(month), pending, property_id);
    },
    // a push tap can open a payment that isn't loaded yet, and an open payment wants its timeline
    ensurePayment: async (payment_id) => {
      const payment = await loadDetail(payment_id);
      if (!findPaymentIn(ledgers_ref.current, payment_id) && payment.tenancy_id) {
        await reloadTenancy(payment.tenancy_id);
      }
      return findPaymentIn(ledgers_ref.current, payment_id);
    },
    recordPayment: (tenancy_id, fields, receipt) => sendPayment(tenancy_id, fields, receipt, false),
    claimPayment: (tenancy_id, fields, receipt) => sendPayment(tenancy_id, fields, receipt, true),
    confirmPayment: (payment_id) => changePayment(confirmPaymentRequest(payment_id)),
    rejectPayment: (payment_id, reason) => changePayment(rejectPaymentRequest(payment_id, reason)),
    voidPayment: (payment_id, reason) => changePayment(voidPaymentRequest(payment_id, reason)),
    addCharge: async (tenancy_id, fields) => {
      await addChargeRequest(tenancy_id, toApiCharge(fields));
      return reloadTenancy(tenancy_id);
    },
    voidCharge: async (charge_id, reason) => {
      const charge = await voidChargeRequest(charge_id, reason);
      return reloadTenancy(charge.tenancyId);
    },
    // the server bills the new rent on its next ledger job run, so the charges show up a bit later
    setRentSchedule: async (tenancy_id, fields) => {
      await setRentScheduleRequest(tenancy_id, toApiSchedule(fields));
      return reloadTenancy(tenancy_id);
    },
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
