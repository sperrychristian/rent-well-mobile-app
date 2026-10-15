import { useEffect } from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LedgerProvider, useLedger } from '../context/LedgerContext';
import { ToastProvider } from '../../../components/ui/Toast';
import PaymentsScreen from './PaymentsScreen';
import TenantLedgerScreen from './TenantLedgerScreen';
import PaymentDetailScreen from './PaymentDetailScreen';
import { apiLedger, apiPayment, apiSummary } from '../utils/ledgerApiFixtures';

// real mode against a pretend server: every route in docs/API.md's Rent ledger section is mocked with
// the real request and response shapes, and the pretend server changes its rows the way the real one does

const mock_session = {
  user: { id: 'owner-1', role: 'owner' },
  demo_mode: false,
  demo_role: 'owner',
};
jest.mock('../../auth/context/AuthContext', () => ({
  useAuth: () => ({ user: mock_session.user }),
}));
jest.mock('../../../context/WorkOrdersContext', () => ({
  useWorkOrders: () => ({
    demo_mode: mock_session.demo_mode,
    demo_role: mock_session.demo_role,
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const { createContext } = require('react');
  return {
    useSafeAreaInsets: () => insets,
    SafeAreaInsetsContext: createContext(insets),
  };
});
jest.mock('../../../services/socket', () => ({ onSocketEvent: () => () => {} }));
jest.mock('../../../services/push', () => ({ listenForLedgerTaps: () => () => {} }));

// the pretend server, the mocked routes read and change this
const mock_server = { ledger: null, summary: null, calls: [], offline: false };

jest.mock('../../../services/api', () => {
  const { ApiError } = require('../../../services/apiHelpers');
  const fixtures = require('../utils/ledgerApiFixtures');
  const record = (name, ...args) => mock_server.calls.push({ name, args });
  const offline = () =>
    mock_server.offline
      ? Promise.reject(new ApiError(0, 'NETWORK_ERROR', "Can't reach the server."))
      : null;
  const paymentById = (id) => mock_server.ledger.payments.find((payment) => payment.id === id);
  return {
    getTenants: jest.fn(() => offline() || Promise.resolve(fixtures.apiTenants())),
    getTenancyLedger: jest.fn((id) => {
      record('getTenancyLedger', id);
      return offline() || Promise.resolve(mock_server.ledger);
    }),
    getMyLedgers: jest.fn(() => offline() || Promise.resolve([mock_server.ledger])),
    getLedgerSummary: jest.fn((month) => {
      record('getLedgerSummary', month);
      return offline() || Promise.resolve(mock_server.summary);
    }),
    getPayment: jest.fn((id) =>
      Promise.resolve({
        payment: paymentById(id),
        events: [
          {
            id: 'e1',
            type: 'claimed',
            fromStatus: null,
            toStatus: 'pending_confirmation',
            actorUserId: 'tenant-1',
            data: {},
            createdAt: '2026-10-13T18:00:00.000Z',
          },
        ],
        receipt:
          paymentById(id).status === 'succeeded' ? { receiptNumber: 'RW-20261013-ABCD1234' } : null,
      }),
    ),
    createPayment: jest.fn((tenancy_id, body) => {
      record('createPayment', tenancy_id, body);
      const payment = fixtures.apiPayment('pay-new', {
        kind: body.kind,
        amountCents: body.amountCents,
        method: body.method,
        paidOn: body.paidOn,
        createdAt: '2026-10-14T18:00:00.000Z',
      });
      mock_server.ledger.payments = [payment, ...mock_server.ledger.payments];
      mock_server.ledger.balances = {
        ...mock_server.ledger.balances,
        rentBalanceCents: mock_server.ledger.balances.rentBalanceCents - body.amountCents,
      };
      return Promise.resolve(payment);
    }),
    claimPayment: jest.fn((body) => {
      record('claimPayment', body);
      const payment = fixtures.apiPayment('pay-claim-2', {
        amountCents: body.amountCents,
        method: body.method,
        paidOn: body.paidOn,
        status: 'pending_confirmation',
        countsTowardBalance: false,
        submittedBy: 'tenant',
        allocation: null,
        createdAt: '2026-10-14T19:00:00.000Z',
      });
      mock_server.ledger.payments = [payment, ...mock_server.ledger.payments];
      return Promise.resolve(payment);
    }),
    confirmPayment: jest.fn((id) => {
      record('confirmPayment', id);
      const payment = paymentById(id);
      payment.status = 'succeeded';
      payment.countsTowardBalance = true;
      mock_server.ledger.balances = {
        ...mock_server.ledger.balances,
        rentBalanceCents: mock_server.ledger.balances.rentBalanceCents - payment.amountCents,
        pendingConfirmationCents: 0,
      };
      return Promise.resolve(payment);
    }),
    rejectPayment: jest.fn((id, reason) => {
      record('rejectPayment', id, reason);
      const payment = paymentById(id);
      payment.status = 'rejected';
      payment.rejectReason = reason;
      return Promise.resolve(payment);
    }),
    voidPayment: jest.fn((id, reason) => {
      record('voidPayment', id, reason);
      const payment = paymentById(id);
      payment.status = 'voided';
      payment.countsTowardBalance = false;
      payment.voidReason = reason;
      return Promise.resolve(payment);
    }),
    addCharge: jest.fn((tenancy_id, body) => {
      record('addCharge', tenancy_id, body);
      return Promise.resolve(fixtures.apiCharge('c-new', body));
    }),
    voidCharge: jest.fn((id, reason) => {
      record('voidCharge', id, reason);
      return Promise.resolve(fixtures.apiCharge(id, { status: 'voided', voidReason: reason }));
    }),
    setRentSchedule: jest.fn((tenancy_id, body) => {
      record('setRentSchedule', tenancy_id, body);
      mock_server.ledger.schedule = fixtures.apiSchedule({ ...body, id: 'sched-2' });
      return Promise.resolve(mock_server.ledger.schedule);
    }),
    updateProperty: jest.fn(() => Promise.resolve({})),
    uploadImage: jest.fn(() => Promise.resolve('attachments/u/receipt.jpg')),
  };
});

function fakeNavigation() {
  return { navigate: jest.fn(), setOptions: jest.fn(), goBack: jest.fn() };
}

// a peek at the store from inside the providers, filled in an effect so the render stays pure
const peek = { store: null };
function Peek() {
  const value = useLedger();
  useEffect(() => {
    peek.store = value;
  });
  return null;
}

function renderReal(element, role) {
  mock_session.user =
    role === 'tenant' ? { id: 'tenant-1', role: 'tenant' } : { id: 'owner-1', role: 'owner' };
  return render(
    <LedgerProvider>
      <ToastProvider>
        <Peek />
        {element}
      </ToastProvider>
    </LedgerProvider>,
  );
}

function callsTo(name) {
  return mock_server.calls.filter((call) => call.name === name);
}

beforeEach(async () => {
  mock_server.ledger = apiLedger();
  mock_server.summary = apiSummary();
  mock_server.calls = [];
  mock_server.offline = false;
  await AsyncStorage.clear();
});

describe('owner, real mode', () => {
  test('loads every tenancy ledger and the month summary, and shows the server numbers', async () => {
    renderReal(<PaymentsScreen navigation={fakeNavigation()} />);
    await waitFor(() => expect(screen.getAllByText('Tara Tenant').length).toBeGreaterThan(0));
    expect(callsTo('getTenancyLedger').map((call) => call.args[0])).toEqual(['ten-1']);
    expect(callsTo('getLedgerSummary').length).toBeGreaterThan(0);
    // the server's own balance and claim, nothing worked out on the phone
    expect(peek.store.ledgers[0].server.balance_cents).toBe(120000);
    expect(screen.getByText(/^Claims to review/)).toBeTruthy();
    expect(screen.getByText(/\$1,200\.00 due/)).toBeTruthy();
    // the server's overdue count, from GET /ledger/summary
    await waitFor(() => expect(screen.getByText('Overdue charges')).toBeTruthy());
  });

  test('records a payment with the real body, then refetches the ledger', async () => {
    renderReal(
      <TenantLedgerScreen
        navigation={fakeNavigation()}
        route={{ params: { tenancyId: 'ten-1' } }}
      />,
    );
    await waitFor(() => expect(screen.getByText('Record Payment')).toBeTruthy());
    const fetches = callsTo('getTenancyLedger').length;
    fireEvent.press(screen.getByText('Record Payment'));
    fireEvent.changeText(screen.getByLabelText('Amount, dollars'), '12.30');
    fireEvent.changeText(screen.getByLabelText('Reference'), 'ZL-8812');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    const body = callsTo('createPayment')[0].args[1];
    expect(callsTo('createPayment')[0].args[0]).toBe('ten-1');
    expect(body).toMatchObject({
      kind: 'payment',
      appliesTo: 'rent',
      amountCents: 1230,
      method: 'zelle',
      paidOn: '2026-10-14',
      reference: 'ZL-8812',
    });
    expect(body.idempotencyKey.length).toBeGreaterThanOrEqual(8);
    expect(body).not.toHaveProperty('isRefund');
    expect(callsTo('getTenancyLedger').length).toBeGreaterThan(fetches);
    expect(peek.store.getLedger('ten-1').server.balance_cents).toBe(118770);
  });

  test('confirms a claim from the Payments list', async () => {
    renderReal(<PaymentsScreen navigation={fakeNavigation()} />);
    await waitFor(() => expect(screen.getByText(/^Claims to review/)).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByLabelText(/^Confirm \$75\.00 from Tara Tenant/));
    });
    expect(callsTo('confirmPayment')[0].args).toEqual(['pay-claim']);
    await waitFor(() => expect(screen.queryByText(/^Claims to review/)).toBeNull());
    expect(peek.store.findPayment('pay-claim').payment.status).toBe('succeeded');
  });

  test('rejects a claim with a reason', async () => {
    renderReal(<PaymentsScreen navigation={fakeNavigation()} />);
    await waitFor(() => expect(screen.getByText(/^Claims to review/)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(/^Reject \$75\.00 from Tara Tenant/));
    fireEvent.changeText(screen.getByLabelText('Reason'), 'Nothing arrived in Venmo');
    await act(async () => {
      fireEvent.press(screen.getAllByText('Reject').slice(-1)[0]);
    });
    expect(callsTo('rejectPayment')[0].args).toEqual(['pay-claim', 'Nothing arrived in Venmo']);
    expect(peek.store.findPayment('pay-claim').payment.status).toBe('rejected');
  });

  test('voids a confirmed payment from Payment Detail after the reason and the are-you-sure', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      buttons.find((button) => button.style === 'destructive').onPress();
    });
    renderReal(
      <PaymentDetailScreen
        navigation={fakeNavigation()}
        route={{ params: { paymentId: 'pay-sep' } }}
      />,
    );
    await waitFor(() => expect(screen.getByText('Void Payment')).toBeTruthy());
    // the timeline and the receipt number come from GET /payments/:id
    await waitFor(() => expect(screen.getByText('RW-20261013-ABCD1234')).toBeTruthy());
    fireEvent.press(screen.getByText('Void Payment'));
    fireEvent.changeText(screen.getByLabelText('Reason'), 'Entered twice');
    await act(async () => {
      fireEvent.press(screen.getAllByText('Void Payment').slice(-1)[0]);
    });
    expect(callsTo('voidPayment')[0].args).toEqual(['pay-sep', 'Entered twice']);
    alert.mockRestore();
  });

  test('a schedule change sends the real body (startsOn, cents) and refetches', async () => {
    renderReal(
      <TenantLedgerScreen
        navigation={fakeNavigation()}
        route={{ params: { tenancyId: 'ten-1' } }}
      />,
    );
    await waitFor(() => expect(screen.getByText('More')).toBeTruthy());
    fireEvent.press(screen.getByText('More'));
    fireEvent.press(screen.getByText('Edit Rent Schedule'));
    fireEvent.changeText(screen.getByLabelText('Monthly rent, dollars'), '1250');
    await act(async () => {
      fireEvent.press(screen.getByText('Save Schedule'));
    });
    expect(callsTo('setRentSchedule')[0].args).toEqual([
      'ten-1',
      { amountCents: 125000, dueDay: 1, graceDays: 5, lateFeeCents: 5000, startsOn: '2026-08-01' },
    ]);
    await waitFor(() => expect(screen.getByText(/^\$1,250\.00 a month/)).toBeTruthy());
  });

  test('offline: the last saved ledger shows with the offline note', async () => {
    const first = renderReal(<PaymentsScreen navigation={fakeNavigation()} />);
    await waitFor(() => expect(screen.getAllByText('Tara Tenant').length).toBeGreaterThan(0));
    // let the cache save land
    await act(async () => {});
    first.unmount();
    mock_server.offline = true;
    renderReal(<PaymentsScreen navigation={fakeNavigation()} />);
    await waitFor(() => expect(screen.getByText(/Showing the last saved ledger/)).toBeTruthy());
    expect(screen.getAllByText('Tara Tenant').length).toBeGreaterThan(0);
    expect(screen.queryByText(/isn't on the server yet/)).toBeNull();
  });

  test('a failed first load with nothing saved shows the normal error state', async () => {
    mock_server.offline = true;
    renderReal(<PaymentsScreen navigation={fakeNavigation()} />);
    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeTruthy());
    expect(screen.getByText(/Can't reach the server/)).toBeTruthy();
  });
});

describe('tenant, real mode', () => {
  test('loads GET /me/ledger, shows the instructions, and a claim goes to POST /me/payments', async () => {
    renderReal(<PaymentsScreen navigation={fakeNavigation()} />, 'tenant');
    await waitFor(() => expect(screen.getByText('I Paid')).toBeTruthy());
    expect(screen.getByText('Zelle to owner@example.com')).toBeTruthy();
    fireEvent.press(screen.getByText('I Paid'));
    fireEvent.changeText(screen.getByLabelText('Amount, dollars'), '500');
    await act(async () => {
      fireEvent.press(screen.getByText('Send'));
    });
    const body = callsTo('claimPayment')[0].args[0];
    expect(body).toMatchObject({
      tenancyId: 'ten-1',
      appliesTo: 'rent',
      amountCents: 50000,
      method: 'zelle',
      paidOn: '2026-10-14',
    });
    // no kind on the tenant route, tenants can't refund
    expect(body).not.toHaveProperty('kind');
    await waitFor(() =>
      expect(screen.getAllByText(/^Waiting for confirmation/).length).toBeGreaterThan(0),
    );
  });

  test('an ended tenancy is read only: history, no I Paid', async () => {
    mock_server.ledger = apiLedger({ isActive: false });
    renderReal(<PaymentsScreen navigation={fakeNavigation()} />, 'tenant');
    await waitFor(() => expect(screen.getByText(/this is read-only/)).toBeTruthy());
    expect(screen.queryByText('I Paid')).toBeNull();
  });

  test('a provider status the demo never makes still reads right', async () => {
    mock_server.ledger = apiLedger({
      payments: [
        apiPayment('pay-fail', {
          status: 'failed',
          countsTowardBalance: false,
          failureReason: 'Insufficient funds',
          paidOn: '2026-10-10',
          allocation: null,
        }),
      ],
    });
    renderReal(<PaymentsScreen navigation={fakeNavigation()} />, 'tenant');
    await waitFor(() => expect(screen.getByText('Failed: Insufficient funds')).toBeTruthy());
  });
});
