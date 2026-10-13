import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import {
  api_client,
  getMe,
  getTenants,
  getTenant,
  getProperties,
  createProperty,
  updateProperty as updatePropertyRequest,
  deleteProperty as deletePropertyRequest,
  getInvites,
  createInvite as createInviteRequest,
  revokeInvite as revokeInviteRequest,
  resendInvite as resendInviteRequest,
  assignTenancy,
  moveTenancy as moveTenancyRequest,
  endTenancy as endTenancyRequest,
} from '../../../services/api';
import { onSocketEvent } from '../../../services/socket';
import { listenForTenancyTaps } from '../../../services/push';
import { navigateWhenReady } from '../../../services/navigationRef';
import { todayString } from '../../../utils/formatDate';
import { fromApiTenant, fromApiTenancy, fromApiProperty } from '../utils/tenantHelpers';
import { fromApiWorkOrder } from '../../workOrders/utils/workOrderHelpers';
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
} from '../utils/demoTenants';

const TenantsContext = createContext(null);

// ids for things made in the demo, same idea as the local context
function makeId() {
  return 'demo-' + Date.now().toString() + '-' + Math.random().toString(36).slice(2, 7);
}

const empty_owner_data = {
  key: null,
  tenants: [],
  properties: [],
  invites: [],
  status: 'loading',
  error: '',
};

const empty_me = { key: null, active: [], ended: [], status: 'loading' };

