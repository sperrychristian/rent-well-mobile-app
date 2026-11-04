import {
  buildCalendarEvents,
  eventsByDate,
  dotsFor,
  monthGrid,
  dayLabel,
  daySpokenLabel,
  upcomingForExport,
  canExport,
  deviceEventDetails,
  max_dots,
} from './calendarEvents';
import { buildSampleLedgers } from '../../payments/data/sampleLedger';

const today = '2026-10-28';
const ledgers = buildSampleLedgers(today);
const sam_ledger = ledgers.find((ledger) => ledger.tenancy_id === 'demo-tenancy-sam');

const tenants = [
  {
    id: 'demo-tenant-sam',
    name: 'Sam Rivera',
    active_tenancies: [
      {
        id: 'demo-tenancy-sam',
        property_name: '123 Maple St',
        unit_label: 'Unit 2',
        lease: { lease_end_on: '2026-11-22', lease_status: 'expiring_soon' },
      },
    ],
  },
  {
    id: 'demo-tenant-morgan',
    name: 'Morgan Diaz',
    active_tenancies: [
      {
        id: 'demo-tenancy-morgan',
        property_name: '48 Cedar Ave',
        unit_label: '',
        lease: { lease_end_on: '2026-09-30', lease_status: 'expired' },
      },
    ],
  },
];

const orders = [
  {
    id: '1',
    title: 'Kitchen faucet leaking',
    property: '123 Maple St, Unit 2',
    status: 'In Progress',
    created_at: '2026-10-05',
    started_at: '2026-10-06',
    resolved_at: null,
  },
];

describe('buildCalendarEvents', () => {
  const events = buildCalendarEvents({
    role: 'owner',
    ledgers: ledgers,
    tenants: tenants,
    orders: orders,
    today: today,
  });

  test('a landlord gets rent, payments, lease ends, and work order dates, each opening by id', () => {
    const kinds = new Set(events.map((entry) => entry.kind));
    expect([...kinds].sort()).toEqual(['charge', 'lease', 'payment', 'rent', 'work_order'].sort());
    const rent = events.find((entry) => entry.kind === 'rent');
    expect(rent.route).toBe('TenantLedger');
    expect(rent.target_id).toMatch(/^demo-tenancy-/);
    const lease = events.find((entry) => entry.key === 'lease:demo-tenancy-sam');
    expect(lease).toMatchObject({
      date: '2026-11-22',
      route: 'TenantLease',
      target_id: 'demo-tenancy-sam',
    });
    const payment = events.find((entry) => entry.kind === 'payment');
    expect(payment.route).toBe('PaymentDetail');
    const reported = events.find((entry) => entry.key === 'order:1:created_at');
    expect(reported).toMatchObject({
      date: '2026-10-05',
      route: 'WorkOrderDetail',
      target_id: '1',
    });
    // no resolved date yet, so no Resolved event
    expect(events.find((entry) => entry.key === 'order:1:resolved_at')).toBeUndefined();
  });

  test('past due rent and an expired lease are marked and read terracotta', () => {
    const overdue = events.filter((entry) => entry.past_due && entry.kind === 'rent');
    expect(overdue.length).toBeGreaterThan(0);
    overdue.forEach((entry) => {
      expect(entry.tone).toBe('danger');
      expect(entry.icon).toBe('alert-circle-outline');
      expect(entry.subtitle).toMatch(/Overdue/);
    });
    const expired = events.find((entry) => entry.key === 'lease:demo-tenancy-morgan');
    expect(expired).toMatchObject({ past_due: true, tone: 'danger' });
    expect(expired.subtitle).toMatch(/Expired/);
  });

  test('a tenant only gets their own ledger and lease, and their charges open Payments', () => {
    const mine = buildCalendarEvents({
      role: 'tenant',
      ledgers: [sam_ledger],
      my_tenancies: tenants[0].active_tenancies,
      orders: orders,
      today: today,
    });
    expect(mine.some((entry) => entry.subtitle.includes('Jordan'))).toBe(false);
    expect(mine.find((entry) => entry.kind === 'rent').route).toBe('Payments');
    expect(mine.find((entry) => entry.kind === 'lease').route).toBe('TenantHome');
    expect(mine.find((entry) => entry.kind === 'work_order').route).toBe('RequestDetail');
    expect(mine.every((entry) => entry.route !== 'TenantLedger')).toBe(true);
  });

  test('a day sorts past due first', () => {
    const by_date = eventsByDate(events);
    Object.values(by_date).forEach((day) => {
      const first_ok = day.findIndex((entry) => !entry.past_due);
      if (first_ok > -1) {
        expect(day.slice(first_ok).some((entry) => entry.past_due)).toBe(false);
      }
    });
  });
});

