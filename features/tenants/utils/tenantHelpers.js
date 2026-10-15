// pure helpers for tenants, properties, and tenancies, nothing here touches the network so they're easy to test
// the screens use snake_case shapes, these turn the api's camelCase into them and back the demo up with the same rules

function twoDigits(number) {
  return String(number).padStart(2, '0');
}

// startedAt is a full timestamp, the app shows the move-in day on the phone's own calendar
export function localDateString(iso) {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return (
    date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate())
  );
}

// adds days to a YYYY-MM-DD date, done at noon so daylight saving can't push it into the wrong day
export function addDays(date_string, days) {
  const parts = date_string.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2] + days, 12);
  return (
    date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate())
  );
}

// "Maple Court, Unit 2B", or just the property name when there's no unit, same as the work orders and checklists
export function placeLabel(property_name, unit_label) {
  return unit_label ? property_name + ', ' + unit_label : property_name;
}

// ----- mapping the api shapes -----

// endedAt is already a plain date, and moveOutNote is missing from tenant copies
export function fromApiTenancy(api_tenancy) {
  return {
    id: api_tenancy.id,
    tenant_id: api_tenancy.tenantId,
    property_id: api_tenancy.property ? api_tenancy.property.id : null,
    property_name: api_tenancy.property ? api_tenancy.property.name : '',
    property_address: api_tenancy.property ? api_tenancy.property.address : '',
    unit_label: api_tenancy.unitLabel || '',
    status: api_tenancy.status,
    started_at: localDateString(api_tenancy.startedAt),
    ended_at: api_tenancy.endedAt || null,
    move_out_note: api_tenancy.moveOutNote || '',
  };
}

export function fromApiTenant(api_tenant) {
  const active = (api_tenant.activeTenancies || []).map(fromApiTenancy);
  return {
    id: api_tenant.id,
    name: api_tenant.name || '',
    email: api_tenant.email || '',
    is_active: active.length > 0,
    active_tenancies: active,
    ended_tenancies: (api_tenant.endedTenancies || []).map(fromApiTenancy),
    open_work_order_count: api_tenant.openWorkOrderCount || 0,
    conversation_id: api_tenant.conversationId || null,
  };
}

// a property only lists who lives there now, past residents are on the tenants
export function fromApiProperty(api_property) {
  return {
    id: api_property.id,
    name: api_property.name,
    address: api_property.address,
    // how tenants should pay, and the time zone that decides "today" for this property's ledgers
    payment_instructions: api_property.paymentInstructions || '',
    time_zone: api_property.timeZone || 'UTC',
    tenancies: (api_property.tenancies || []).map((tenancy) => ({
      id: tenancy.id,
      unit_label: tenancy.unitLabel || '',
      started_at: localDateString(tenancy.startedAt),
      tenant_id: tenancy.tenant ? tenancy.tenant.id : null,
      tenant_name: tenancy.tenant ? tenancy.tenant.name : '',
      tenant_email: tenancy.tenant ? tenancy.tenant.email : '',
    })),
  };
}

// ----- grouping for the tenants screen -----

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

// current tenants and former ones, each sorted by name like the server sends them
export function splitActivePast(tenants) {
  return {
    active: tenants.filter((tenant) => tenant.is_active).sort(byName),
    past: tenants.filter((tenant) => !tenant.is_active).sort(byName),
  };
}

