// the one place that says which screens exist and how you get between them
// App.js reads the header titles from here, the tests check it against App.js and the code,
// and the diagram in assignment/navigation is drawn from it, so none of them can drift apart

// where the app opens, App.js picks one of these from the saved session and the mode
export const initial_routes = {
  signed_out: 'Welcome',
  owner: 'Dashboard',
  tenant: 'TenantHome',
  // the demo is an owner without an account, it opens on the same dashboard
  // now the demo picks a side in the chooser, the landlord side opens on the dashboard and the tenant side on the tenant home
  demo_owner: 'Dashboard',
  demo_tenant: 'TenantHome',
};

// the five ways the app can be running: where each one starts and whose edges it follows
// the demo sides follow the same edges as the real roles, App.js only registers that side's screens in the demo
export const situations = {
  signed_out: { start: initial_routes.signed_out, role: null },
  owner: { start: initial_routes.owner, role: 'owner' },
  tenant: { start: initial_routes.tenant, role: 'tenant' },
  demo_owner: { start: initial_routes.demo_owner, role: 'owner' },
  demo_tenant: { start: initial_routes.demo_tenant, role: 'tenant' },
};

// role is who the screen is for: auth (signed out), owner, tenant, or shared (both)
// status is built (real screen) or stub (placeholder for the assignment, real version coming later)
// title_param is a route param whose short form gets added to the header title, like "Work Order #1a2b3c4d"
// params are what the screen reads from route.params, every one is an id
// edges are the ways out: to (screen), param (the id passed, or null), via (button, card, list item, link,
//   header, after submit, or reset when the history gets cleared), label (what you tap),
//   and roles when only owners or only tenants see it
// future marks screens that should become a tab or a drawer item once the app moves past a plain stack
// reachable_in lists the situations (above) that can open the screen without logging in, out, or leaving the demo,
//   the tests check it against the edges
// demo: true on an edge means only the demo has it (starting a demo side, or switching sides from the demo banner)
export const navigation_map = {
  // ----- signed out -----
  Welcome: {
    title: 'Welcome to Rent Well',
    role: 'auth',
    reachable_in: ['signed_out'],
    feature: 'home',
    file: 'features/home/screens/WelcomeScreen.js',
    status: 'built',
    params: [],
    edges: [
      { to: 'Login', param: null, via: 'button', label: 'Login' },
      { to: 'RegisterOwner', param: null, via: 'button', label: 'Sign Up' },
      { to: 'DemoChooser', param: null, via: 'button', label: 'Try the Demo' },
    ],
    future: [],
  },
  DemoChooser: {
    title: 'Pick a Demo Role',
    role: 'auth',
    reachable_in: ['signed_out'],
    feature: 'home',
    file: 'features/home/screens/DemoChooserScreen.js',
    status: 'built',
    params: [],
    // each card starts the demo on that side, which rebuilds the stack on its home
    edges: [
      { to: 'Dashboard', param: null, via: 'reset', label: 'Demo as Landlord', demo: true },
      { to: 'TenantHome', param: null, via: 'reset', label: 'Demo as Tenant', demo: true },
    ],
    future: [],
  },
  Login: {
    title: 'Log In to Rent Well',
    role: 'auth',
    reachable_in: ['signed_out'],
    feature: 'auth',
    file: 'features/auth/screens/LoginScreen.js',
    status: 'built',
    params: [],
    edges: [
      { to: 'Dashboard', param: null, via: 'reset', label: 'Log In (owner)' },
      { to: 'TenantHome', param: null, via: 'reset', label: 'Log In (tenant)' },
      { to: 'RegisterOwner', param: null, via: 'link', label: 'New landlord?' },
      { to: 'RegisterTenant', param: null, via: 'link', label: 'I have an invite code' },
    ],
    future: [],
  },
  RegisterOwner: {
    title: 'Landlord Sign Up',
    role: 'auth',
    reachable_in: ['signed_out'],
    feature: 'auth',
    file: 'features/auth/screens/RegisterOwnerScreen.js',
    status: 'built',
    params: [],
    edges: [
      { to: 'Dashboard', param: null, via: 'reset', label: 'Create Account' },
      { to: 'RegisterTenant', param: null, via: 'link', label: 'Renting?' },
      { to: 'Login', param: null, via: 'link', label: 'Log in instead' },
    ],
    future: [],
  },
  RegisterTenant: {
    title: 'Tenant Sign Up',
    role: 'auth',
    reachable_in: ['signed_out'],
    feature: 'auth',
    file: 'features/auth/screens/RegisterTenantScreen.js',
    status: 'built',
    params: [],
    edges: [
      { to: 'TenantHome', param: null, via: 'reset', label: 'Join' },
      { to: 'Login', param: null, via: 'link', label: 'Log in instead' },
    ],
    future: [],
  },

  // ----- owner -----
  Dashboard: {
    title: 'Landlord Dashboard',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'home',
    file: 'features/home/screens/DashboardScreen.js',
    status: 'built',
    params: [],
    edges: [
      { to: 'Settings', param: null, via: 'header', label: 'Settings gear' },
      { to: 'WorkOrders', param: null, via: 'button', label: 'Work Orders' },
      { to: 'NewWorkOrder', param: null, via: 'button', label: 'New Work Order (demo)' },
      { to: 'Messages', param: null, via: 'button', label: 'Messages' },
      { to: 'Tenants', param: null, via: 'button', label: 'Tenants' },
      { to: 'Payments', param: null, via: 'button', label: 'Payments and Rent' },
      { to: 'Documents', param: null, via: 'button', label: 'Documents' },
      { to: 'Checklist', param: null, via: 'button', label: 'Checklist' },
      { to: 'Expenses', param: null, via: 'button', label: 'Expenses' },
      { to: 'Welcome', param: null, via: 'reset', label: 'Log Out or Exit Demo' },
      // the demo banner's switch, it keeps the demo data and starts the stack over on the tenant home
      {
        to: 'TenantHome',
        param: null,
        via: 'reset',
        label: 'Switch to Tenant view',
        demo: true,
      },
    ],
    future: [{ role: 'owner', kind: 'tab' }],
  },
  WorkOrders: {
    title: 'All Work Orders',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'workOrders',
    file: 'features/workOrders/screens/WorkOrdersScreen.js',
    status: 'built',
    // both are optional filters: from a tenant's detail or a property's detail
    params: ['tenantId', 'propertyId'],
    edges: [
      { to: 'NewWorkOrder', param: null, via: 'header', label: 'Add' },
      { to: 'WorkOrderDetail', param: 'workOrderId', via: 'card', label: 'Details' },
      { to: 'MessageThread', param: 'conversationId', via: 'card', label: 'Message' },
    ],
    future: [{ role: 'owner', kind: 'tab' }],
  },
  WorkOrderDetail: {
    title: 'Work Order',
    title_param: 'workOrderId',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'workOrders',
    file: 'features/workOrders/screens/WorkOrderDetailScreen.js',
    status: 'built',
    params: ['workOrderId'],
    edges: [
      { to: 'MessageThread', param: 'conversationId', via: 'button', label: 'Message Tenant' },
    ],
    future: [],
  },
  Tenants: {
    title: 'Your Tenants',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'tenants',
    file: 'features/tenants/screens/TenantsScreen.js',
    status: 'built',
    // optional filter from a property's detail
    params: ['propertyId'],
    edges: [
      { to: 'InviteTenant', param: null, via: 'header', label: 'Invite' },
      { to: 'Properties', param: null, via: 'button', label: 'Properties' },
      { to: 'TenantDetail', param: 'tenantId', via: 'list item', label: 'a tenant' },
    ],
    future: [{ role: 'owner', kind: 'tab' }],
  },
  TenantDetail: {
    title: 'Tenant Profile',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'tenants',
    file: 'features/tenants/screens/TenantDetailScreen.js',
    status: 'built',
    params: ['tenantId'],
    edges: [
      { to: 'MessageThread', param: 'conversationId', via: 'button', label: 'Message' },
      { to: 'PropertyDetail', param: 'propertyId', via: 'link', label: 'their property' },
      { to: 'TenantLedger', param: 'tenancyId', via: 'link', label: 'Rent Ledger' },
      { to: 'TenantLease', param: 'tenantId', via: 'button', label: 'Lease and Documents' },
      { to: 'WorkOrders', param: 'tenantId', via: 'link', label: 'View in Work Orders' },
      { to: 'ChecklistDetail', param: 'checklistId', via: 'after submit', label: 'End Tenancy' },
    ],
    future: [],
  },
  TenantLease: {
    title: 'Lease and Documents',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'tenants',
    file: 'features/tenants/screens/TenantLeaseScreen.js',
    status: 'stub',
    params: ['tenantId'],
    edges: [{ to: 'Documents', param: null, via: 'button', label: 'Open Documents' }],
    future: [],
  },
  Properties: {
    title: 'Your Properties',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'tenants',
    file: 'features/tenants/screens/PropertiesScreen.js',
    status: 'built',
    params: [],
    edges: [{ to: 'PropertyDetail', param: 'propertyId', via: 'list item', label: 'a property' }],
    future: [{ role: 'owner', kind: 'drawer' }],
  },
  PropertyDetail: {
    title: 'Property Overview',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'tenants',
    file: 'features/tenants/screens/PropertyDetailScreen.js',
    status: 'stub',
    params: ['propertyId'],
    edges: [
      { to: 'Tenants', param: 'propertyId', via: 'button', label: 'Tenants here' },
      { to: 'WorkOrders', param: 'propertyId', via: 'button', label: 'Work orders here' },
    ],
    future: [],
  },
  InviteTenant: {
    title: 'Invite a New Tenant',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'invites',
    file: 'features/invites/screens/InviteTenantScreen.js',
    status: 'built',
    params: [],
    edges: [],
    future: [],
  },
  Documents: {
    title: 'Document Storage',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'documents',
    file: 'features/documents/screens/DocumentsScreen.js',
    status: 'built',
    params: [],
    edges: [],
    future: [{ role: 'owner', kind: 'drawer' }],
  },
  Checklist: {
    title: 'Condition Checklists',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'checklist',
    file: 'features/checklist/screens/ChecklistScreen.js',
    status: 'built',
    params: [],
    edges: [
      {
        to: 'ChecklistDetail',
        param: 'checklistId',
        via: 'list item',
        label: 'a checklist or New',
      },
    ],
    future: [{ role: 'owner', kind: 'drawer' }],
  },
  ChecklistDetail: {
    title: 'Checklist',
    title_param: 'checklistId',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'checklist',
    file: 'features/checklist/screens/ChecklistDetailScreen.js',
    status: 'built',
    params: ['checklistId'],
    // starting a move-out from a signed move-in opens a second detail screen on top
    edges: [
      { to: 'ChecklistDetail', param: 'checklistId', via: 'button', label: 'Start Move-Out' },
    ],
    future: [],
  },
  Expenses: {
    title: 'Property Expenses',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'expenses',
    file: 'features/expenses/screens/ExpensesScreen.js',
    status: 'built',
    params: [],
    edges: [
      { to: 'Mileage', param: null, via: 'button', label: 'Mileage' },
      { to: 'YearEndReport', param: 'yearId', via: 'button', label: 'Year-End Report' },
      { to: 'WorkOrderDetail', param: 'workOrderId', via: 'link', label: 'linked work order' },
    ],
    future: [{ role: 'owner', kind: 'drawer' }],
  },
  Mileage: {
    title: 'Mileage Log',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'mileage',
    file: 'features/mileage/screens/MileageScreen.js',
    status: 'built',
    params: [],
    edges: [],
    future: [],
  },
  YearEndReport: {
    title: 'Year-End Tax Report',
    title_param: 'yearId',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'expenses',
    file: 'features/expenses/screens/YearEndReportScreen.js',
    status: 'built',
    // the tax year is what identifies a year-end report
    params: ['yearId'],
    edges: [],
    future: [],
  },

  // ----- tenant -----
  TenantHome: {
    title: 'My Home',
    role: 'tenant',
    reachable_in: ['tenant', 'demo_tenant'],
    feature: 'home',
    file: 'features/home/screens/TenantHomeScreen.js',
    status: 'built',
    params: [],
    edges: [
      { to: 'Settings', param: null, via: 'header', label: 'Settings gear' },
      { to: 'Messages', param: null, via: 'card', label: 'Messages' },
      { to: 'MyRequests', param: null, via: 'card', label: 'My Requests' },
      { to: 'NewWorkOrder', param: null, via: 'card', label: 'Report an Issue' },
      { to: 'Payments', param: null, via: 'card', label: 'Payments and Rent' },
      { to: 'PastRequests', param: null, via: 'card', label: 'Past Requests (no rental)' },
      { to: 'Welcome', param: null, via: 'reset', label: 'Log Out or Exit Demo' },
      {
        to: 'Dashboard',
        param: null,
        via: 'reset',
        label: 'Switch to Landlord view',
        demo: true,
      },
    ],
    future: [{ role: 'tenant', kind: 'tab' }],
  },
  MyRequests: {
    title: 'My Repair Requests',
    role: 'tenant',
    reachable_in: ['tenant', 'demo_tenant'],
    feature: 'workOrders',
    file: 'features/workOrders/screens/MyRequestsScreen.js',
    status: 'built',
    params: [],
    edges: [
      { to: 'NewWorkOrder', param: null, via: 'header', label: 'Add' },
      { to: 'RequestDetail', param: 'workOrderId', via: 'list item', label: 'a request' },
    ],
    future: [{ role: 'tenant', kind: 'tab' }],
  },
  RequestDetail: {
    title: 'Request',
    title_param: 'workOrderId',
    role: 'tenant',
    reachable_in: ['tenant', 'demo_tenant'],
    feature: 'workOrders',
    file: 'features/workOrders/screens/RequestDetailScreen.js',
    status: 'built',
    params: ['workOrderId'],
    edges: [],
    future: [],
  },
  PastRequests: {
    title: 'Past Repair Requests',
    role: 'tenant',
    reachable_in: ['tenant', 'demo_tenant'],
    feature: 'tenants',
    file: 'features/tenants/screens/PastRequestsScreen.js',
    status: 'built',
    params: [],
    edges: [],
    future: [],
  },

  // ----- shared by owners and tenants -----
  NewWorkOrder: {
    // owners add work orders here and tenants report issues, so the header says it plainly for both
    title: 'Add a Work Order',
    role: 'shared',
    reachable_in: ['owner', 'tenant', 'demo_owner', 'demo_tenant'],
    feature: 'workOrders',
    file: 'features/workOrders/screens/NewWorkOrderScreen.js',
    status: 'built',
    params: [],
    edges: [
      {
        to: 'MyRequests',
        param: null,
        via: 'after submit',
        label: 'Submit Request',
        roles: ['tenant'],
      },
    ],
    future: [],
  },
  Messages: {
    title: 'Message Inbox',
    role: 'shared',
    reachable_in: ['owner', 'tenant', 'demo_owner', 'demo_tenant'],
    feature: 'messages',
    file: 'features/messages/screens/MessagesScreen.js',
    status: 'built',
    params: [],
    edges: [
      { to: 'InviteTenant', param: null, via: 'header', label: 'Invite', roles: ['owner'] },
      { to: 'MessageThread', param: 'conversationId', via: 'list item', label: 'a conversation' },
    ],
    future: [
      { role: 'owner', kind: 'tab' },
      { role: 'tenant', kind: 'tab' },
    ],
  },
  MessageThread: {
    title: 'Conversation',
    role: 'shared',
    reachable_in: ['owner', 'tenant', 'demo_owner', 'demo_tenant'],
    feature: 'messages',
    file: 'features/messages/screens/MessageThreadScreen.js',
    status: 'built',
    params: ['conversationId'],
    edges: [],
    future: [],
  },
  Payments: {
    title: 'Payments and Rent',
    role: 'shared',
    reachable_in: ['owner', 'tenant', 'demo_owner', 'demo_tenant'],
    feature: 'payments',
    file: 'features/payments/screens/PaymentsScreen.js',
    status: 'stub',
    params: [],
    edges: [
      { to: 'PaymentDetail', param: 'paymentId', via: 'list item', label: 'a payment' },
      {
        to: 'TenantLedger',
        param: 'tenancyId',
        via: 'list item',
        label: 'a tenant',
        roles: ['owner'],
      },
    ],
    future: [],
  },
  TenantLedger: {
    title: 'Rent Ledger',
    role: 'owner',
    reachable_in: ['owner', 'demo_owner'],
    feature: 'payments',
    file: 'features/payments/screens/TenantLedgerScreen.js',
    status: 'built',
    params: ['tenancyId'],
    edges: [{ to: 'PaymentDetail', param: 'paymentId', via: 'list item', label: 'a payment' }],
    future: [],
  },
  PaymentDetail: {
    title: 'Payment Record',
    title_param: 'paymentId',
    role: 'shared',
    reachable_in: ['owner', 'tenant', 'demo_owner', 'demo_tenant'],
    feature: 'payments',
    file: 'features/payments/screens/PaymentDetailScreen.js',
    status: 'built',
    params: ['paymentId'],
    edges: [
      {
        to: 'TenantLedger',
        param: 'tenancyId',
        via: 'button',
        label: 'Open their ledger',
        roles: ['owner'],
      },
    ],
    future: [],
  },
  Settings: {
    title: 'Settings and Profile',
    role: 'shared',
    reachable_in: ['owner', 'tenant', 'demo_owner', 'demo_tenant'],
    feature: 'settings',
    file: 'features/settings/screens/SettingsScreen.js',
    status: 'stub',
    params: [],
    edges: [
      { to: 'Mileage', param: null, via: 'button', label: 'Mileage rate', roles: ['owner'] },
      { to: 'Welcome', param: null, via: 'reset', label: 'Log Out' },
    ],
    future: [{ role: 'owner', kind: 'drawer' }],
  },
};

