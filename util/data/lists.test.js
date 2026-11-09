import { getTrips, saveTripChanges } from './mileage';
import { getDocuments, saveDocumentChanges } from './documents';
import { getChecklists, saveChecklistChanges } from './checklists';
import { getOwnerSettings, saveOwnerSettings } from './settings';
import { getReminderLog, saveReminder } from './reminders';
import { seededFirebase, uninstallFakeFirebase } from '../../scripts/testing/fakeFirebase';
import { sample_checklists } from '../../features/checklist/data/sampleChecklists';

afterEach(uninstallFakeFirebase);
const owner_id = 'owner-taylor';

test('mileage: load, add, edit, delete in one write each', async () => {
  const firebase = seededFirebase();
  const trips = await getTrips(owner_id);
  expect(trips).toHaveLength(3);
  const added = [
    ...trips,
    { id: 'trip-new', date: '2026-11-01', property: '48 Cedar Ave', miles: 4, purpose: 'Keys' },
  ];
  await saveTripChanges(trips, added, owner_id);
  const edited = added.map((trip) => (trip.id === 'trip-new' ? { ...trip, miles: 6.5 } : trip));
  await saveTripChanges(added, edited, owner_id);
  expect((await getTrips(owner_id)).find((trip) => trip.id === 'trip-new').miles).toBe(6.5);
  await saveTripChanges(
    edited,
    edited.filter((trip) => trip.id !== 'trip-1'),
    owner_id,
  );
  expect(firebase.database.dump().mileage['trip-1']).toBeUndefined();
  expect(await getTrips('owner-jamie')).toEqual([]);
});

test('documents save as records with no file', async () => {
  seededFirebase();
  const documents = await getDocuments(owner_id);
  expect(documents.length).toBeGreaterThan(0);
  expect(documents[0].stored_name).toBeNull();
  const next = [
    ...documents,
    {
      id: 'doc-new',
      name: 'Renters insurance',
      category: 'Insurance',
      property: '48 Cedar Ave',
      added_at: '2026-11-01',
      expires_on: null,
    },
  ];
  await saveDocumentChanges(documents, next, owner_id);
  expect((await getDocuments(owner_id)).some((item) => item.name === 'Renters insurance')).toBe(
    true,
  );
});

test('checklists keep their room and item order through keyed objects', async () => {
  const firebase = seededFirebase();
  const checklists = await getChecklists(owner_id);
  const original = sample_checklists[0];
  const loaded = checklists.find((item) => item.id === original.id);
  expect(loaded.rooms.map((room) => room.name)).toEqual(original.rooms.map((room) => room.name));
  expect(loaded.rooms[0].items.map((item) => item.name)).toEqual(
    original.rooms[0].items.map((item) => item.name),
  );
  // tick one item: only that checklist's rooms field is written
  const open = checklists.find((item) => !item.completed);
  const changed = checklists.map((item) =>
    item.id === open.id
      ? {
          ...item,
          rooms: item.rooms.map((room, index) =>
            index === 0
              ? { ...room, items: room.items.map((it) => ({ ...it, done: true })) }
              : room,
          ),
        }
      : item,
  );
  await saveChecklistChanges(checklists, changed, owner_id);
  const saved = firebase.database.dump().checklists[open.id].rooms.i000.items;
  expect(Object.values(saved).every((item) => item.done)).toBe(true);
  expect(Array.isArray(firebase.database.dump().checklists[open.id].rooms)).toBe(false);
});

test('owner settings: the rate and budgets by property name', async () => {
  seededFirebase();
  const settings = await getOwnerSettings(owner_id);
  expect(settings.budgets['48 Cedar Ave']).toBe(2500);
  await saveOwnerSettings(owner_id, { mileage_rate: 0.67, budgets: { 'A.B / C': 10 } });
  expect(await getOwnerSettings(owner_id)).toEqual({
    mileage_rate: 0.67,
    budgets: { 'A.B / C': 10 },
  });
  expect(await getOwnerSettings('owner-jamie')).toBeNull();
});

test('reminders: the log is oldest first and a new one is added', async () => {
  seededFirebase();
  const log = await getReminderLog('tenancy-sam');
  expect(log).toHaveLength(1);
  await saveReminder(
    owner_id,
    'tenancy-sam',
    {
      sent_at: new Date().toISOString(),
      kind: 'overdue_notice',
      amount_cents: 100,
      charge_id: 'c',
    },
    'Hi',
  );
  const after = await getReminderLog('tenancy-sam');
  expect(after).toHaveLength(2);
  expect(after[1].kind).toBe('overdue_notice');
});
