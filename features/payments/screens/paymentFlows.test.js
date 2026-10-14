import { useEffect } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import { LedgerProvider, useLedger } from '../context/LedgerContext';
import { ToastProvider } from '../../../components/ui/Toast';
import PaymentsScreen from './PaymentsScreen';
import TenantLedgerScreen from './TenantLedgerScreen';
import PaymentFormModal from '../components/PaymentFormModal';
import ChargeFormModal from '../components/ChargeFormModal';
import ScheduleFormModal from '../components/ScheduleFormModal';
import ReasonModal from '../components/ReasonModal';
import InstructionsModal from '../components/InstructionsModal';
import { deriveLedger } from '../utils/ledgerMath';
import { ledger_vectors } from '../utils/ledgerVectors';
import { fromApiLedger } from '../utils/ledgerApi';

// the screens read the mode and role from these two, so the tests set them here instead of signing in
const mock_session = { user: null, demo_mode: true, demo_role: 'owner' };
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
// real mode talks to these, the tests answer for the server
const mock_api = { ledgers: [], calls: [] };
jest.mock('../../../services/api', () => ({
  getLedgers: jest.fn(() => Promise.resolve(mock_api.ledgers)),
  getLedger: jest.fn(),
  getPayment: jest.fn(),
  createPayment: jest.fn((tenancy_id, body) => {
    mock_api.calls.push({ tenancy_id, body });
    const ledger = mock_api.ledgers.find((item) => item.tenancyId === tenancy_id);
    const saved = {
      ...ledger,
      payments: [
        ...ledger.payments,
        { id: 'server-pay-1', status: 'confirmed', source: 'owner', events: [], ...body },
      ],
    };
    return Promise.resolve(saved);
  }),
  confirmPayment: jest.fn(),
  rejectPayment: jest.fn(),
  voidPayment: jest.fn(),
  addCharge: jest.fn(),
  voidCharge: jest.fn(),
  setRentSchedule: jest.fn(),
  updateProperty: jest.fn(),
  uploadImage: jest.fn(),
}));
jest.mock('../../../services/socket', () => ({ onSocketEvent: () => () => {} }));
jest.mock('../../../services/push', () => ({ listenForLedgerTaps: () => () => {} }));

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

function Providers(props) {
  return (
    <LedgerProvider>
      <ToastProvider>
        <Peek />
        {props.children}
      </ToastProvider>
    </LedgerProvider>
  );
}

function samBalance() {
  const sam = peek.store.ledgers.find((ledger) => ledger.tenancy_id === 'demo-tenancy-sam');
  return deriveLedger(sam, peek.store.today).balance_cents;
}

beforeEach(() => {
  mock_session.user = null;
  mock_session.demo_mode = true;
  mock_session.demo_role = 'owner';
});