// "1a2b3c4d" from a long id, short ids (like the demo's "1") stay as they are
export function shortId(id) {
  const text = String(id);
  return text.length > 8 ? text.slice(0, 8) : text;
}

// the header title for a screen, with the short id added when the title depends on a param
export function headerTitle(route_name, params) {
  const screen = navigation_map[route_name];
  if (!screen) {
    return route_name;
  }
  const value = screen.title_param && params ? params[screen.title_param] : null;
  return value ? screen.title + ' #' + shortId(value) : screen.title;
}

// the screens one situation can open without logging in or out (or leaving the demo), from its start
export function reachableIn(situation_name) {
  const situation = situations[situation_name];
  return reachableFrom(situation.start, { skip_resets: true, role: situation.role });
}

// every screen reachable from a start by following edges
// skip_resets leaves out the reset edges (log in, log out), so a signed-in role stays inside its own screens
// role keeps only the edges that role sees
export function reachableFrom(start, options) {
  const settings = options || {};
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    const screen = navigation_map[current];
    (screen ? screen.edges : []).forEach((edge) => {
      if (settings.skip_resets && edge.via === 'reset') {
        return;
      }
      if (settings.role && edge.roles && !edge.roles.includes(settings.role)) {
        return;
      }
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
    });
  }
  return seen;
}