describe('the month grid', () => {
  test('October 2026 starts on a Thursday and fills five weeks of seven days', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks).toHaveLength(5);
    weeks.forEach((week) => expect(week).toHaveLength(7));
    expect(weeks[0][0]).toEqual({ date: '2026-09-27', day: 27, in_month: false });
    expect(weeks[0][4]).toEqual({ date: '2026-10-01', day: 1, in_month: true });
    expect(weeks[4][6].date).toBe('2026-10-31');
  });

  test('February 2026 needs only four weeks, a month starting on Saturday needs six', () => {
    expect(monthGrid('2026-02')).toHaveLength(4);
    expect(monthGrid('2026-08')).toHaveLength(6);
  });

  test('dots: one per tone, danger first, at most three', () => {
    const day = [
      { tone: 'neutral' },
      { tone: 'success' },
      { tone: 'danger' },
      { tone: 'warning' },
      { tone: 'danger' },
    ];
    expect(dotsFor(day)).toEqual(['danger', 'warning', 'success']);
    expect(dotsFor(day)).toHaveLength(max_dots);
    expect(dotsFor([])).toEqual([]);
  });

  test('labels say the weekday, the count, and what is past due', () => {
    expect(dayLabel('2026-10-28')).toBe('Wednesday, Oct 28');
    expect(daySpokenLabel('2026-10-28', [], true)).toBe('Wednesday, Oct 28, today, no events');
    expect(daySpokenLabel('2026-10-01', [{ past_due: true }, { past_due: false }], false)).toBe(
      'Thursday, Oct 1, 2 events, 1 past due',
    );
  });
});

describe('sending to the phone', () => {
  const events = buildCalendarEvents({
    role: 'owner',
    ledgers: ledgers,
    tenants: tenants,
    orders: orders,
    today: today,
  });

  test('upcoming is unpaid rent, charges, and lease ends from today to 90 days out', () => {
    const upcoming = upcomingForExport(events, today);
    expect(upcoming.length).toBeGreaterThan(0);
    upcoming.forEach((entry) => {
      expect(['rent', 'charge', 'lease']).toContain(entry.kind);
      expect(entry.date >= today).toBe(true);
      expect(entry.date <= '2027-01-26').toBe(true);
      expect(entry.tone).not.toBe('success');
    });
    expect(upcoming.some((entry) => entry.key === 'lease:demo-tenancy-sam')).toBe(true);
  });

  test('past dates and payments never go to the phone one at a time either', () => {
    expect(canExport({ date: '2026-10-01', kind: 'rent' }, today)).toBe(false);
    expect(canExport({ date: '2026-11-01', kind: 'payment' }, today)).toBe(false);
    expect(canExport({ date: '2026-11-01', kind: 'rent' }, today)).toBe(true);
  });

  test('the phone gets an all-day event on that local date, demo titles start with [Demo]', () => {
    const entry = { title: 'Rent due, $1,450.00', subtitle: 'Sam Rivera', date: '2026-11-01' };
    const real = deviceEventDetails(entry, false);
    expect(real.title).toBe('Rent due, $1,450.00');
    expect(real.allDay).toBe(true);
    expect(real.startDate.getFullYear()).toBe(2026);
    expect(real.startDate.getMonth()).toBe(10);
    expect(real.startDate.getDate()).toBe(1);
    expect(real.notes).toMatch(/Added from Rent Well/);
    expect(deviceEventDetails(entry, true).title).toBe('[Demo] Rent due, $1,450.00');
  });
});
