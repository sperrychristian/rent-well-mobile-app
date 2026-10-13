import {
  inviteStatus,
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
} from './demoTenants';
import { buildSampleTenantData } from '../data/sampleTenants';

const now = new Date('2026-10-11T18:00:00.000Z');
const today = '2026-10-11';

// counts up so the tests know every new id ahead of time
function idMaker() {
  let count = 0;
  return () => {
    count++;
    return 'new-' + count;
  };
}

const no_orders = [];

describe('the sample data', () => {
  test('has active tenants, a past tenant, and a pending invite', () => {
    const view = buildDemoView(buildSampleTenantData(), no_orders, new Date());
    expect(view.tenants.filter((tenant) => tenant.is_active)).toHaveLength(4);
    const morgan = view.tenants.find((tenant) => tenant.name === 'Morgan Diaz');
    expect(morgan.is_active).toBe(false);
    expect(morgan.ended_tenancies[0].move_out_note).toBe('Deposit returned in full');
    expect(view.invites[0].status).toBe('pending');
    expect(view.properties.map((property) => property.name)).toEqual([
      '123 Maple St',
      '48 Cedar Ave',
    ]);
  });

  test('open work orders are counted by tenant name, resolved ones left out', () => {
    const orders = [
      { tenant: 'Sam Rivera', status: 'Open', property: '123 Maple St, Unit 2' },
      { tenant: 'Sam Rivera', status: 'Resolved', property: '123 Maple St, Unit 2' },
    ];
    const view = buildDemoView(buildSampleTenantData(), orders, new Date());
    expect(view.tenants.find((tenant) => tenant.name === 'Sam Rivera').open_work_order_count).toBe(
      1,
    );
  });
});

