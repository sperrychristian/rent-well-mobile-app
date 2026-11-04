// pure helpers for the Calendar screen: events from what the app already has loaded (rent and other charges,
// confirmed payments, lease ends, work order dates), the month grid, and the details for the phone's calendar
// nothing here touches the network, storage, or the device calendar, so the tests can check all of it
import {
  deriveLedger,
  dateFrom,
  addDays,
  monthOf,
  shiftMonth,
} from '../../payments/utils/ledgerMath';
import {
  chargeKindLabel,
  chargeStatusLine,
  monthTitle,
  shortDate,
} from '../../payments/utils/ledgerHelpers';
import { formatCents } from '../../../utils/formatCurrency';

export const weekday_labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// the spoken names, so a screen reader says "Monday" and not "Mon"
export const weekday_names = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
// how far ahead "Add upcoming" looks, so it never fills the phone with a year of rent at once
export const upcoming_days = 90;
// the most dots a day shows, more events still show in the agenda under it
export const max_dots = 3;

// one event: the date it sits on, what it says, its tone (danger is past due), and where a tap goes by id
// exportable is true for the kinds "Add to my calendar" can send to the phone (anything with a date ahead)
function event(fields) {
  return {
    key: fields.key,
    date: fields.date,
    kind: fields.kind,
    title: fields.title,
    subtitle: fields.subtitle || '',
    tone: fields.tone || 'neutral',
    icon: fields.icon,
    past_due: !!fields.past_due,
    route: fields.route,
    target_id: fields.target_id || null,
  };
}

function placeText(property_name, unit_label) {
  return [property_name, unit_label].filter(Boolean).join(', ');
}

// data: { role, ledgers, tenants (a landlord's), my_tenancies (a tenant's active ones), orders, today }
// the screen hands in only that role's ledgers and orders, so a tenant never gets someone else's dates
export function buildCalendarEvents(data) {
  const is_owner = data.role !== 'tenant';
  const today = data.today;
  const events = [];

  (data.ledgers || []).forEach((ledger) => {
    const who = is_owner ? ledger.tenant_name : '';
    const derived = deriveLedger(ledger, today);
    derived.charges
      .filter((charge) => charge.status !== 'voided')
      .forEach((charge) => {
        const line = chargeStatusLine(charge);
        const name =
          charge.kind === 'rent' ? 'Rent' : charge.description || chargeKindLabel(charge.kind);
        events.push(
          event({
            key: 'charge:' + charge.id,
            date: charge.due_date,
            kind: charge.kind === 'rent' ? 'rent' : 'charge',
            title: name + ' due, ' + formatCents(charge.amount_cents),
            subtitle: [who, line.text].filter(Boolean).join(' · '),
            tone: line.tone,
            icon: charge.status === 'overdue' ? 'alert-circle-outline' : 'card-outline',
            past_due: charge.status === 'overdue',
            // a landlord opens that tenant's ledger, a tenant's charges live on their Payments tab
            route: is_owner ? 'TenantLedger' : 'Payments',
            target_id: is_owner ? ledger.tenancy_id : null,
          }),
        );
      });
    // confirmed payments sit on the day they were paid and open their Payment Record
    (ledger.payments || [])
      .filter((payment) => payment.status === 'succeeded' && payment.paid_on)
      .forEach((payment) => {
        events.push(
          event({
            key: 'payment:' + payment.id,
            date: payment.paid_on,
            kind: 'payment',
            title: (payment.is_refund ? 'Refund ' : 'Paid ') + formatCents(payment.amount_cents),
            subtitle: [who, 'Confirmed'].filter(Boolean).join(' · '),
            tone: 'success',
            icon: 'checkmark-circle-outline',
            route: 'PaymentDetail',
            target_id: payment.id,
          }),
        );
      });
  });

  // lease ends: every active tenancy for a landlord, their own for a tenant
  const tenancies = is_owner
    ? (data.tenants || []).flatMap((tenant) =>
        (tenant.active_tenancies || []).map((tenancy) => ({
          ...tenancy,
          tenant_name: tenant.name,
        })),
      )
    : data.my_tenancies || [];
  tenancies.forEach((tenancy) => {
    const lease = tenancy.lease;
    if (!lease || !lease.lease_end_on) {
      return;
    }
    const expired = lease.lease_end_on < today;
    events.push(
      event({
        key: 'lease:' + tenancy.id,
        date: lease.lease_end_on,
        kind: 'lease',
        title: 'Lease ends',
        subtitle: [
          is_owner ? tenancy.tenant_name : '',
          placeText(tenancy.property_name, tenancy.unit_label),
          expired ? 'Expired' : '',
        ]
          .filter(Boolean)
          .join(' · '),
        tone: expired ? 'danger' : 'warning',
        icon: expired ? 'alert-circle-outline' : 'document-outline',
        past_due: expired,
        // a landlord opens the lease, a tenant's lease line lives on My Home
        route: is_owner ? 'TenantLease' : 'TenantHome',
        target_id: is_owner ? tenancy.id : null,
      }),
    );
  });

  // work orders: the day it was reported, started, and resolved, whichever it has
  (data.orders || []).forEach((order) => {
    const steps = [
      { field: 'created_at', word: 'Reported' },
      { field: 'started_at', word: 'Started' },
      { field: 'resolved_at', word: 'Resolved' },
    ];
    steps.forEach((step) => {
      if (!order[step.field]) {
        return;
      }
      events.push(
        event({
          key: 'order:' + order.id + ':' + step.field,
          date: order[step.field],
          kind: 'work_order',
          title: step.word + ': ' + order.title,
          subtitle: [order.property, order.status].filter(Boolean).join(' · '),
          tone: step.field === 'resolved_at' ? 'success' : 'neutral',
          icon: 'construct-outline',
          route: is_owner ? 'WorkOrderDetail' : 'RequestDetail',
          target_id: order.id,
        }),
      );
    });
  });

  // past due first inside a day, then by kind so rent sits above the rest
  const kind_order = { rent: 0, charge: 1, lease: 2, payment: 3, work_order: 4 };
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.past_due) - Number(a.past_due) ||
      kind_order[a.kind] - kind_order[b.kind],
  );
}

