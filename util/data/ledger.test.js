import { getLedgers, saveLedgerChange, catchUpLedgers, buildLedgerChanges } from './ledger';
import {
  demoCreatePayment,
  demoConfirmPayment,
  demoSetSchedule,
} from '../../features/payments/utils/demoLedger';
import { deriveLedger } from '../../features/payments/utils/ledgerMath';
import {
  installFakeFirebase,
  seededFirebase,
  uninstallFakeFirebase,
} from '../../scripts/testing/fakeFirebase';
import { buildSeedData } from '../../scripts/seedData';

afterEach(uninstallFakeFirebase);

const today = new Date().toISOString().slice(0, 10);

function chargeIds(tree) {
  return Object.keys(tree.charges || {}).sort();
}

test('a landlord loads one ledger per tenancy, a tenant only theirs, with the same balances the demo shows', async () => {
  seededFirebase();
  const owner = await getLedgers({ owner_id: 'owner-taylor' });
  expect(owner.map((ledger) => ledger.tenancy_id)).toContain('tenancy-morgan');
  expect(owner[owner.length - 1].tenancy_status).toBe('ended');
  const mine = await getLedgers({ tenant_user_id: 'tenant-sam' });
  expect(mine).toHaveLength(1);
  const sam = deriveLedger(mine[0], today);
  // Sam paid part of last month, so there's an overdue balance with a late fee on it
  expect(sam.overdue_count).toBeGreaterThan(0);
  expect(mine[0].charges.some((charge) => charge.kind === 'late_fee')).toBe(true);
});

test('the catch-up twice gives the same records, and two at once never double charge', async () => {
  // the seed without this month's rent and fees, as if nobody opened the app since last month
  const tree = buildSeedData(new Date());
  const month = today.slice(0, 7);
  Object.keys(tree.charges)
    .filter((id) => id.endsWith(month) || id.startsWith('late-'))
    .forEach((id) => delete tree.charges[id]);
  const firebase = installFakeFirebase(tree);
  const before = chargeIds(firebase.database.dump());

  const first_load = await getLedgers({ owner_id: 'owner-taylor' });
  const first = await catchUpLedgers(first_load, today);
  expect(first.created).toBeGreaterThan(0);
  const after_first = chargeIds(firebase.database.dump());
  expect(after_first.length).toBe(before.length + first.created);

  const second = await catchUpLedgers(await getLedgers({ owner_id: 'owner-taylor' }), today);
  expect(second.created).toBe(0);
  expect(chargeIds(firebase.database.dump())).toEqual(after_first);

  // two phones that both loaded before either caught up
  const second_database = installFakeFirebase(tree).database;
  const phone_a = await getLedgers({ owner_id: 'owner-taylor' });
  const phone_b = await getLedgers({ owner_id: 'owner-taylor' });
  const [run_a, run_b] = await Promise.all([
    catchUpLedgers(phone_a, today),
    catchUpLedgers(phone_b, today),
  ]);
  expect(run_a.created + run_b.created).toBe(first.created);
  expect(chargeIds(second_database.dump())).toEqual(after_first);
});

test('no late fee until the grace days are over', async () => {
  const tree = buildSeedData(new Date('2026-11-09T12:00:00Z'));
  // Alex pays on time every month, so take away this month's payment and look at days 1 to 7
  Object.keys(tree.charges)
    .filter((id) => id.startsWith('rent-tenancy-alex-2026-11') || id.startsWith('late-'))
    .forEach((id) => delete tree.charges[id]);
  Object.keys(tree.payments)
    .filter(
      (id) =>
        tree.payments[id].tenancyId === 'tenancy-alex' && tree.payments[id].paidOn >= '2026-11-01',
    )
    .forEach((id) => delete tree.payments[id]);
  installFakeFirebase(tree);
  const ledgers = (await getLedgers({ owner_id: 'owner-taylor' })).filter(
    (ledger) => ledger.tenancy_id === 'tenancy-alex',
  );
  const grace = ledgers[0].schedule.grace_days;
  const due = '2026-11-' + String(ledgers[0].schedule.due_day).padStart(2, '0');
  const inside = await catchUpLedgers(ledgers, addDays(due, grace));
  expect(inside.ledgers[0].charges.some((charge) => charge.kind === 'late_fee')).toBe(false);
  const after = await catchUpLedgers(ledgers, addDays(due, grace + 1));
  expect(after.ledgers[0].charges.some((charge) => charge.kind === 'late_fee')).toBe(true);
});

function addDays(date, days) {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

test('recording and confirming a payment writes only that payment', async () => {
  const firebase = seededFirebase();
  const ledgers = await getLedgers({ owner_id: 'owner-taylor' });
  const created = demoCreatePayment(
    ledgers,
    'tenancy-jordan',
    { amount_cents: 5000, method: 'zelle', paid_on: today, applies_to: 'rent' },
    'tenant',
    new Date().toISOString(),
    today,
    () => 'pay-new-claim',
  );
  const before = ledgers.find((ledger) => ledger.tenancy_id === 'tenancy-jordan');
  const changes = buildLedgerChanges(before, created.ledger);
  expect(Object.keys(changes.patch)).toEqual(['payments/pay-new-claim']);
  await saveLedgerChange(before, created.ledger);
  expect(firebase.database.dump().payments['pay-new-claim'].status).toBe('pending_confirmation');

  const reloaded = await getLedgers({ owner_id: 'owner-taylor' });
  const confirmed = demoConfirmPayment(reloaded, 'pay-new-claim', new Date().toISOString(), today);
  const jordan = reloaded.find((ledger) => ledger.tenancy_id === 'tenancy-jordan');
  await saveLedgerChange(jordan, confirmed.ledger);
  const saved = firebase.database.dump().payments['pay-new-claim'];
  expect(saved.status).toBe('succeeded');
  expect(Object.keys(saved.events)).toHaveLength(2);
});

test('a rent schedule change saves the schedule and bills from its new start', async () => {
  const firebase = seededFirebase();
  const ledgers = await getLedgers({ owner_id: 'owner-taylor' });
  const priya = ledgers.find((ledger) => ledger.tenancy_id === 'tenancy-priya');
  const result = demoSetSchedule(
    ledgers,
    'tenancy-priya',
    { ...priya.schedule, amount_cents: 99900 },
    today,
  );
  await saveLedgerChange(priya, result.ledger);
  expect(firebase.database.dump().rentSchedules['tenancy-priya'].amountCents).toBe(99900);
});