describe('every form renders and checks its fields', () => {
  const noop = () => Promise.resolve();
  const today = '2026-10-14';

  test('Record Payment and I Paid', () => {
    const record = render(
      <PaymentFormModal visible today={today} place="Sam" onSubmit={noop} onClose={noop} />,
    );
    expect(record.getByText('Record Payment')).toBeTruthy();
    expect(record.getByText('This is a refund')).toBeTruthy();
    record.unmount();
    const claim = render(
      <PaymentFormModal visible is_claim today={today} onSubmit={noop} onClose={noop} />,
    );
    expect(claim.getByText('I Paid')).toBeTruthy();
    // a tenant can't record a refund
    expect(claim.queryByText('This is a refund')).toBeNull();
    fireEvent.press(claim.getByText('Send'));
    expect(claim.getByText('Enter an amount like 1200 or 1200.50.')).toBeTruthy();
  });

  test('Add Charge fills the description from the kind', () => {
    const view = render(<ChargeFormModal visible today={today} onSubmit={noop} onClose={noop} />);
    fireEvent.press(view.getByText('Security deposit'));
    expect(view.getByDisplayValue('Security deposit')).toBeTruthy();
    fireEvent.press(view.getAllByText('Add Charge')[1]);
    expect(view.getByText('Enter an amount like 1200 or 1200.50.')).toBeTruthy();
  });

  test('Rent Schedule starts next month and turns away day 31', () => {
    const view = render(<ScheduleFormModal visible today={today} onSubmit={noop} onClose={noop} />);
    fireEvent.changeText(view.getByLabelText('Monthly rent, dollars'), '1450');
    fireEvent.changeText(view.getByLabelText('Due day of the month'), '31');
    fireEvent.press(view.getByText('Save Schedule'));
    expect(view.getByText('Pick a day from 1 to 28 so every month has it.')).toBeTruthy();
  });

  test('Reason and Payment Instructions', () => {
    const reason = render(
      <ReasonModal
        visible
        title="Reject Claim"
        submit_label="Reject"
        onSubmit={noop}
        onClose={noop}
      />,
    );
    fireEvent.press(reason.getByText('Reject'));
    expect(reason.getByText('Give a short reason (at least 3 characters).')).toBeTruthy();
    reason.unmount();
    const instructions = render(
      <InstructionsModal
        visible
        property_name="123 Maple St"
        value="Zelle"
        onSubmit={noop}
        onClose={noop}
      />,
    );
    expect(instructions.getByDisplayValue('Zelle')).toBeTruthy();
  });
});

describe('the demo story, end to end', () => {
  test('the tenant claims, the landlord confirms, and the balance drops', async () => {
    mock_session.demo_role = 'tenant';
    const view = render(
      <Providers>
        <PaymentsScreen navigation={fakeNavigation()} />
      </Providers>,
    );
    const before = samBalance();
    fireEvent.press(screen.getByText('I Paid'));
    fireEvent.changeText(screen.getByLabelText('Amount, dollars'), '500');
    await act(async () => {
      fireEvent.press(screen.getByText('Send'));
    });
    // the section header and the claim's own pill both say it
    expect(screen.getAllByText(/^Waiting for confirmation/).length).toBeGreaterThan(1);
    // a claim never moves the balance by itself
    expect(samBalance()).toBe(before);

    // same demo, now the landlord's side: the providers stay, only the role changes
    mock_session.demo_role = 'owner';
    view.rerender(
      <Providers>
        <PaymentsScreen navigation={fakeNavigation()} />
      </Providers>,
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText(/^Confirm \$500\.00 from Sam Rivera/));
    });
    expect(samBalance()).toBe(before - 50000);
  });

  test('the landlord records a payment from the Rent Ledger', async () => {
    render(
      <Providers>
        <TenantLedgerScreen
          navigation={fakeNavigation()}
          route={{ params: { tenancyId: 'demo-tenancy-sam' } }}
        />
      </Providers>,
    );
    const before = samBalance();
    fireEvent.press(screen.getByText('Record Payment'));
    fireEvent.changeText(screen.getByLabelText('Amount, dollars'), '1,234.56');
    fireEvent.press(screen.getByText('Check'));
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(samBalance()).toBe(before - 123456);
    expect(screen.getByText('Payment of $1,234.56 recorded')).toBeTruthy();
  });

  test('a schedule change keeps rent already charged', async () => {
    render(
      <Providers>
        <TenantLedgerScreen
          navigation={fakeNavigation()}
          route={{ params: { tenancyId: 'demo-tenancy-alex' } }}
        />
      </Providers>,
    );
    const alex = () =>
      peek.store.ledgers.find((ledger) => ledger.tenancy_id === 'demo-tenancy-alex');
    const charged = alex().charges.filter((charge) => charge.kind === 'rent').length;
    // the Hearth pass moved the rent schedule into the More sheet
    fireEvent.press(screen.getByText('More'));
    fireEvent.press(screen.getByText('Edit Rent Schedule'));
    fireEvent.changeText(screen.getByLabelText('Monthly rent, dollars'), '1050');
    await act(async () => {
      fireEvent.press(screen.getByText('Save Schedule'));
    });
    expect(alex().schedule.amount_cents).toBe(105000);
    const rent = alex().charges.filter((charge) => charge.kind === 'rent');
    expect(rent.length).toBe(charged);
    expect(rent.every((charge) => charge.amount_cents === 98000)).toBe(true);
    expect(screen.getByText(/^\$1,050\.00 a month/)).toBeTruthy();
  });
});

