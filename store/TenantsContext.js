import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useWorkOrders } from './WorkOrdersContext';
import { getTenantData, saveTenantDataChanges } from '../util/http';
import { todayString } from '../util/formatDate';
import { ordersForTenantRecord } from '../features/workOrders/utils/workOrderHelpers';
import { generatePushId } from '../util/data/pushId';
import {
  buildDemoView,
  demoAddProperty,
  demoUpdateProperty,
  demoDeleteProperty,
  demoCreateInvite,
  demoRevokeInvite,
  demoResendInvite,
  demoAssign,
  demoMove,
  demoEnd,
  makeInviteCode,
} from '../features/tenants/utils/demoTenants';
import { demo_tenant } from '../features/tenants/data/sampleTenants';
import { fromApiLeaseEvent } from '../features/leases/utils/leaseHelpers';
import { demoSetLease, demoRenewLease, demoLeaseEvents } from '../features/leases/utils/demoLeases';

const TenantsContext = createContext(null);

// ids for things made in the demo, same idea as the local context
function makeId() {
  return 'demo-' + Date.now().toString() + '-' + Math.random().toString(36).slice(2, 7);
}

// Firebase records get push ids instead, so they sort by when they were made
function firebaseId() {
  return generatePushId();
}

// the landlord's bundle from Firebase (properties, tenants, tenancies, invites, leases), in the demo's shape
const empty_remote = { key: null, data: null, status: 'loading', error: '' };

