import { useEffect } from 'react';
import { render, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './AuthContext';
import { WorkOrdersProvider, useWorkOrders } from './WorkOrdersContext';
import { RemoteWorkOrdersProvider } from './RemoteWorkOrdersProvider';
import { MessagesProvider, useMessages, thread_poll_ms } from './MessagesContext';
import { TenantsProvider, useTenants } from './TenantsContext';
import { LedgerProvider, useLedger } from './LedgerContext';
import { ExpensesProvider, useExpenses } from './ExpensesContext';
import { seededFirebase, uninstallFakeFirebase } from '../scripts/testing/fakeFirebase';
import { openCount } from '../features/workOrders/utils/workOrderHelpers';
import { deriveLedger } from '../features/payments/utils/ledgerMath';

// every Firebase provider through the real provider tree (the same order App.js uses), against the seeded
// fake database: first load, a change that shows right away, a failed write that rolls back, the error
// state, and refresh, plus the test accounts sign in and the 8 second message check

jest.mock('../util/navigationRef', () => ({
  resetTo: jest.fn(),
  navigateWhenReady: jest.fn(),
  navigation_ref: { isReady: () => false },
}));

const today = new Date().toISOString().slice(0, 10);
const peek = {};

function Peek() {
  const auth = useAuth();
  const work_orders = useWorkOrders();
  const messages = useMessages();
  const tenants = useTenants();
  const ledger = useLedger();
  const expenses = useExpenses();
  useEffect(() => {
    Object.assign(peek, { auth, work_orders, messages, tenants, ledger, expenses });
  });
  return null;
}

// just the auth part, for the tests that render AuthProvider alone
function AuthPeek() {
  const auth = useAuth();
  useEffect(() => {
    peek.auth = auth;
  });
  return null;
}

function AccountData(props) {
  const { user } = useAuth();
  return (
    <WorkOrdersProvider
      user_id={user ? user.id : null}
      firebase_owner_id={user && user.role === 'owner' ? user.id : null}
    >
      <RemoteWorkOrdersProvider>
        <MessagesProvider>
          <TenantsProvider>
            <LedgerProvider>
              <ExpensesProvider>{props.children}</ExpensesProvider>
            </LedgerProvider>
          </TenantsProvider>
        </MessagesProvider>
      </RemoteWorkOrdersProvider>
    </WorkOrdersProvider>
  );
}

async function settle(rounds) {
  for (let index = 0; index < (rounds || 6); index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

// signs in by saving the test account the way Log In does, then renders the providers
async function renderAs(user_id) {
  const firebase = seededFirebase();
  const user = firebase.database.dump().users[user_id];
  await AsyncStorage.setItem('rent_well_test_account', JSON.stringify(user));
  const view = render(
    <AuthProvider>
      <AccountData>
        <Peek />
      </AccountData>
    </AuthProvider>,
  );
  await settle(10);
  return { firebase, view };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  Object.keys(peek).forEach((key) => delete peek[key]);
});

afterEach(() => {
  uninstallFakeFirebase();
  jest.useRealTimers();
});

describe('test accounts', () => {
  test('a saved landlord account opens signed in and every store loads its records', async () => {
    await renderAs('owner-taylor');
    expect(peek.auth.user).toMatchObject({ id: 'owner-taylor', role: 'owner' });
    expect(peek.work_orders.orders_status).toBe('ready');
    expect(peek.work_orders.orders).toHaveLength(5);
    expect(peek.tenants.status).toBe('ready');
    expect(peek.tenants.tenants.length).toBe(6);
    expect(peek.ledger.status).toBe('ready');
    expect(peek.messages.status).toBe('ready');
    expect(peek.expenses.status).toBe('ready');
    expect(peek.work_orders.cloud_status).toBe('ready');
    expect(peek.work_orders.trips).toHaveLength(3);
  });

  test('a saved tenant account sees only their own rental, requests, ledger, and thread', async () => {
    await renderAs('tenant-sam');
    expect(peek.auth.role).toBe('tenant');
    expect(peek.work_orders.orders.map((order) => order.title)).toEqual(['Kitchen faucet leaking']);
    expect(peek.tenants.my_active_tenancies[0]).toMatchObject({ unit_label: 'Unit 2' });
    expect(peek.tenants.is_read_only).toBe(false);
    expect(peek.ledger.current_ledger.tenancy_id).toBe('tenancy-sam');
    expect(peek.messages.conversations).toHaveLength(1);
    // tenants have no trips, documents, or checklists of their own
    expect(peek.work_orders.cloud_status).toBe('off');
  });

  test('a former tenant is read only', async () => {
    await renderAs('tenant-morgan');
    expect(peek.tenants.is_read_only).toBe(true);
    expect(peek.ledger.is_read_only).toBe(true);
  });

  test('picking an account signs in, log out forgets it, and a deleted account goes back to Log In', async () => {
    const firebase = seededFirebase();
    render(
      <AuthProvider>
        <AuthPeek />
      </AuthProvider>,
    );
    await settle();
    expect(peek.auth.status).toBe('signed_out');
    const accounts = await peek.auth.loadTestAccounts();
    await act(async () => {
      await peek.auth.login(accounts.find((account) => account.id === 'tenant-jordan'));
    });
    expect(peek.auth.user).toMatchObject({ id: 'tenant-jordan', role: 'tenant' });
    expect(JSON.parse(await AsyncStorage.getItem('rent_well_test_account')).id).toBe(
      'tenant-jordan',
    );
    await act(async () => {
      await peek.auth.logout();
    });
    expect(peek.auth.status).toBe('signed_out');
    expect(await AsyncStorage.getItem('rent_well_test_account')).toBeNull();
    // a saved account whose record is gone (someone reset the database) opens on Log In with a note
    firebase.database.reset({ users: {} });
    await AsyncStorage.setItem(
      'rent_well_test_account',
      JSON.stringify({ id: 'tenant-jordan', role: 'tenant' }),
    );
    render(
      <AuthProvider>
        <AuthPeek />
      </AuthProvider>,
    );
    await settle();
    expect(peek.auth.status).toBe('signed_out');
    expect(peek.auth.session_expired).toBe(true);
    expect(require('../util/navigationRef').resetTo).toHaveBeenCalledWith('Login');
  });

  test('both sign ups make an account and sign in as it', async () => {
    seededFirebase();
    render(
      <AuthProvider>
        <AuthPeek />
      </AuthProvider>,
    );
    await settle();
    await act(async () => {
      await peek.auth.registerOwner({ name: 'Robin Hale', email: 'robin@example.com' });
    });
    expect(peek.auth.user).toMatchObject({ role: 'owner', name: 'Robin Hale' });
    await act(async () => {
      await peek.auth.logout();
      await peek.auth.registerTenant({
        invite_code: 'K7M2QX9P',
        email: 'casey@example.com',
        name: 'Casey Nguyen',
      });
    });
    expect(peek.auth.user).toMatchObject({ role: 'tenant', ownerId: 'owner-taylor' });
  });
});

describe('work orders', () => {
  test('a status change shows on every reader right away, then saves', async () => {
    const { firebase } = await renderAs('owner-taylor');
    const open_before = openCount(peek.work_orders.orders);
    let pending;
    act(() => {
      pending = peek.work_orders.startWorkOrder('wo-1');
    });
    expect(peek.work_orders.getOrder('wo-1').status).toBe('In Progress');
    expect(openCount(peek.work_orders.orders)).toBe(open_before - 1);
    await act(async () => {
      await pending;
    });
    expect(firebase.database.dump().workOrders['wo-1'].status).toBe('In Progress');
  });

  test('a failed change rolls back and throws so the screen can say why', async () => {
    const { firebase } = await renderAs('owner-taylor');
    firebase.fetch.fail_status = 500;
    let caught = null;
    await act(async () => {
      await peek.work_orders.setPriority('wo-1', 'Emergency').catch((error) => {
        caught = error;
      });
    });
    expect(caught.code).toBe('SERVER_ERROR');
    expect(peek.work_orders.getOrder('wo-1').priority).toBe('Normal');
  });

  test('delete removes it everywhere, and a failed delete puts it back', async () => {
    const { firebase } = await renderAs('owner-taylor');
    firebase.fetch.offline = true;
    await act(async () => {
      await peek.work_orders.deleteWorkOrder('wo-3').catch(() => {});
    });
    expect(peek.work_orders.getOrder('wo-3')).toBeTruthy();
    firebase.fetch.offline = false;
    await act(async () => {
      await peek.work_orders.deleteWorkOrder('wo-3');
    });
    expect(peek.work_orders.getOrder('wo-3')).toBeUndefined();
    expect(firebase.database.dump().workOrders['wo-3']).toBeUndefined();
  });

  test("a tenant's new request shows in the landlord's list after a refresh", async () => {
    const { firebase } = await renderAs('owner-taylor');
    const before = peek.work_orders.orders.length;
    firebase.database.handle('PUT', 'workOrders/wo-new', {
      id: 'wo-new',
      ownerId: 'owner-taylor',
      tenantUserId: 'tenant-sam',
      propertyId: 'prop-maple',
      propertyName: '123 Maple St',
      title: 'Bathroom fan rattles',
      status: 'Open',
      priority: 'Low',
      createdAt: new Date().toISOString(),
    });
    await act(async () => {
      await peek.work_orders.refreshOrders();
    });
    expect(peek.work_orders.orders.length).toBe(before + 1);
    expect(peek.work_orders.orders[0].title).toBe('Bathroom fan rattles');
  });

  test('a first load with no connection is an error state, and refresh recovers', async () => {
    const firebase = seededFirebase();
    firebase.fetch.offline = true;
    await AsyncStorage.setItem(
      'rent_well_test_account',
      JSON.stringify(firebase.database.dump().users['owner-taylor']),
    );
    render(
      <AuthProvider>
        <AccountData>
          <Peek />
        </AccountData>
      </AuthProvider>,
    );
    await settle(10);
    expect(peek.work_orders.orders_status).toBe('error');
    expect(peek.work_orders.orders_error).toMatch(/reach the database/);
    expect(peek.tenants.status).toBe('error');
    expect(peek.ledger.status).toBe('error');
    expect(peek.messages.status).toBe('error');
    firebase.fetch.offline = false;
    await act(async () => {
      await peek.work_orders.refreshOrders();
      await peek.tenants.refresh();
    });
    expect(peek.work_orders.orders_status).toBe('ready');
    expect(peek.tenants.status).toBe('ready');
  });
});

describe('expenses', () => {
  test('add shows right away and saves, delete removes it, a failed save rolls back', async () => {
    const { firebase } = await renderAs('owner-taylor');
    const before = peek.expenses.expenses.length;
    let saved;
    await act(async () => {
      saved = await peek.expenses.addExpense(null, {
        amount: 42,
        category: 'Repairs',
        date: today,
        property: '48 Cedar Ave',
        vendor: 'Hardware Hut',
      });
    });
    expect(saved).toBe(true);
    expect(peek.expenses.expenses.length).toBe(before + 1);
    const added = Object.values(firebase.database.dump().expenses).find(
      (expense) => expense.vendor === 'Hardware Hut',
    );
    expect(added.amountCents).toBe(4200);

    firebase.fetch.fail_status = 500;
    const alert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    await act(async () => {
      await peek.expenses.addExpense(null, {
        amount: 5,
        category: 'Repairs',
        date: today,
        property: '48 Cedar Ave',
      });
    });
    expect(peek.expenses.expenses.length).toBe(before + 1);
    expect(alert).toHaveBeenCalled();
    alert.mockRestore();
    firebase.fetch.fail_status = 0;

    await act(async () => {
      await peek.expenses.deleteExpense(added.id);
    });
    expect(peek.expenses.expenses.length).toBe(before);
    expect(firebase.database.dump().expenses[added.id]).toBeUndefined();
  });
});

describe('tenants and properties', () => {
  test('ending a tenancy writes in one step and the tenant becomes a former tenant', async () => {
    const { firebase } = await renderAs('owner-taylor');
    await act(async () => {
      await peek.tenants.endTenancy('tenancy-alex', { move_out_note: 'Moved' });
    });
    expect(peek.tenants.getTenantById('tenant-alex').is_active).toBe(false);
    expect(firebase.database.dump().tenancies['tenancy-alex'].status).toBe('ended');
  });

  test('a rule the change breaks throws before anything is written', async () => {
    const { firebase } = await renderAs('owner-taylor');
    const writes = () => firebase.fetch.calls.filter((call) => call.method === 'PATCH').length;
    const before = writes();
    let caught = null;
    await act(async () => {
      await peek.tenants.deleteProperty('prop-maple').catch((error) => {
        caught = error;
      });
    });
    expect(caught.code).toBe('PROPERTY_HAS_ACTIVE_TENANCY');
    expect(writes()).toBe(before);
  });

  test('a failed write puts the old list back', async () => {
    const { firebase } = await renderAs('owner-taylor');
    firebase.fetch.fail_status = 500;
    await act(async () => {
      await peek.tenants.addProperty('9 Oak Ln', '9 Oak Ln').catch(() => {});
    });
    expect(peek.tenants.properties.some((property) => property.name === '9 Oak Ln')).toBe(false);
    firebase.fetch.fail_status = 0;
    await act(async () => {
      await peek.tenants.addProperty('9 Oak Ln', '9 Oak Ln');
    });
    expect(peek.tenants.properties.some((property) => property.name === '9 Oak Ln')).toBe(true);
  });
});

describe('the rent ledger', () => {
  test('recording a payment lowers the balance and saves it', async () => {
    const { firebase } = await renderAs('owner-taylor');
    const sam_before = deriveLedger(peek.ledger.getLedger('tenancy-sam'), today);
    await act(async () => {
      await peek.ledger.recordPayment('tenancy-sam', {
        amount_cents: 10000,
        method: 'zelle',
        paid_on: today,
        applies_to: 'rent',
      });
    });
    const sam_after = deriveLedger(peek.ledger.getLedger('tenancy-sam'), today);
    expect(sam_after.balance_cents).toBe(sam_before.balance_cents - 10000);
    const saved = Object.values(firebase.database.dump().payments).filter(
      (payment) => payment.tenancyId === 'tenancy-sam' && payment.amountCents === 10000,
    );
    expect(saved).toHaveLength(1);
  });

  test('a failed write rolls the ledger back', async () => {
    const { firebase } = await renderAs('owner-taylor');
    const count = peek.ledger.getLedger('tenancy-jordan').payments.length;
    firebase.fetch.fail_status = 503;
    await act(async () => {
      await peek.ledger
        .recordPayment('tenancy-jordan', {
          amount_cents: 500,
          method: 'cash',
          paid_on: today,
          applies_to: 'rent',
        })
        .catch(() => {});
    });
    expect(peek.ledger.getLedger('tenancy-jordan').payments.length).toBe(count);
  });

  test('a tenant claims a payment and the landlord confirms it', async () => {
    const tenant = await renderAs('tenant-sam');
    let claim;
    await act(async () => {
      claim = await peek.ledger.claimPayment('tenancy-sam', {
        amount_cents: 2500,
        method: 'venmo',
        paid_on: today,
        applies_to: 'rent',
      });
    });
    expect(tenant.firebase.database.dump().payments[claim.id].status).toBe('pending_confirmation');
    const tree = tenant.firebase.database.dump();
    tenant.view.unmount();

    // the landlord's phone, reading the same database
    const { installFakeFirebase } = require('../scripts/testing/fakeFirebase');
    const landlord_db = installFakeFirebase(tree);
    await AsyncStorage.setItem(
      'rent_well_test_account',
      JSON.stringify(tree.users['owner-taylor']),
    );
    render(
      <AuthProvider>
        <AccountData>
          <Peek />
        </AccountData>
      </AuthProvider>,
    );
    await settle(10);
    expect(peek.ledger.findPayment(claim.id).payment.status).toBe('pending_confirmation');
    await act(async () => {
      await peek.ledger.confirmPayment(claim.id);
    });
    expect(landlord_db.database.dump().payments[claim.id].status).toBe('succeeded');
  });
});

describe('messages', () => {
  test('send, read, and the 8 second check only while a thread is open', async () => {
    const { firebase } = await renderAs('owner-taylor');
    expect(peek.messages.unread_total).toBeGreaterThan(0);
    await act(async () => {
      await peek.messages.sendMessage('convo-sam', 'Plumber is booked.', null);
    });
    expect(
      Object.values(firebase.database.dump().messages['convo-sam']).some(
        (message) => message.body === 'Plumber is booked.',
      ),
    ).toBe(true);
    expect(peek.messages.can_attach_photos).toBe(false);

    jest.useFakeTimers();
    const gets_before = firebase.fetch.calls.filter((call) => call.method === 'GET').length;
    act(() => peek.messages.openThread('convo-sam'));
    expect(peek.messages.is_polling()).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(thread_poll_ms);
    });
    const gets_after = firebase.fetch.calls.filter((call) => call.method === 'GET').length;
    expect(gets_after).toBeGreaterThan(gets_before);
    act(() => peek.messages.closeThread('convo-sam'));
    expect(peek.messages.is_polling()).toBe(false);
    const gets_closed = firebase.fetch.calls.filter((call) => call.method === 'GET').length;
    await act(async () => {
      jest.advanceTimersByTime(thread_poll_ms * 3);
    });
    expect(firebase.fetch.calls.filter((call) => call.method === 'GET').length).toBe(gets_closed);
  });
});

describe("the landlord's trips, documents, checklists, and settings", () => {
  test('a new trip saves, and a failed save puts the list back with a message', async () => {
    const { firebase } = await renderAs('owner-taylor');
    act(() =>
      peek.work_orders.addTrip({
        date: today,
        property: '48 Cedar Ave',
        miles: 7,
        purpose: 'Keys',
      }),
    );
    await settle();
    expect(
      Object.values(firebase.database.dump().mileage).some((trip) => trip.purpose === 'Keys'),
    ).toBe(true);
    firebase.fetch.fail_status = 500;
    act(() => peek.work_orders.deleteTrip('trip-1'));
    await settle();
    expect(peek.work_orders.trips.some((trip) => trip.id === 'trip-1')).toBe(true);
    expect(peek.work_orders.cloud_error).toMatch(/Couldn't save/);
    firebase.fetch.fail_status = 0;
    act(() => peek.work_orders.setMileageRate(0.67));
    await settle();
    expect(firebase.database.dump().ownerSettings['owner-taylor'].mileageRate).toBe(0.67);
  });
});
