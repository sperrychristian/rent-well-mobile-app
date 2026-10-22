import {
  deriveLease,
  daysBetween,
  fromApiLease,
  toApiLease,
  checkLeaseForm,
  checkRenewForm,
  suggestedRenewEnd,
  leaseStatusLabel,
  daysLine,
  leaseRows,
  leasesSummary,
  urgentLease,
  tenantLeaseLine,
  leaseEventLine,
  shortLeaseDate,
} from './leaseHelpers';
import { demoSetLease, demoRenewLease, demoLeaseEvents } from './demoLeases';
import { buildSampleTenantData } from '../../tenants/data/sampleTenants';
import { buildDemoView } from '../../tenants/utils/demoTenants';

const today = '2026-10-22';
const fixed = (end, notice) => ({
  lease_start_on: '2025-11-01',
  lease_end_on: end,
  lease_term: 'fixed',
  renewal_notice_days: notice === undefined ? 60 : notice,
});

// the same boundaries the server's deriveLease has (docs/API.md, Lease block)
describe('deriveLease', () => {
  test('no term is none, month to month has no end and no days', () => {
    expect(deriveLease(null, today).lease_status).toBe('none');
    expect(
      deriveLease({ lease_term: 'month_to_month', lease_end_on: '2027-01-01' }, today),
    ).toMatchObject({
      lease_status: 'month_to_month',
      lease_end_on: null,
      days_remaining: null,
    });
  });

  test('expiring_soon includes both ends of the notice window, expired is below zero', () => {
    expect(deriveLease(fixed('2026-12-21'), today)).toMatchObject({
      days_remaining: 60,
      lease_status: 'expiring_soon',
    });
    expect(deriveLease(fixed('2026-12-22'), today).lease_status).toBe('active');
    expect(deriveLease(fixed(today), today)).toMatchObject({
      days_remaining: 0,
      lease_status: 'expiring_soon',
    });
    expect(deriveLease(fixed('2026-10-21'), today)).toMatchObject({
      days_remaining: -1,
      lease_status: 'expired',
    });
    expect(deriveLease(fixed('2026-11-01', 0), today).lease_status).toBe('active');
  });

  test('days between dates ignore daylight saving', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-11-03', '2026-10-31')).toBe(-3);
  });
});

describe('api mapping', () => {
  test('the lease block becomes snake_case and keeps the server status', () => {
    expect(
      fromApiLease({
        leaseStartOn: '2025-11-01',
        leaseEndOn: '2026-10-31',
        leaseTerm: 'fixed',
        renewalNoticeDays: 60,
        daysRemaining: 9,
        leaseStatus: 'expiring_soon',
      }),
    ).toEqual({
      lease_start_on: '2025-11-01',
      lease_end_on: '2026-10-31',
      lease_term: 'fixed',
      renewal_notice_days: 60,
      days_remaining: 9,
      lease_status: 'expiring_soon',
      lease_notes: '',
    });
  });

  test('the PUT body sends every field and no end date for month to month', () => {
    expect(
      toApiLease({
        lease_start_on: '2026-01-01',
        lease_end_on: '2026-12-31',
        lease_term: 'month_to_month',
        renewal_notice_days: 30,
        lease_notes: '',
      }),
    ).toEqual({
      leaseStartOn: '2026-01-01',
      leaseEndOn: null,
      leaseTerm: 'month_to_month',
      renewalNoticeDays: 30,
      leaseNotes: null,
    });
  });
});

