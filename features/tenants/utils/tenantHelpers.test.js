import {
  localDateString,
  addDays,
  placeLabel,
  fromApiTenancy,
  fromApiTenant,
  fromApiProperty,
  splitActivePast,
  sameUnit,
  groupByProperty,
  unitSuggestions,
  checkUnitLabel,
  checkPlace,
  checkEndDate,
  findMoveInChecklist,
} from './tenantHelpers';

const started = new Date(2025, 8, 1, 15, 4).toISOString();
const maple = { id: 'p1', name: 'Maple Court', address: '12 Maple St' };
const birch = { id: 'p2', name: 'Birch House', address: '9 Birch Rd' };

const api_active = {
  id: 't1',
  tenantId: 'u1',
  property: maple,
  unitLabel: 'Unit 2B',
  status: 'active',
  startedAt: started,
  endedAt: null,
  moveOutNote: null,
};

describe('dates and labels', () => {
  test('localDateString and addDays', () => {
    expect(localDateString(started)).toBe('2025-09-01');
    expect(localDateString(null)).toBeNull();
    expect(addDays('2026-10-11', 30)).toBe('2026-11-10');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  test('placeLabel adds the unit only when there is one', () => {
    expect(placeLabel('Maple Court', 'Unit 2B')).toBe('Maple Court, Unit 2B');
    expect(placeLabel('Maple Court', '')).toBe('Maple Court');
  });
});

describe('mapping api shapes', () => {
  test('a tenancy becomes the snake_case shape with a local move-in date', () => {
    expect(fromApiTenancy(api_active)).toEqual({
      id: 't1',
      tenant_id: 'u1',
      property_id: 'p1',
      property_name: 'Maple Court',
      property_address: '12 Maple St',
      unit_label: 'Unit 2B',
      status: 'active',
      started_at: '2025-09-01',
      ended_at: null,
      move_out_note: '',
      // an older api copy with no lease block reads as no lease
      lease: {
        lease_start_on: null,
        lease_end_on: null,
        lease_term: null,
        renewal_notice_days: 60,
        days_remaining: null,
        lease_status: 'none',
        lease_notes: '',
      },
    });
  });

  test('a tenant copy with no moveOutNote key and no unit still maps', () => {
    const { moveOutNote, ...tenant_copy } = api_active;
    const mapped = fromApiTenancy({
      ...tenant_copy,
      unitLabel: null,
      status: 'ended',
      endedAt: '2026-10-31',
    });
    expect(moveOutNote).toBeNull();
    expect(mapped.unit_label).toBe('');
    expect(mapped.ended_at).toBe('2026-10-31');
    expect(mapped.move_out_note).toBe('');
  });

  test('a tenant summary maps tenancies, counts, and the thread', () => {
    const tenant = fromApiTenant({
      id: 'u1',
      name: 'Tara Tenant',
      email: 'tara@example.com',
      isActive: true,
      activeTenancies: [api_active],
      endedTenancies: [],
      openWorkOrderCount: 2,
      conversationId: 'c1',
    });
    expect(tenant.is_active).toBe(true);
    expect(tenant.active_tenancies[0].unit_label).toBe('Unit 2B');
    expect(tenant.open_work_order_count).toBe(2);
    expect(tenant.conversation_id).toBe('c1');
  });

  test('a former tenant with no thread', () => {
    const tenant = fromApiTenant({
      id: 'u2',
      name: 'Fran Former',
      email: 'f@example.com',
      activeTenancies: [],
      endedTenancies: [{ ...api_active, status: 'ended', endedAt: '2026-01-31' }],
      openWorkOrderCount: 0,
      conversationId: null,
    });
    expect(tenant.is_active).toBe(false);
    expect(tenant.ended_tenancies).toHaveLength(1);
    expect(tenant.conversation_id).toBeNull();
  });

  test('a property lists who lives there now', () => {
    const property = fromApiProperty({
      ...maple,
      createdAt: started,
      updatedAt: started,
      tenancies: [
        {
          id: 't1',
          unitLabel: null,
          status: 'active',
          startedAt: started,
          tenant: { id: 'u1', name: 'Tara', email: 'tara@example.com' },
        },
      ],
    });
    expect(property.tenancies).toEqual([
      {
        id: 't1',
        unit_label: '',
        started_at: '2025-09-01',
        tenant_id: 'u1',
        tenant_name: 'Tara',
        tenant_email: 'tara@example.com',
      },
    ]);
  });
});

// small builders for the grouping tests
function tenancy(id, tenant_id, property, unit_label) {
  return {
    id: id,
    tenant_id: tenant_id,
    property_id: property.id,
    property_name: property.name,
    property_address: property.address,
    unit_label: unit_label,
    status: 'active',
    started_at: '2026-01-01',
    ended_at: null,
    move_out_note: '',
  };
}

function tenant(id, name, active) {
  return {
    id: id,
    name: name,
    email: '',
    is_active: active.length > 0,
    active_tenancies: active,
    ended_tenancies: [],
    open_work_order_count: 0,
    conversation_id: null,
  };
}

describe('active and past', () => {
  test('splitActivePast sorts each group by name', () => {
    const tenants = [
      tenant('a', 'Zed', [tenancy('t1', 'a', maple, '1')]),
      tenant('b', 'Ann', []),
      tenant('c', 'Bea', [tenancy('t2', 'c', maple, '2')]),
      tenant('d', 'Al', []),
    ];
    const result = splitActivePast(tenants);
    expect(result.active.map((item) => item.name)).toEqual(['Bea', 'Zed']);
    expect(result.past.map((item) => item.name)).toEqual(['Al', 'Ann']);
  });
});

describe('groupByProperty', () => {
  const tenants = [
    tenant('a', 'Tara', [tenancy('t1', 'a', maple, 'Unit 10')]),
    tenant('b', 'Ann', [tenancy('t2', 'b', maple, 'unit 2 ')]),
    // roommates share a unit, even with the label typed differently
    tenant('c', 'Bo', [tenancy('t3', 'c', maple, 'Unit 2')]),
    // someone renting two places shows up under both
    tenant('d', 'Dee', [tenancy('t4', 'd', birch, ''), tenancy('t5', 'd', maple, 'Unit 10')]),
    tenant('e', 'Former', []),
  ];

  test('one section per property sorted by name, units in number order, rows by name', () => {
    const sections = groupByProperty(tenants, [maple, birch]);
    expect(sections.map((section) => section.property_name)).toEqual([
      'Birch House',
      'Maple Court',
    ]);
    const maple_units = sections[1].units;
    expect(maple_units.map((unit) => unit.unit_label)).toEqual(['unit 2 ', 'Unit 10']);
    expect(maple_units[0].rows.map((row) => row.tenant.name)).toEqual(['Ann', 'Bo']);
    expect(maple_units[1].rows.map((row) => row.tenant.name)).toEqual(['Dee', 'Tara']);
    expect(sections[0].units[0].rows[0].tenancy.id).toBe('t4');
  });

  test('empty properties still show and past tenants are left out', () => {
    const empty = { id: 'p3', name: 'Ash Flats', address: '' };
    const sections = groupByProperty(tenants, [maple, birch, empty]);
    expect(sections[0]).toMatchObject({ property_name: 'Ash Flats', units: [] });
    const names = sections.flatMap((section) =>
      section.units.flatMap((unit) => unit.rows.map((row) => row.tenant.name)),
    );
    expect(names).not.toContain('Former');
  });

  test('a tenancy at a property missing from the list gets its own section', () => {
    const sections = groupByProperty(tenants, []);
    expect(sections.map((section) => section.property_name)).toEqual([
      'Birch House',
      'Maple Court',
    ]);
  });
});

describe('units', () => {
  test('sameUnit ignores case and spaces, and no unit matches no unit', () => {
    expect(sameUnit('Unit 2B', ' unit 2b ')).toBe(true);
    expect(sameUnit('', null)).toBe(true);
    expect(sameUnit('Unit 1', '')).toBe(false);
  });

  test('unitSuggestions merges tenancies and invites without repeats', () => {
    const properties = [
      {
        ...maple,
        tenancies: [{ unit_label: 'Unit 2' }, { unit_label: '' }, { unit_label: 'unit 2' }],
      },
    ];
    const invites = [
      { propertyId: 'p1', unitLabel: 'Unit 10' },
      { propertyId: 'p2', unitLabel: 'Other' },
    ];
    expect(unitSuggestions(properties, invites, 'p1')).toEqual(['Unit 2', 'Unit 10']);
    expect(unitSuggestions(properties, invites, 'p9')).toEqual([]);
  });
});

describe('move and assign checks', () => {
  const tara = tenant('a', 'Tara', [tenancy('t1', 'a', maple, 'Unit 2B')]);

  test('a property is required and the unit has a length limit', () => {
    expect(checkPlace(tara, null, '', null)).toMatch(/Pick a property/);
    expect(checkPlace(tara, 'p2', 'x'.repeat(51), null)).toMatch(/50/);
    expect(checkUnitLabel('Unit 1')).toBeNull();
  });

  test('assign turns away a second tenancy in the same unit but allows another unit', () => {
    expect(checkPlace(tara, 'p1', ' unit 2b', null)).toMatch(/already have an active tenancy/);
    expect(checkPlace(tara, 'p1', 'Unit 3', null)).toBeNull();
    expect(checkPlace(tara, 'p2', '', null)).toBeNull();
  });

  test('moving to the same place is turned away, moving anywhere else is fine', () => {
    const current = tara.active_tenancies[0];
    expect(checkPlace(tara, 'p1', 'Unit 2B', current)).toMatch(/already live there/);
    expect(checkPlace(tara, 'p1', 'Upstairs', current)).toBeNull();
    expect(checkPlace(tara, 'p2', '', current)).toBeNull();
  });

  test('end dates follow the server rules', () => {
    expect(checkEndDate('', '2026-01-01', '2026-10-11')).toMatch(/Pick a move-out date/);
    expect(checkEndDate('2025-12-31', '2026-01-01', '2026-10-11')).toMatch(/before they moved in/);
    expect(checkEndDate('2026-01-01', '2026-01-01', '2026-10-11')).toBeNull();
    expect(checkEndDate('2026-11-10', '2026-01-01', '2026-10-11')).toBeNull();
    expect(checkEndDate('2026-11-11', '2026-01-01', '2026-10-11')).toMatch(/30 days/);
  });
});

describe('findMoveInChecklist', () => {
  const checklists = [
    {
      id: '1',
      type: 'Move-In',
      completed: true,
      tenant: 'Sam Rivera',
      property: '123 Maple St, Unit 2',
      signed_on: '2025-01-01',
    },
    {
      id: '2',
      type: 'Move-In',
      completed: true,
      tenant: 'sam rivera',
      property: '123 Maple St, Unit 2',
      signed_on: '2025-06-01',
    },
    {
      id: '3',
      type: 'Move-In',
      completed: false,
      tenant: 'Sam Rivera',
      property: '123 Maple St, Unit 2',
      signed_on: null,
    },
    {
      id: '4',
      type: 'Move-Out',
      completed: true,
      tenant: 'Sam Rivera',
      property: '123 Maple St, Unit 2',
      signed_on: '2026-01-01',
    },
    {
      id: '5',
      type: 'Move-In',
      completed: true,
      tenant: 'Alex Chen',
      property: '48 Cedar Ave, Upstairs',
      signed_on: '2025-01-01',
    },
  ];

  test('the newest signed move-in for that tenant and place', () => {
    expect(findMoveInChecklist(checklists, '123 Maple St', 'Unit 2', 'Sam Rivera').id).toBe('2');
  });

  test('falls back to the same property when the unit was written differently', () => {
    expect(findMoveInChecklist(checklists, '48 Cedar Ave', '', 'Alex Chen').id).toBe('5');
  });

  test('nothing for another tenant or with no signed move-in', () => {
    expect(findMoveInChecklist(checklists, '123 Maple St', 'Unit 2', 'Jordan Lee')).toBeNull();
    expect(findMoveInChecklist([], '123 Maple St', 'Unit 2', 'Sam Rivera')).toBeNull();
  });
});