// { 'YYYY-MM-DD': [events] } so the grid can look a day up fast
export function eventsByDate(events) {
  const by_date = {};
  events.forEach((entry) => {
    if (!by_date[entry.date]) {
      by_date[entry.date] = [];
    }
    by_date[entry.date].push(entry);
  });
  return by_date;
}

// the dots under a day: one per tone, past due first, at most three
export function dotsFor(day_events) {
  const tones = [];
  ['danger', 'warning', 'success', 'info', 'neutral'].forEach((tone) => {
    if (day_events.some((entry) => entry.tone === tone)) {
      tones.push(tone);
    }
  });
  return tones.slice(0, max_dots);
}

// the month as weeks of seven days, Sunday first, with the days from the months around it filled in
// month is 'YYYY-MM', each cell is { date, day, in_month }
export function monthGrid(month) {
  const [year, number] = month.split('-').map((part) => parseInt(part, 10));
  const first = dateFrom(year, number, 1);
  const first_weekday = new Date(year, number - 1, 1).getDay();
  const days_in_month = new Date(year, number, 0).getDate();
  const weeks_needed = Math.ceil((first_weekday + days_in_month) / 7);
  const start = addDays(first, -first_weekday);
  const weeks = [];
  for (let week = 0; week < weeks_needed; week++) {
    const days = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const date = addDays(start, week * 7 + weekday);
      days.push({
        date: date,
        day: parseInt(date.slice(8, 10), 10),
        in_month: monthOf(date) === month,
      });
    }
    weeks.push(days);
  }
  return weeks;
}

export function nextMonth(month) {
  return shiftMonth(month, 1);
}

export function previousMonth(month) {
  return shiftMonth(month, -1);
}

export function monthLabel(month) {
  return monthTitle(month);
}

// "Tuesday, Oct 28" for the agenda heading and the cells' spoken labels
export function dayLabel(date) {
  const [year, number, day] = date.split('-').map((part) => parseInt(part, 10));
  return weekday_names[new Date(year, number - 1, day).getDay()] + ', ' + shortDate(date);
}

// what a day cell says to a screen reader: the date, how many events, and how many are past due
export function daySpokenLabel(date, day_events, is_today) {
  const count = day_events.length;
  const late = day_events.filter((entry) => entry.past_due).length;
  return [
    dayLabel(date),
    is_today ? 'today' : '',
    count === 0 ? 'no events' : count === 1 ? '1 event' : count + ' events',
    late > 0 ? late + ' past due' : '',
  ]
    .filter(Boolean)
    .join(', ');
}

// what "Add upcoming rent due dates and lease ends" sends: unpaid rent and charges and lease ends from today
// out to upcoming_days, nothing past and nothing already paid
export function upcomingForExport(events, today) {
  const until = addDays(today, upcoming_days);
  return events.filter(
    (entry) =>
      (entry.kind === 'rent' || entry.kind === 'charge' || entry.kind === 'lease') &&
      entry.date >= today &&
      entry.date <= until &&
      entry.tone !== 'success',
  );
}

// one event can go to the phone when it's today or later (a past date in the calendar helps nobody)
export function canExport(entry, today) {
  return entry.date >= today && entry.kind !== 'payment';
}

// the details the phone's calendar gets: an all-day event on that date, demo ones say so in the title
// the dates are built on the phone's own calendar so an all-day event never slides a day in another time zone
export function deviceEventDetails(entry, demo_mode) {
  const [year, number, day] = entry.date.split('-').map((part) => parseInt(part, 10));
  const start = new Date(year, number - 1, day, 0, 0, 0);
  const end = new Date(year, number - 1, day, 23, 59, 0);
  return {
    title: (demo_mode ? '[Demo] ' : '') + entry.title,
    startDate: start,
    endDate: end,
    allDay: true,
    notes: (entry.subtitle ? entry.subtitle + '\n' : '') + 'Added from Rent Well',
  };
}
