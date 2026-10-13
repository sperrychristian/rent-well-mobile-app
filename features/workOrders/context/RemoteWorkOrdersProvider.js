import { useState, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RemoteWorkOrdersContext } from './remoteWorkOrdersContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import { useAuth } from '../../auth/context/AuthContext';
import {
  getAllWorkOrders,
  getWorkOrder,
  createTenantWorkOrder,
  updateWorkOrderStatus,
  updateWorkOrderPriority,
  updateWorkOrderNotes,
  updateWorkOrderContractor,
  addWorkOrderPhotos,
  uploadImage,
} from '../../../services/api';
import { onSocketEvent } from '../../../services/socket';
import { listenForWorkOrderTaps } from '../../../services/push';
import { navigateWhenReady } from '../../../services/navigationRef';
import { storageKey } from '../../../utils/storageKeys';
import { todayString } from '../../../utils/formatDate';
import {
  fromApiWorkOrder,
  mergeWorkOrders,
  replaceWorkOrder,
  applyStatus,
  openCount,
  activeCount,
  legacyExpensesFor,
} from '../utils/workOrderHelpers';

// the last list from the server, so the screen isn't empty when the server can't be reached for a bit
const cache_key = 'rent_well_work_orders_cache';
const cache_version = 1;

// real mode gets its own store, keyed by the account so logging in as someone else starts clean
// demo and signed out get null, which makes useWorkOrders() hand back the local data like before
export function RemoteWorkOrdersProvider(props) {
  const { user } = useAuth();
  const local = useWorkOrders();
  const real = !!user && !local.demo_mode;
  if (!real) {
    return (
      <RemoteWorkOrdersContext.Provider value={null}>
        {props.children}
      </RemoteWorkOrdersContext.Provider>
    );
  }
  return (
    <RemoteStore key={user.id} user={user} local={local}>
      {props.children}
    </RemoteStore>
  );
}

// uploads the photos one at a time and gives back their keys, onProgress hears which one is going
async function uploadPhotos(photos, onProgress) {
  const keys = [];
  for (let index = 0; index < photos.length; index++) {
    if (onProgress) {
      onProgress(index + 1, photos.length);
    }
    keys.push(await uploadImage(photos[index].uri, photos[index].mime_type));
  }
  return keys;
}