// unit labels count as the same no matter the case or extra spaces, and no unit is its own unit
export function sameUnit(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

// one section per property, one group per unit, each row is a tenant with the tenancy that puts them there
// properties with nobody living there still show up so the owner sees the empty ones
// a tenant renting two places shows up under both, and roommates share a unit group
export function groupByProperty(tenants, properties) {
  const sections = new Map();
  properties.forEach((property) => {
    sections.set(property.id, {
      property_id: property.id,
      property_name: property.name,
      property_address: property.address,
      units: [],
    });
  });

  tenants.forEach((tenant) => {
    tenant.active_tenancies.forEach((tenancy) => {
      if (!sections.has(tenancy.property_id)) {
        sections.set(tenancy.property_id, {
          property_id: tenancy.property_id,
          property_name: tenancy.property_name,
          property_address: tenancy.property_address,
          units: [],
        });
      }
      const section = sections.get(tenancy.property_id);
      let unit = section.units.find((item) => sameUnit(item.unit_label, tenancy.unit_label));
      if (!unit) {
        unit = { unit_label: tenancy.unit_label, rows: [] };
        section.units.push(unit);
      }
      unit.rows.push({ tenant: tenant, tenancy: tenancy });
    });
  });

  // numeric compare so Unit 2 comes before Unit 10, and no unit comes first
  return [...sections.values()]
    .map((section) => ({
      ...section,
      units: section.units
        .map((unit) => ({ ...unit, rows: unit.rows.sort((a, b) => byName(a.tenant, b.tenant)) }))
        .sort((a, b) => a.unit_label.localeCompare(b.unit_label, undefined, { numeric: true })),
    }))
    .sort((a, b) => a.property_name.localeCompare(b.property_name));
}

// unit labels already in use at a property, offered as quick picks in the move and assign form
export function unitSuggestions(properties, invites, property_id) {
  const labels = [];
  const property = properties.find((item) => item.id === property_id);
  if (property) {
    property.tenancies.forEach((tenancy) => labels.push(tenancy.unit_label));
  }
  invites
    .filter((invite) => invite.propertyId === property_id)
    .forEach((invite) => labels.push(invite.unitLabel || ''));
  const unique = [];
  labels
    .filter((label) => label && label.trim() !== '')
    .forEach((label) => {
      if (!unique.some((item) => sameUnit(item, label))) {
        unique.push(label.trim());
      }
    });
  return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// ----- checks before move, assign, and end -----

export function checkUnitLabel(unit_label) {
  return unit_label.trim().length > 50 ? 'Keep the unit under 50 characters.' : null;
}

// the same rules the server uses, so most problems show up before the request
// moving_tenancy is the tenancy being moved (null for assign), it doesn't count as a duplicate of itself
// gives back an error message, or null when it's fine
export function checkPlace(tenant, property_id, unit_label, moving_tenancy) {
  if (!property_id) {
    return 'Pick a property.';
  }
  const unit_error = checkUnitLabel(unit_label || '');
  if (unit_error) {
    return unit_error;
  }
  if (
    moving_tenancy &&
    moving_tenancy.property_id === property_id &&
    sameUnit(moving_tenancy.unit_label, unit_label)
  ) {
    return 'They already live there. Pick a different property or unit.';
  }
  const duplicate = tenant.active_tenancies.some(
    (tenancy) =>
      (!moving_tenancy || tenancy.id !== moving_tenancy.id) &&
      tenancy.property_id === property_id &&
      sameUnit(tenancy.unit_label, unit_label),
  );
  return duplicate ? 'They already have an active tenancy in that unit.' : null;
}

// the move-out day can't be before they moved in or more than 30 days from today
export function checkEndDate(ended_at, started_at, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ended_at || '')) {
    return 'Pick a move-out date.';
  }
  if (started_at && ended_at < started_at) {
    return "The move-out date can't be before they moved in (" + started_at + ').';
  }
  if (ended_at > addDays(today, 30)) {
    return 'The move-out date can be at most 30 days from today.';
  }
  return null;
}

// ----- the move-out checklist after a tenancy ends -----

function sameText(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

// the newest signed move-in for this tenant at this place, so the move-out can compare against it
// it falls back to the same tenant at the same property when the unit was written differently
export function findMoveInChecklist(checklists, property_name, unit_label, tenant_name) {
  const label = placeLabel(property_name, unit_label);
  const signed = checklists
    .filter(
      (checklist) =>
        checklist.type === 'Move-In' &&
        checklist.completed &&
        sameText(checklist.tenant, tenant_name),
    )
    .sort((a, b) => (b.signed_on || '').localeCompare(a.signed_on || ''));
  return (
    signed.find((checklist) => sameText(checklist.property, label)) ||
    signed.find((checklist) =>
      checklist.property.trim().toLowerCase().startsWith(property_name.trim().toLowerCase()),
    ) ||
    null
  );
}
