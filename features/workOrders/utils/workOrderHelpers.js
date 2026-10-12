// pure helpers for work orders from the api, nothing here touches the network so they're easy to test

export const max_photos_per_order = 10;
export const max_photos_per_upload = 5;

function twoDigits(number) {
  return String(number).padStart(2, '0');
}

// the api sends full timestamps in UTC, the app shows YYYY-MM-DD on the phone's own calendar
export function localDateString(iso) {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return (
    date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate())
  );
}

// the local orders use one property text, so I build it from the property name and the unit
export function propertyLabel(api_order) {
  const name = api_order.property ? api_order.property.name : '';
  return api_order.unitLabel ? name + ', ' + api_order.unitLabel : name;
}

// turns the api's work order into the shape the screens already use, so they work the same in both modes
// tenant copies have no contractor or estimate keys, those fall back to empty
export function fromApiWorkOrder(api_order) {
  return {
    id: api_order.id,
    title: api_order.title,
    description: api_order.description || '',
    property: propertyLabel(api_order),
    property_id: api_order.property ? api_order.property.id : null,
    property_name: api_order.property ? api_order.property.name : '',
    property_address: api_order.property ? api_order.property.address : '',
    unit_label: api_order.unitLabel || '',
    tenant: api_order.tenantName || '',
    tenant_id: api_order.tenant ? api_order.tenant.id : null,
    status: api_order.status,
    priority: api_order.priority || 'Normal',
    created_at: localDateString(api_order.createdAt),
    started_at: localDateString(api_order.startedAt),
    resolved_at: localDateString(api_order.resolvedAt),
    // the full time is kept too, so two orders from the same day still sort the right way
    created_at_iso: api_order.createdAt,
    notes: api_order.ownerNotes || '',
    contractor: api_order.contractor || '',
    estimate:
      api_order.estimate === undefined || api_order.estimate === null ? null : api_order.estimate,
    // the local orders had one photo object, api orders have a list of upload keys instead
    photo: null,
    photos: (api_order.photos || []).map((photo) => photo.key),
    reported_by_tenant: !!api_order.createdBy && api_order.createdBy !== api_order.ownerId,
  };
}

function newestFirst(a, b) {
  const by_time = (b.created_at_iso || '').localeCompare(a.created_at_iso || '');
  return by_time || (b.id < a.id ? -1 : b.id > a.id ? 1 : 0);
}

// adds or replaces orders by id (the incoming copy wins, since socket events carry the whole order)
export function mergeWorkOrders(existing, incoming) {
  const by_id = new Map();
  existing.forEach((order) => by_id.set(order.id, order));
  incoming.forEach((order) => by_id.set(order.id, order));
  return [...by_id.values()].sort(newestFirst);
}

export function replaceWorkOrder(orders, updated) {
  return orders.map((order) => (order.id === updated.id ? updated : order));
}

// the same moves the server makes, so the screen can show the change right away before the server answers
// Resolved always ends up with both dates, and going back clears the dates that no longer apply
export function applyStatus(order, new_status, today) {
  if (order.status === new_status) {
    return order;
  }
  if (new_status === 'Open') {
    return { ...order, status: 'Open', started_at: null, resolved_at: null };
  }
  if (new_status === 'In Progress') {
    return {
      ...order,
      status: 'In Progress',
      started_at: order.status === 'Open' ? today : order.started_at || today,
      resolved_at: null,
    };
  }
  return {
    ...order,
    status: 'Resolved',
    started_at: order.started_at || today,
    resolved_at: today,
  };
}

// tenants can only add photos while nobody has started, and an order holds 10 at most
export function canTenantAddPhotos(order) {
  return order.status === 'Open' && (order.photos || []).length < max_photos_per_order;
}

// how many more fit in one upload, it's 5 at a time and 10 in total
export function photosLeft(order) {
  const used = order ? (order.photos || []).length : 0;
  return Math.max(0, Math.min(max_photos_per_upload, max_photos_per_order - used));
}

// open means nobody has started on it yet, it's what the dashboard badge counts
export function openCount(orders) {
  return orders.filter((order) => order.status === 'Open').length;
}

export function activeCount(orders) {
  return orders.filter((order) => order.status !== 'Resolved').length;
}

// expenses stay on the phone for now, this builds the small order.expenses list the work order screens read
export function legacyExpensesFor(expenses, order_id) {
  return expenses
    .filter((expense) => expense.work_order_id === order_id)
    .map((expense) => ({
      id: expense.id,
      amount: expense.amount,
      description: expense.notes || expense.vendor,
      photo_uri: expense.receipts && expense.receipts.length > 0 ? expense.receipts[0] : null,
    }));
}