function RemoteStore(props) {
  const user = props.user;
  const local = props.local;
  const is_tenant = user.role === 'tenant';

  const [orders, setOrders] = useState([]);
  // loading, ready, or error for the list
  const [status, setStatus] = useState('loading');
  const [error_message, setErrorMessage] = useState('');
  // true while the list on screen is the saved copy because the server couldn't be reached
  const [from_cache, setFromCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const orders_ref = useRef(orders);
  // only save the cache once the server has answered at least once, so an old cache never overwrites itself with less
  const synced = useRef(false);

  useEffect(() => {
    orders_ref.current = orders;
  }, [orders]);

  function upsert(api_order) {
    const order = fromApiWorkOrder(api_order);
    setOrders((current) => mergeWorkOrders(current, [order]));
    return order;
  }

  // a full reload from the server, quiet ones keep the list on screen if they fail
  async function loadOrders(quiet) {
    try {
      const api_orders = await getAllWorkOrders();
      synced.current = true;
      setOrders(mergeWorkOrders([], api_orders.map(fromApiWorkOrder)));
      setStatus('ready');
      setFromCache(false);
      setErrorMessage('');
    } catch (error) {
      console.log('Could not load work orders', error.message);
      setErrorMessage(error.message);
      if (orders_ref.current.length > 0) {
        // keep showing what I had and say it might be out of date
        setFromCache(true);
        setStatus('ready');
      } else if (!quiet) {
        setStatus('error');
      }
    }
  }

  // the saved list shows first, then the server's copy replaces it
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey(cache_key, user.id))
      .then((text) => {
        const saved = text ? JSON.parse(text) : null;
        if (active && saved && saved.version === cache_version && !synced.current) {
          setOrders(saved.orders);
          setFromCache(true);
          setStatus('ready');
        }
      })
      .catch((error) => console.log('Could not read the saved work orders', error))
      .finally(() => {
        if (active) {
          loadOrders(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  // keeps the saved copy up to date with every change from the server or the socket
  useEffect(() => {
    if (!synced.current) {
      return;
    }
    AsyncStorage.setItem(
      storageKey(cache_key, user.id),
      JSON.stringify({ version: cache_version, orders: orders }),
    ).catch((error) => console.log('Could not save the work orders', error));
  }, [orders, user.id]);

  // the socket sends the whole order on every change, so I just put it in place by id
  // after a reconnect I reload quietly in case something changed while I was offline
  // a tapped push opens the order (owner) or the request (tenant)
  const latest = useRef({ upsert, loadOrders });
  useEffect(() => {
    latest.current = { upsert, loadOrders };
  });
  useEffect(() => {
    const stop_new = onSocketEvent('workorder:new', (payload) =>
      latest.current.upsert(payload.workOrder),
    );
    const stop_updated = onSocketEvent('workorder:updated', (payload) =>
      latest.current.upsert(payload.workOrder),
    );
    const stop_connect = onSocketEvent('connect', () => latest.current.loadOrders(true));
    const stop_taps = listenForWorkOrderTaps((work_order_id) =>
      navigateWhenReady(is_tenant ? 'RequestDetail' : 'WorkOrderDetail', {
        order_id: work_order_id,
      }),
    );
    return () => {
      stop_new();
      stop_updated();
      stop_connect();
      stop_taps();
    };
  }, [is_tenant]);

  // ----- actions, they all give back a promise and throw an ApiError the screen can show -----

  async function refreshOrders() {
    setRefreshing(true);
    await loadOrders(false);
    setRefreshing(false);
  }

  // a push tap can open an order that isn't in the list yet, so the detail screen asks for it here
  async function ensureOrder(order_id) {
    const found = orders_ref.current.find((order) => order.id === order_id);
    if (found) {
      return found;
    }
    return upsert(await getWorkOrder(order_id));
  }

  // shows the change right away, then swaps in the server's copy, or puts the old one back if it failed
  async function changeOrder(order_id, makeChange, sendChange) {
    const before = orders_ref.current.find((order) => order.id === order_id);
    if (before) {
      setOrders((current) => replaceWorkOrder(current, makeChange(before)));
    }
    try {
      upsert(await sendChange());
    } catch (error) {
      if (before) {
        setOrders((current) => replaceWorkOrder(current, before));
      }
      throw error;
    }
  }

  function startWorkOrder(order_id) {
    return changeOrder(
      order_id,
      (order) => applyStatus(order, 'In Progress', todayString()),
      () => updateWorkOrderStatus(order_id, 'In Progress'),
    );
  }

  function resolveWorkOrder(order_id) {
    return changeOrder(
      order_id,
      (order) => applyStatus(order, 'Resolved', todayString()),
      () => updateWorkOrderStatus(order_id, 'Resolved'),
    );
  }

  function setPriority(order_id, priority) {
    return changeOrder(
      order_id,
      (order) => ({ ...order, priority: priority }),
      () => updateWorkOrderPriority(order_id, priority),
    );
  }

  function setNotes(order_id, notes) {
    return changeOrder(
      order_id,
      (order) => ({ ...order, notes: notes }),
      () => updateWorkOrderNotes(order_id, notes),
    );
  }

  function setContractorInfo(order_id, contractor, estimate) {
    return changeOrder(
      order_id,
      (order) => ({ ...order, contractor: contractor, estimate: estimate }),
      () => updateWorkOrderContractor(order_id, contractor, estimate),
    );
  }

  // the tenant's Report an Issue, request is { title, description, priority, photos, tenancy_id }
  // photos are { uri, mime_type }, they go up first and only then does the request get created
  async function addWorkOrder(request, onProgress) {
    const photo_keys = await uploadPhotos(request.photos || [], onProgress);
    const api_order = await createTenantWorkOrder({
      title: request.title,
      description: request.description,
      priority: request.priority,
      photo_keys: photo_keys,
      tenancy_id: request.tenancy_id,
    });
    return upsert(api_order);
  }

  async function addOrderPhotos(order_id, photos, onProgress) {
    const photo_keys = await uploadPhotos(photos, onProgress);
    return upsert(await addWorkOrderPhotos(order_id, photo_keys));
  }

  // expenses stay on the phone (saved per account), they link to the server's orders by work_order_id
  const orders_with_expenses = useMemo(
    () =>
      orders.map((order) => ({ ...order, expenses: legacyExpensesFor(local.expenses, order.id) })),
    [orders, local.expenses],
  );

  // the pickers and filters also need the properties that only show up on server orders
  const properties = useMemo(
    () =>
      [...new Set([...local.properties, ...orders.map((order) => order.property)])]
        .filter(Boolean)
        .sort(),
    [local.properties, orders],
  );

  function getOrder(order_id) {
    return orders_with_expenses.find((order) => order.id === order_id);
  }

  // the same shape as the local context, with the work order parts coming from the server
  const value = {
    ...local,
    orders: orders_with_expenses,
    properties,
    getOrder,
    startWorkOrder,
    resolveWorkOrder,
    setPriority,
    setNotes,
    setContractorInfo,
    addWorkOrder,
    // only real mode has these, screens check is_remote before using them
    is_remote: true,
    role: user.role,
    orders_status: status,
    orders_error: error_message,
    orders_from_cache: from_cache,
    refreshing_orders: refreshing,
    refreshOrders,
    ensureOrder,
    addOrderPhotos,
    open_count: openCount(orders),
    active_count: activeCount(orders),
  };

  return (
    <RemoteWorkOrdersContext.Provider value={value}>
      {props.children}
    </RemoteWorkOrdersContext.Provider>
  );
}