// the server's camelCase copy of a vector, so real mode can be tested on the same numbers
function toApi(ledger) {
  return {
    tenancyId: ledger.tenancy_id,
    tenancyStatus: ledger.tenancy_status || 'active',
    tenantId: 'u-' + ledger.tenancy_id,
    tenantName: 'Vector Tenant',
    propertyId: 'p-1',
    propertyName: '1 Test St',
    unitLabel: '',
    paymentInstructions: 'Zelle to test@example.com',
    schedule: ledger.schedule
      ? {
          amountCents: ledger.schedule.amount_cents,
          dueDay: ledger.schedule.due_day,
          graceDays: ledger.schedule.grace_days,
          lateFeeCents: ledger.schedule.late_fee_cents,
          startDate: ledger.schedule.start_date,
        }
      : null,
    charges: ledger.charges.map((charge) => ({
      id: charge.id,
      kind: charge.kind,
      description: charge.description,
      amountCents: charge.amount_cents,
      dueDate: charge.due_date,
      createdAt: charge.created_at,
      voidedAt: charge.voided_at,
      voidReason: charge.void_reason,
    })),
    payments: ledger.payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amount_cents,
      method: payment.method,
      paidOn: payment.paid_on,
      appliesTo: payment.applies_to,
      isRefund: payment.is_refund,
      status: payment.status,
      source: payment.source,
      createdAt: payment.created_at,
      events: [],
    })),
  };
}

describe('real mode with the server mocked', () => {
  test('the same vectors give the same numbers after the trip through the API shape', () => {
    ledger_vectors.forEach((vector) => {
      const round_trip = fromApiLedger(toApi(vector.ledger));
      const derived = deriveLedger(round_trip, vector.today);
      expect(derived.balance_cents).toBe(vector.expect.balance_cents);
      expect(derived.row_status).toBe(vector.expect.row_status);
    });
  });

  test('an owner sees the server ledgers and a recorded payment goes to the API in cents', async () => {
    mock_session.demo_mode = false;
    mock_session.user = { id: 'owner-1', role: 'owner' };
    mock_api.ledgers = [toApi(ledger_vectors[0].ledger)];
    mock_api.calls = [];
    render(
      <Providers>
        <TenantLedgerScreen
          navigation={fakeNavigation()}
          route={{ params: { tenancyId: ledger_vectors[0].ledger.tenancy_id } }}
        />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText('Record Payment')).toBeTruthy());
    expect(peek.store.mode).toBe('real');
    fireEvent.press(screen.getByText('Record Payment'));
    fireEvent.changeText(screen.getByLabelText('Amount, dollars'), '12.30');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(mock_api.calls[0].body).toMatchObject({ amountCents: 1230, isRefund: false });
  });

  test('a tenant in real mode gets the claim button and the server instructions', async () => {
    mock_session.demo_mode = false;
    mock_session.user = { id: 'tenant-1', role: 'tenant' };
    mock_api.ledgers = [toApi(ledger_vectors[1].ledger)];
    render(
      <Providers>
        <PaymentsScreen navigation={fakeNavigation()} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText('I Paid')).toBeTruthy());
    expect(screen.getByText('Zelle to test@example.com')).toBeTruthy();
  });

  test('a former tenant in real mode gets history and no claim button', async () => {
    mock_session.demo_mode = false;
    mock_session.user = { id: 'tenant-2', role: 'tenant' };
    mock_api.ledgers = [{ ...toApi(ledger_vectors[0].ledger), tenancyStatus: 'ended' }];
    render(
      <Providers>
        <PaymentsScreen navigation={fakeNavigation()} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText(/this is read-only/)).toBeTruthy());
    expect(screen.queryByText('I Paid')).toBeNull();
  });
});