describe('the forms', () => {
  test('a fixed lease needs an end after its start, notice is 0 to 365', () => {
    const missing = checkLeaseForm(
      { lease_start_on: '2026-01-01', lease_end_on: '', notice_text: '60' },
      today,
    );
    expect(missing.errors.lease_end_on).toBeTruthy();
    const backwards = checkLeaseForm(
      { lease_start_on: '2026-01-01', lease_end_on: '2025-12-31', notice_text: '400' },
      today,
    );
    expect(backwards.errors.lease_end_on).toBeTruthy();
    expect(backwards.errors.notice).toBeTruthy();
    const month = checkLeaseForm(
      { lease_start_on: '2026-01-01', is_month_to_month: true, notice_text: '' },
      today,
    );
    expect(month.errors).toEqual({});
    expect(month.value).toMatchObject({
      lease_term: 'month_to_month',
      lease_end_on: null,
      renewal_notice_days: 60,
    });
  });

  test('a renewal has to end after today and the current end, rent is optional', () => {
    const lease = deriveLease(fixed('2026-11-16'), today);
    expect(
      checkRenewForm({ new_end_on: '2026-11-10', rent_cents: null }, lease, today).errors
        .new_end_on,
    ).toBeTruthy();
    expect(
      checkRenewForm({ new_end_on: today, rent_cents: null }, lease, today).errors.new_end_on,
    ).toBeTruthy();
    expect(
      checkRenewForm({ new_end_on: '2027-11-16', rent_cents: 0 }, lease, today).errors.rent,
    ).toBeTruthy();
    expect(checkRenewForm({ new_end_on: '2027-11-16', rent_cents: 149500 }, lease, today)).toEqual({
      errors: {},
      value: { new_end_on: '2027-11-16', new_rent_cents: 149500 },
    });
    expect(suggestedRenewEnd(lease, today)).toBe('2027-11-16');
  });
});

describe('words on screen', () => {
  test('every status has words, a tone, and an icon', () => {
    ['none', 'month_to_month', 'active', 'expiring_soon', 'expired'].forEach((lease_status) => {
      const label = leaseStatusLabel({ lease_status });
      expect(label.label.length).toBeGreaterThan(2);
      expect(label.tone).toBeTruthy();
    });
    expect(daysLine({ days_remaining: 25 })).toBe('25 days left');
    expect(daysLine({ days_remaining: 0 })).toBe('Ends today');
    expect(daysLine({ days_remaining: -12 })).toBe('Ended 12 days ago');
    expect(daysLine({ days_remaining: null, lease_status: 'month_to_month' })).toBe('No end date');
    expect(shortLeaseDate('2027-01-31', today)).toBe('Jan 31, 2027');
    expect(shortLeaseDate('2026-11-09', today)).toBe('Nov 9');
  });

  test('the demo leases match the backend seed story, sorted soonest first', () => {
    const view = buildDemoView(buildSampleTenantData(), [], new Date());
    const rows = leaseRows(view.tenants);
    const current = rows
      .filter((row) => !row.is_past)
      .map((row) => [row.tenant.name, row.lease.lease_status]);
    expect(current).toEqual([
      ['Sam Rivera', 'expiring_soon'],
      ['Jordan Lee', 'active'],
      ['Priya Shah', 'month_to_month'],
      ['Alex Chen', 'none'],
    ]);
    const past = rows.filter((row) => row.is_past);
    expect(past.map((row) => [row.tenant.name, row.lease.lease_status])).toEqual([
      ['Morgan Diaz', 'expired'],
    ]);
    expect(rows[0].lease.days_remaining).toBe(25);
    expect(leasesSummary(view.tenants).text).toBe('1 ending soon');
    expect(urgentLease(view.tenants).text).toBe("Sam Rivera's lease ends in 25 days");
  });

  test('the tenant line only shows within 90 days', () => {
    expect(tenantLeaseLine(deriveLease(fixed('2027-01-15'), today), today).text).toBe(
      'Your lease ends Jan 15, 2027',
    );
    expect(tenantLeaseLine(deriveLease(fixed('2027-06-30'), today), today)).toBeNull();
    expect(tenantLeaseLine(deriveLease({ lease_term: 'month_to_month' }, today), today)).toBeNull();
    expect(tenantLeaseLine(deriveLease(fixed('2026-11-01'), today), today).tone).toBe('danger');
  });

  test('a quiet summary when every lease is fine', () => {
    const tenants = [
      {
        name: 'A',
        active_tenancies: [{ id: 't', lease: deriveLease(fixed('2027-09-01'), today) }],
        ended_tenancies: [],
      },
    ];
    expect(leasesSummary(tenants).text).toBe('All leases current');
    expect(urgentLease(tenants)).toBeNull();
  });
});