describe('invite status', () => {
  const invite = { usedAt: null, revokedAt: null, expiresAt: '2026-10-12T00:00:00.000Z' };
  test('used, revoked, expired, then pending, in that order', () => {
    expect(inviteStatus({ ...invite, usedAt: 'x', revokedAt: 'y' }, now)).toBe('used');
    expect(inviteStatus({ ...invite, revokedAt: 'y' }, now)).toBe('revoked');
    expect(inviteStatus({ ...invite, expiresAt: '2026-10-11T00:00:00.000Z' }, now)).toBe('expired');
    expect(inviteStatus(invite, now)).toBe('pending');
  });

  test('makeInviteCode uses only the 8 allowed characters', () => {
    expect(makeInviteCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });
});

describe('properties', () => {
  test('add and edit', () => {
    const added = demoAddProperty(
      buildSampleTenantData(),
      { name: 'Ash', address: '1 Ash' },
      idMaker(),
    );
    expect(added.property.id).toBe('new-1');
    const edited = demoUpdateProperty(added.data, 'new-1', { name: 'Ash Flats' });
    expect(edited.properties.find((item) => item.id === 'new-1').name).toBe('Ash Flats');
  });

  test('delete is blocked by active tenants first, then by open work orders', () => {
    const data = buildSampleTenantData();
    expect(() => demoDeleteProperty(data, 'demo-prop-maple', [], now)).toThrow(
      expect.objectContaining({ code: 'PROPERTY_HAS_ACTIVE_TENANCY' }),
    );
    const empty_cedar = demoEnd(data, 'demo-tenancy-alex', {}, today).data;
    const orders = [{ property: '48 Cedar Ave', status: 'Open' }];
    expect(() => demoDeleteProperty(empty_cedar, 'demo-prop-cedar', orders, now)).toThrow(
      expect.objectContaining({ code: 'PROPERTY_HAS_OPEN_WORK_ORDERS' }),
    );
  });

  test('a deleted property disappears, its history stays, and its pending invites get revoked', () => {
    let data = buildSampleTenantData();
    ['demo-tenancy-sam', 'demo-tenancy-jordan', 'demo-tenancy-priya'].forEach((id) => {
      data = demoEnd(data, id, {}, today).data;
    });
    const deleted = demoDeleteProperty(data, 'demo-prop-maple', [], now);
    const view = buildDemoView(deleted, no_orders, now);
    expect(view.properties.map((property) => property.name)).toEqual(['48 Cedar Ave']);
    const sam = view.tenants.find((tenant) => tenant.name === 'Sam Rivera');
    expect(sam.ended_tenancies[0].property_name).toBe('123 Maple St');
    expect(view.invites[0].status).toBe('revoked');
  });

  test('a missing or deleted property is not found', () => {
    expect(() => demoUpdateProperty(buildSampleTenantData(), 'nope', { name: 'x' })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });
});

describe('invites', () => {
  test('create, revoke (keeping the first time), and resend with a new code', () => {
    const make_id = idMaker();
    const created = demoCreateInvite(
      buildSampleTenantData(),
      { property_id: 'demo-prop-cedar', tenant_name: 'Kim', unit_label: '' },
      now,
      make_id,
      () => 'AAAA2222',
    );
    expect(created.invite).toMatchObject({ code: 'AAAA2222', unitLabel: null, status: 'pending' });

    const revoked = demoRevokeInvite(created.data, created.invite.id, now);
    expect(revoked.invite.status).toBe('revoked');
    const again = demoRevokeInvite(revoked.data, created.invite.id, new Date('2027-01-01'));
    expect(again.invite.revokedAt).toBe(revoked.invite.revokedAt);

    const resent = demoResendInvite(
      created.data,
      created.invite.id,
      now,
      make_id,
      () => 'BBBB3333',
    );
    expect(resent.invite.code).toBe('BBBB3333');
    expect(resent.invite.tenantName).toBe('Kim');
    expect(resent.revoked_invite.status).toBe('revoked');
    expect(buildDemoView(resent.data, no_orders, now).invites[0].code).toBe('BBBB3333');
  });

  test('a used invite cannot be revoked or resent', () => {
    const data = buildSampleTenantData();
    data.invites[0] = { ...data.invites[0], usedAt: now.toISOString() };
    expect(() => demoRevokeInvite(data, 'demo-invite-1', now)).toThrow(
      expect.objectContaining({ code: 'INVITE_USED' }),
    );
  });
});

describe('tenancies', () => {
  test('assign a former tenant, roommates are fine but a duplicate is not', () => {
    const data = buildSampleTenantData();
    const assigned = demoAssign(
      data,
      { tenant_id: 'demo-tenant-morgan', property_id: 'demo-prop-maple', unit_label: 'unit 2' },
      now,
      idMaker(),
    );
    const view = buildDemoView(assigned.data, no_orders, now);
    expect(view.tenants.find((tenant) => tenant.name === 'Morgan Diaz').is_active).toBe(true);
    expect(() =>
      demoAssign(
        assigned.data,
        { tenant_id: 'demo-tenant-morgan', property_id: 'demo-prop-maple', unit_label: 'Unit 2' },
        now,
        idMaker(),
      ),
    ).toThrow(expect.objectContaining({ code: 'TENANCY_EXISTS' }));
  });

  test('move ends the old tenancy and makes a new one, all or nothing', () => {
    const data = buildSampleTenantData();
    const moved = demoMove(
      data,
      'demo-tenancy-sam',
      { property_id: 'demo-prop-cedar', unit_label: 'Upstairs', move_out_note: 'Bigger unit' },
      today,
      now,
      idMaker(),
    );
    expect(moved.ended_tenancy).toMatchObject({
      status: 'ended',
      ended_at: today,
      move_out_note: 'Bigger unit',
    });
    expect(moved.tenancy).toMatchObject({
      status: 'active',
      property_id: 'demo-prop-cedar',
      unit_label: 'Upstairs',
    });

    // a bad date changes nothing
    expect(() =>
      demoMove(
        data,
        'demo-tenancy-sam',
        { property_id: 'demo-prop-cedar', ended_at: '2030-01-01' },
        today,
        now,
        idMaker(),
      ),
    ).toThrow(expect.objectContaining({ code: 'INVALID_END_DATE' }));
    expect(data.tenancies.find((item) => item.id === 'demo-tenancy-sam').status).toBe('active');
  });

  test('end sets the date and note, and an ended tenancy cannot be ended or moved again', () => {
    const ended = demoEnd(
      buildSampleTenantData(),
      'demo-tenancy-sam',
      { ended_at: '2026-10-31', move_out_note: 'Keys back' },
      today,
    );
    expect(ended.tenancy).toMatchObject({
      status: 'ended',
      ended_at: '2026-10-31',
      move_out_note: 'Keys back',
    });
    expect(() => demoEnd(ended.data, 'demo-tenancy-sam', {}, today)).toThrow(
      expect.objectContaining({ code: 'TENANCY_ENDED' }),
    );
    expect(() =>
      demoMove(
        ended.data,
        'demo-tenancy-sam',
        { property_id: 'demo-prop-cedar' },
        today,
        now,
        idMaker(),
      ),
    ).toThrow(expect.objectContaining({ code: 'TENANCY_ENDED' }));
  });

  test('errors carry the same friendly text as the server ones', () => {
    try {
      demoEnd(buildSampleTenantData(), 'demo-tenancy-morgan', {}, today);
    } catch (error) {
      expect(error.message).toBe('That tenancy has already ended.');
    }
    expect.assertions(1);
  });
});