// one interface for tenants, properties, and invites in both modes
// demo runs every action on the local data with the server's rules, real mode calls the api
// milestone 2: real mode runs those same rules on the Firebase records and writes what changed
// it also knows whether a signed-in tenant still has an active rental, for the read-only mode
export function TenantsProvider(props) {
  const { user } = useAuth();
  const local = useWorkOrders();
  const mode = local.demo_mode ? 'demo' : user ? 'real' : 'off';
  // the demo can be on either side now, the tenant side reads Sam's rentals from the same demo data
  const role = mode === 'demo' ? local.demo_role : user ? user.role : null;
  const is_demo_tenant = mode === 'demo' && role === 'tenant';
  // whose data this is, the server data is tagged with it so a different login never sees the last one's
  const session_key = mode + ':' + (user ? user.id : '');
  const is_real_tenant = mode === 'real' && role === 'tenant';
  // the id maker the rule functions get, demo ids in the demo and push ids for Firebase
  const makeIdFor = () => (mode === 'demo' ? makeId : firebaseId);

  const [remote, setRemote] = useState(empty_remote);
  const [refreshing, setRefreshing] = useState(false);
  // the newest bundle, so a change always starts from what was saved last
  const remote_ref = useRef(remote);
  // a tenant reads their landlord's bundle and the screens pick out their own rentals
  const owner_id = user ? (user.role === 'tenant' ? user.ownerId : user.id) : null;

  // ----- loading from Firebase -----

  // quiet reloads (after a change or when a screen comes back into view) keep what's on screen if they fail
  async function loadRemote(key, quiet) {
    try {
      const data = await getTenantData(owner_id);
      remote_ref.current = { key: key, data: data, status: 'ready', error: '' };
      setRemote(remote_ref.current);
    } catch (error) {
      console.log('Could not load tenants', error.message);
      const current = remote_ref.current;
      const has_data = current.key === key && current.status === 'ready';
      if (has_data) {
        remote_ref.current = { ...current, error: error.message };
      } else if (!(quiet && current.key === key)) {
        remote_ref.current = { ...empty_remote, key: key, status: 'error', error: error.message };
      }
      setRemote(remote_ref.current);
    }
  }

  function reloadForSession(quiet) {
    if (mode === 'real' && owner_id) {
      return loadRemote(session_key, quiet);
    }
    return Promise.resolve();
  }

  // loads whenever a different account signs in or the mode changes
  useEffect(() => {
    reloadForSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_key]);

  // ----- what the screens see -----

  const remote_ready = mode === 'real' && remote.key === session_key && remote.data;
  const source_data = mode === 'demo' ? local.demo_tenant_data : remote_ready ? remote.data : null;
  const demo_view = useMemo(
    () => (source_data ? buildDemoView(source_data, local.orders, new Date()) : null),
    [source_data, local.orders],
  );

  let view;
  if (demo_view) {
    view = { ...demo_view, status: 'ready', error: mode === 'real' ? remote.error : '' };
  } else if (mode === 'real' && remote.key === session_key && remote.status === 'error') {
    view = { tenants: [], properties: [], invites: [], status: 'error', error: remote.error };
  } else if (mode === 'real') {
    view = { tenants: [], properties: [], invites: [], status: 'loading', error: '' };
  } else {
    view = { tenants: [], properties: [], invites: [], status: 'ready', error: '' };
  }

  async function refresh() {
    setRefreshing(true);
    await reloadForSession(false);
    setRefreshing(false);
  }

  // the demo runs the change on the current data first, so a rule it breaks throws before anything is saved
  function runDemo(change) {
    const result = change(local.demo_tenant_data);
    local.setDemoTenantData(result.data || result);
    return result;
  }

  // Firebase runs the same rule functions on the saved bundle, shows the result right away,
  // then writes only what changed in one multi-path PATCH, and puts the old bundle back if that fails
  async function runRemote(change) {
    const before = remote_ref.current;
    const result = change(before.data);
    const after = result.data || result;
    remote_ref.current = { ...before, data: after };
    setRemote(remote_ref.current);
    try {
      await saveTenantDataChanges(before.data, after, owner_id);
    } catch (error) {
      remote_ref.current = before;
      setRemote(before);
      throw error;
    }
    // other phones may have changed something too, so it reads the saved copy back quietly
    loadRemote(session_key, true);
    return result;
  }

  // one place that picks the demo or Firebase, every action below goes through it
  async function run(change) {
    if (mode === 'demo') {
      return runDemo(change);
    }
    return runRemote(change);
  }

  // ----- properties -----

  async function addProperty(name, address) {
    return (await run((data) => demoAddProperty(data, { name, address }, makeIdFor()))).property;
  }

  // fields is { name, address }
  async function updateProperty(property_id, fields) {
    await run((data) => demoUpdateProperty(data, property_id, fields));
  }

  async function deleteProperty(property_id) {
    await run((data) => demoDeleteProperty(data, property_id, local.orders, new Date()));
  }

  // ----- invites -----

  // fields: property_id, tenant_name, unit_label, gives back the invite in the server's shape
  async function createInvite(fields) {
    return (
      await run((data) => demoCreateInvite(data, fields, new Date(), makeIdFor(), makeInviteCode))
    ).invite;
  }

  async function revokeInvite(invite_id) {
    return (await run((data) => demoRevokeInvite(data, invite_id, new Date()))).invite;
  }

  // gives back the new invite, the old one is now revoked
  async function resendInvite(invite_id) {
    return (
      await run((data) =>
        demoResendInvite(data, invite_id, new Date(), makeIdFor(), makeInviteCode),
      )
    ).invite;
  }

  // ----- tenancies -----

  async function assignTenant(tenant_id, property_id, unit_label) {
    await run((data) =>
      demoAssign(data, { tenant_id, property_id, unit_label }, new Date(), makeIdFor()),
    );
  }

  // fields: property_id, unit_label, ended_at, move_out_note
  async function moveTenancy(tenancy_id, fields) {
    await run((data) => demoMove(data, tenancy_id, fields, todayString(), new Date(), makeIdFor()));
  }

  // fields: ended_at, move_out_note
  async function endTenancy(tenancy_id, fields) {
    await run((data) => demoEnd(data, tenancy_id, fields, todayString()));
  }

  // ----- leases (owner only) -----

  // the lease and its timeline, oldest event first, both modes read it from the tenant data
  async function fetchLease(tenancy_id) {
    const data = mode === 'demo' ? local.demo_tenant_data : remote_ref.current.data;
    return {
      events: demoLeaseEvents(data || { lease_events: {} }, tenancy_id).map(fromApiLeaseEvent),
    };
  }

  // value: { lease_start_on, lease_end_on, lease_term, renewal_notice_days, lease_notes }
  async function setLease(tenancy_id, value) {
    await run((data) =>
      demoSetLease(data, tenancy_id, value, todayString(), new Date(), makeIdFor()),
    );
  }

  // value: { new_end_on, new_rent_cents (or null) }, has_schedule says whether the tenancy has a rent schedule,
  // since the schedule lives in the ledger store (the renew hook changes it there)
  async function renewLease(tenancy_id, value, has_schedule) {
    await run((data) =>
      demoRenewLease(data, tenancy_id, value, todayString(), new Date(), makeIdFor(), has_schedule),
    );
  }

  // the detail screen gets the tenant plus their recent work orders, from the shared orders already loaded
  async function fetchTenantDetail(tenant_id) {
    if (mode === 'real') {
      await loadRemote(session_key, true);
    }
    const tenant = view.tenants.find((item) => item.id === tenant_id);
    if (!tenant) {
      return null;
    }
    const recent =
      mode === 'demo'
        ? local.orders
            .filter((order) => order.tenant === tenant.name)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
        : ordersForTenantRecord(local.orders, tenant);
    return { tenant: tenant, recent_work_orders: recent.slice(0, 10) };
  }

  function getTenantById(tenant_id) {
    return view.tenants.find((tenant) => tenant.id === tenant_id);
  }

  // a tenant with no active rental only gets to read, but only once that's confirmed, so the home doesn't flash
  // the demo tenant is Sam, so ending or moving Sam on the landlord side shows up here after switching
  const me_id = is_demo_tenant ? demo_tenant.id : is_real_tenant ? user.id : null;
  const me = me_id && demo_view ? view.tenants.find((tenant) => tenant.id === me_id) || null : null;
  const me_ready = is_demo_tenant || (is_real_tenant && !!remote_ready);

  const value = {
    mode,
    role,
    is_demo: mode === 'demo',
    // the owner whose records these are, the ledger and reminders scope by it
    owner_id: mode === 'real' ? owner_id : null,
    // the bundle itself, the reminders hook reads its log and the demo's from here
    tenant_data: source_data,
    status: view.status,
    error_message: view.error,
    refreshing,
    tenants: view.tenants,
    properties: view.properties,
    invites: view.invites,
    refresh,
    // a reload with no spinner, for when a screen comes back into view
    reloadQuietly: () => reloadForSession(true),
    getTenantById,
    fetchTenantDetail,
    addProperty,
    updateProperty,
    deleteProperty,
    createInvite,
    revokeInvite,
    resendInvite,
    assignTenant,
    moveTenancy,
    endTenancy,
    fetchLease,
    setLease,
    renewLease,
    // finds one tenancy (active or past) and its tenant, for the lease screens
    findTenancy: (tenancy_id) => {
      for (const tenant of view.tenants) {
        const tenancy = [...tenant.active_tenancies, ...tenant.ended_tenancies].find(
          (item) => item.id === tenancy_id,
        );
        if (tenancy) {
          return { tenant, tenancy };
        }
      }
      return null;
    },
    // the tenant side
    is_read_only: me_ready && (!me || me.active_tenancies.length === 0),
    my_active_tenancies: me ? me.active_tenancies : [],
    my_ended_tenancies: me ? me.ended_tenancies : [],
    reloadMe: () => (is_real_tenant ? loadRemote(session_key, true) : Promise.resolve()),
  };

  return <TenantsContext.Provider value={value}>{props.children}</TenantsContext.Provider>;
}

// screens call this for tenants, properties, invites, and the tenant's own rental
export function useTenants() {
  return useContext(TenantsContext);
}