describe('the demo lease routes', () => {
  const now = new Date('2026-10-22T16:00:00Z');
  let counter = 0;
  const makeId = () => 'e' + ++counter;

  test('set writes a set event, the same lease again writes nothing, a change writes changed', () => {
    const data = buildSampleTenantData();
    const value = {
      lease_start_on: '2026-08-01',
      lease_end_on: '2027-07-31',
      lease_term: 'fixed',
      renewal_notice_days: 60,
      lease_notes: '',
    };
    const first = demoSetLease(data, 'demo-tenancy-alex', value, today, now, makeId);
    expect(demoLeaseEvents(first.data, 'demo-tenancy-alex').map((event) => event.type)).toEqual([
      'set',
    ]);
    const same = demoSetLease(first.data, 'demo-tenancy-alex', value, today, now, makeId);
    expect(same.data).toBe(first.data);
    const changed = demoSetLease(
      first.data,
      'demo-tenancy-alex',
      { ...value, lease_term: 'month_to_month', lease_end_on: null },
      today,
      now,
      makeId,
    );
    expect(demoLeaseEvents(changed.data, 'demo-tenancy-alex').map((event) => event.type)).toEqual([
      'set',
      'changed',
    ]);
  });

  test('the server errors: ended tenancy, missing lease, bad dates, rent with no schedule', () => {
    const data = buildSampleTenantData();
    expect(() =>
      demoRenewLease(
        data,
        'demo-tenancy-morgan',
        { new_end_on: '2027-10-01' },
        today,
        now,
        makeId,
        true,
      ),
    ).toThrow(expect.objectContaining({ code: 'TENANCY_ENDED' }));
    expect(() =>
      demoRenewLease(
        data,
        'demo-tenancy-alex',
        { new_end_on: '2027-10-01' },
        today,
        now,
        makeId,
        true,
      ),
    ).toThrow(expect.objectContaining({ code: 'NO_LEASE' }));
    expect(() =>
      demoRenewLease(data, 'demo-tenancy-sam', { new_end_on: today }, today, now, makeId, true),
    ).toThrow(expect.objectContaining({ code: 'INVALID_LEASE_DATES' }));
    expect(() =>
      demoRenewLease(
        data,
        'demo-tenancy-sam',
        { new_end_on: '2027-12-01', new_rent_cents: 149500 },
        today,
        now,
        makeId,
        false,
      ),
    ).toThrow(expect.objectContaining({ code: 'NO_RENT_SCHEDULE' }));
    expect(() => demoLeaseEvents(data, 'nope')).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });

  test('renewing makes it fixed with the new end and logs the rent change', () => {
    const data = buildSampleTenantData();
    const result = demoRenewLease(
      data,
      'demo-tenancy-priya',
      { new_end_on: '2027-10-31', new_rent_cents: 150000 },
      today,
      now,
      makeId,
      true,
    );
    expect(result.lease).toMatchObject({ lease_term: 'fixed', lease_end_on: '2027-10-31' });
    const events = demoLeaseEvents(result.data, 'demo-tenancy-priya');
    expect(events[events.length - 1]).toMatchObject({
      type: 'renewed',
      data: { previousTerm: 'month_to_month', newEndOn: '2027-10-31', newRentCents: 150000 },
    });
    expect(leaseEventLine(events[events.length - 1], today)).toBe(
      'Renewed to Oct 31, 2027, new rent $1,500.00',
    );
  });
});