// one interface for tenants, properties, and invites in both modes
// demo runs every action on the local data with the server's rules, real mode calls the api
// it also knows whether a signed-in tenant still has an active rental, for the read-only mode
export function TenantsProvider(props) {
  const { user } = useAuth();
  const local = useWorkOrders();
  const mode = local.demo_mode ? 'demo' : user ? 'real' : 'off';
  const role = mode === 'demo' ? 'owner' : user ? user.role : null;
  // whose data this is, the server data is tagged with it so a different login never sees the last one's
  const session_key = mode + ':' + (user ? user.id : '');
  const is_real_owner = mode === 'real' && role === 'owner';
  const is_real_tenant = mode === 'real' && role === 'tenant';

  const [owner_data, setOwnerData] = useState(empty_owner_data);
  const [me, setMe] = useState(empty_me);
  const [refreshing, setRefreshing] = useState(false);

  // ----- loading from the server -----

  // quiet reloads (after a socket event or a change) keep what's on screen if they fail
  async function loadOwnerData(key, quiet) {
    try {
      const [api_tenants, api_properties, api_invites] = await Promise.all([
        getTenants(),
        getProperties(),
        getInvites(),
      ]);
      setOwnerData({
        key: key,
        tenants: api_tenants.map(fromApiTenant),
        properties: api_properties.map(fromApiProperty),
        invites: api_invites,
        status: 'ready',
        error: '',
      });
    } catch (error) {
      console.log('Could not load tenants', error.message);
      setOwnerData((current) => {
        const has_data = current.key === key && current.status === 'ready';
        if (has_data) {
          return { ...current, error: error.message };
        }
        return quiet && current.key === key
          ? current
          : { ...empty_owner_data, key: key, status: 'error', error: error.message };
      });
    }
  }

  async function loadMe(key) {
    try {
      const api_me = await getMe();
      setMe({
        key: key,
        active: (api_me.activeTenancies || []).map(fromApiTenancy),
        ended: (api_me.endedTenancies || []).map(fromApiTenancy),
        status: 'ready',
      });
    } catch (error) {
      console.log('Could not load your rental', error.message);
      // if it can't be checked I leave the home as it was, the server still blocks writes on its own
      setMe((current) =>
        current.key === key ? current : { ...empty_me, key: key, status: 'error' },
      );
    }
  }

  function reloadForSession(quiet) {
    if (is_real_owner) {
      return loadOwnerData(session_key, quiet);
    }
    if (is_real_tenant) {
      return loadMe(session_key);
    }
    return Promise.resolve();
  }

  // the socket and push callbacks read the newest version from here
  const latest = useRef({ reloadForSession });
  useEffect(() => {
    latest.current = { reloadForSession, owner_data };
  });

  // loads whenever a different account signs in or the mode changes
  useEffect(() => {
    latest.current.reloadForSession(false);
  }, [session_key]);

  // tenancy:updated means something moved, so owners reload their tenants and tenants recheck their rental
  // a socket reconnect might have missed one, and a NO_ACTIVE_TENANCY error means the rental just ended
  useEffect(() => {
    if (mode !== 'real') {
      return undefined;
    }
    const reload = () => latest.current.reloadForSession(true);
    const stop_updated = onSocketEvent('tenancy:updated', reload);
    const stop_connect = onSocketEvent('connect', reload);
    const stop_read_only = api_client.onSessionEvent((event_name) => {
      if (event_name === 'read_only') {
        reload();
      }
    });
    // a tenant's tap goes home (which shows the right screen for their rental), an owner's opens that tenant
    const stop_taps = listenForTenancyTaps((tenancy_id) => {
      reload();
      if (role === 'tenant') {
        navigateWhenReady('TenantHome');
        return;
      }
      const found = (latest.current.owner_data.tenants || []).find((tenant) =>
        [...tenant.active_tenancies, ...tenant.ended_tenancies].some(
          (tenancy) => tenancy.id === tenancy_id,
        ),
      );
      if (found) {
        navigateWhenReady('TenantDetail', { tenantId: found.id });
      } else {
        navigateWhenReady('Tenants');
      }
    });
    return () => {
      stop_updated();
      stop_connect();
      stop_read_only();
      stop_taps();
    };
  }, [mode, role, session_key]);

  // ----- what the screens see -----

  const demo_view = useMemo(
    () =>
      mode === 'demo' && local.demo_tenant_data
        ? buildDemoView(local.demo_tenant_data, local.orders, new Date())
        : null,
    [mode, local.demo_tenant_data, local.orders],
  );

  let view;
  if (demo_view) {
    view = { ...demo_view, status: 'ready', error: '' };
  } else if (is_real_owner && owner_data.key === session_key) {
    view = owner_data;
  } else if (is_real_owner) {
    view = { ...empty_owner_data, status: 'loading' };
  } else {
    view = { ...empty_owner_data, status: 'ready' };
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

  // ----- properties -----

  async function addProperty(name, address) {
    if (mode === 'demo') {
      return runDemo((data) => demoAddProperty(data, { name, address }, makeId)).property;
    }
    const property = fromApiProperty(await createProperty(name, address));
    setOwnerData((current) => ({ ...current, properties: [...current.properties, property] }));
    return property;
  }

  // fields is { name, address }
  async function updateProperty(property_id, fields) {
    if (mode === 'demo') {
      runDemo((data) => demoUpdateProperty(data, property_id, fields));
      return;
    }
    const property = fromApiProperty(await updatePropertyRequest(property_id, fields));
    setOwnerData((current) => ({
      ...current,
      properties: current.properties.map((item) => (item.id === property_id ? property : item)),
    }));
    // tenancies and invites show the property name too, so I reload them quietly
    loadOwnerData(session_key, true);
  }

  async function deleteProperty(property_id) {
    if (mode === 'demo') {
      runDemo((data) => demoDeleteProperty(data, property_id, local.orders, new Date()));
      return;
    }
    await deletePropertyRequest(property_id);
    setOwnerData((current) => ({
      ...current,
      properties: current.properties.filter((item) => item.id !== property_id),
    }));
    // its pending invites got revoked on the server
    loadOwnerData(session_key, true);
  }

  // ----- invites -----

  // fields: property_id, tenant_name, unit_label, gives back the invite in the server's shape
  async function createInvite(fields) {
    if (mode === 'demo') {
      return runDemo((data) => demoCreateInvite(data, fields, new Date(), makeId, makeInviteCode))
        .invite;
    }
    const invite = await createInviteRequest(fields);
    setOwnerData((current) => ({ ...current, invites: [invite, ...current.invites] }));
    return invite;
  }

  async function revokeInvite(invite_id) {
    if (mode === 'demo') {
      return runDemo((data) => demoRevokeInvite(data, invite_id, new Date())).invite;
    }
    const invite = await revokeInviteRequest(invite_id);
    setOwnerData((current) => ({
      ...current,
      invites: current.invites.map((item) => (item.id === invite_id ? invite : item)),
    }));
    return invite;
  }

  // gives back the new invite, the old one is now revoked
  async function resendInvite(invite_id) {
    if (mode === 'demo') {
      return runDemo((data) =>
        demoResendInvite(data, invite_id, new Date(), makeId, makeInviteCode),
      ).invite;
    }
    const result = await resendInviteRequest(invite_id);
    setOwnerData((current) => ({
      ...current,
      invites: [
        result.invite,
        ...current.invites.map((item) => (item.id === invite_id ? result.revoked_invite : item)),
      ],
    }));
    return result.invite;
  }

  // ----- tenancies -----

  async function assignTenant(tenant_id, property_id, unit_label) {
    if (mode === 'demo') {
      runDemo((data) =>
        demoAssign(data, { tenant_id, property_id, unit_label }, new Date(), makeId),
      );
      return;
    }
    await assignTenancy(tenant_id, property_id, unit_label);
    await loadOwnerData(session_key, true);
  }

  // fields: property_id, unit_label, ended_at, move_out_note
  async function moveTenancy(tenancy_id, fields) {
    if (mode === 'demo') {
      runDemo((data) => demoMove(data, tenancy_id, fields, todayString(), new Date(), makeId));
      return;
    }
    await moveTenancyRequest(tenancy_id, fields);
    await loadOwnerData(session_key, true);
  }

  // fields: ended_at, move_out_note
  async function endTenancy(tenancy_id, fields) {
    if (mode === 'demo') {
      runDemo((data) => demoEnd(data, tenancy_id, fields, todayString()));
      return;
    }
    await endTenancyRequest(tenancy_id, fields);
    await loadOwnerData(session_key, true);
  }

  // the detail screen gets the tenant fresh plus their recent work orders
  // the demo has no server, so its work orders come from the local ones with the same name
  async function fetchTenantDetail(tenant_id) {
    if (mode === 'demo') {
      const tenant = view.tenants.find((item) => item.id === tenant_id);
      if (!tenant) {
        return null;
      }
      return {
        tenant: tenant,
        recent_work_orders: local.orders
          .filter((order) => order.tenant === tenant.name)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 10),
      };
    }
    const api_tenant = await getTenant(tenant_id);
    const tenant = fromApiTenant(api_tenant);
    setOwnerData((current) => ({
      ...current,
      tenants: current.tenants.map((item) => (item.id === tenant_id ? tenant : item)),
    }));
    return {
      tenant: tenant,
      recent_work_orders: (api_tenant.recentWorkOrders || []).map(fromApiWorkOrder),
    };
  }

  function getTenantById(tenant_id) {
    return view.tenants.find((tenant) => tenant.id === tenant_id);
  }

  // a tenant with no active rental only gets to read, but only once that's confirmed, so the home doesn't flash
  const me_ready = is_real_tenant && me.key === session_key && me.status === 'ready';
  const is_read_only = me_ready && me.active.length === 0;

  const value = {
    mode,
    role,
    is_demo: mode === 'demo',
    status: view.status,
    error_message: view.error,
    refreshing,
    tenants: view.tenants,
    properties: view.properties,
    invites: view.invites,
    refresh,
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
    // the tenant side
    is_read_only,
    my_active_tenancies: me_ready ? me.active : [],
    my_ended_tenancies: me_ready ? me.ended : [],
    reloadMe: () => (is_real_tenant ? loadMe(session_key) : Promise.resolve()),
  };

  return <TenantsContext.Provider value={value}>{props.children}</TenantsContext.Provider>;
}

// screens call this for tenants, properties, invites, and the tenant's own rental
export function useTenants() {
  return useContext(TenantsContext);
}
