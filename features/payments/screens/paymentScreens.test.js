import { useEffect } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { LedgerProvider, useLedger } from '../context/LedgerContext';
import { ToastProvider } from '../../../components/ui/Toast';
import PaymentsScreen from './PaymentsScreen';
import TenantLedgerScreen from './TenantLedgerScreen';
import PaymentDetailScreen from './PaymentDetailScreen';

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

function fakeNavigation() {
  return { navigate: jest.fn(), setOptions: jest.fn(), goBack: jest.fn() };
}

// a peek at the store from inside the providers, so a test can check what changed
// a ref-like box the test reads after each render, filled in an effect so the render stays pure
const peek = { store: null };
function Peek() {
  const value = useLedger();
  useEffect(() => {
    peek.store = value;
  });
  return null;
}

function renderScreen(element, role) {
  mock_session.demo_role = role || 'owner';
  return render(
    <LedgerProvider>
      <ToastProvider>
        <Peek />
        {element}
      </ToastProvider>
    </LedgerProvider>,
  );
}

describe('owner screens in the demo', () => {
  test('Payments and Rent shows the month, the KPIs, the claims queue, and every tenant', () => {
    renderScreen(<PaymentsScreen navigation={fakeNavigation()} />);
    expect(screen.getByText(/^Collected in /)).toBeTruthy();
    expect(screen.getByText('Overdue charges')).toBeTruthy();
    expect(screen.getByText(/^Claims to review/)).toBeTruthy();
    ['Sam Rivera', 'Priya Shah', 'Alex Chen'].forEach((name) =>
      expect(screen.getAllByText(name).length).toBeGreaterThan(0),
    );
  });

  test('confirming a claim from the list moves it out of the queue', async () => {
    renderScreen(<PaymentsScreen navigation={fakeNavigation()} />);
    expect(peek.store.findPayment('demo-pay-jordan-claim').payment.status).toBe(
      'pending_confirmation',
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText(/^Confirm \$75\.00 from Jordan Lee/));
    });
    expect(peek.store.findPayment('demo-pay-jordan-claim').payment.status).toBe('succeeded');
    expect(screen.queryByText(/^Claims to review/)).toBeNull();
  });

  test('a tenant row opens their ledger by id only', () => {
    const navigation = fakeNavigation();
    renderScreen(<PaymentsScreen navigation={navigation} />);
    fireEvent.press(screen.getByLabelText(/^Sam Rivera, 123 Maple St, Unit 2/));
    expect(navigation.navigate).toHaveBeenCalledWith('TenantLedger', {
      tenancyId: 'demo-tenancy-sam',
    });
  });

  test('the Rent Ledger shows the balance, actions, and months', () => {
    const navigation = fakeNavigation();
    renderScreen(
      <TenantLedgerScreen
        navigation={navigation}
        route={{ params: { tenancyId: 'demo-tenancy-sam' } }}
      />,
    );
    expect(screen.getByText('Record Payment')).toBeTruthy();
    // the Hearth pass moved Add Charge and the rent schedule into the More sheet
    fireEvent.press(screen.getByText('More'));
    expect(screen.getByText('Add Charge')).toBeTruthy();
    expect(screen.getByText('Edit Rent Schedule')).toBeTruthy();
    expect(screen.getByText('Void a Charge or Payment')).toBeTruthy();
    expect(screen.getByText(/is overdue across/)).toBeTruthy();
    expect(navigation.setOptions).toHaveBeenCalled();
  });

  test('an unknown tenancy shows not found instead of crashing', () => {
    renderScreen(
      <TenantLedgerScreen
        navigation={fakeNavigation()}
        route={{ params: { tenancyId: 'nope' } }}
      />,
    );
    expect(screen.getByText('Ledger not found')).toBeTruthy();
  });

  test('Payment Detail shows the record, timeline, and owner actions', () => {
    renderScreen(
      <PaymentDetailScreen
        navigation={fakeNavigation()}
        route={{ params: { paymentId: 'demo-pay-jordan-claim' } }}
      />,
    );
    expect(screen.getByText('Timeline')).toBeTruthy();
    expect(screen.getByText('Tenant said they paid')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Share Receipt')).toBeTruthy();
  });
});

describe('tenant screens in the demo', () => {
  test('Payments and Rent shows what is due, how to pay, and the I Paid button', () => {
    renderScreen(<PaymentsScreen navigation={fakeNavigation()} />, 'tenant');
    expect(screen.getByText('You owe')).toBeTruthy();
    expect(screen.getByText('I Paid')).toBeTruthy();
    expect(screen.getByText(/^How to pay/)).toBeTruthy();
    expect(screen.getByText(/Zelle to rentals@example.com/)).toBeTruthy();
    // the rejected claim shows the landlord's reason
    expect(screen.getByText(/Your landlord said: Nothing came in on Venmo/)).toBeTruthy();
    // the tenant only ever sees their own ledger
    expect(screen.queryByText('Jordan Lee')).toBeNull();
  });

  test('copying the instructions puts them on the clipboard', async () => {
    const Clipboard = require('expo-clipboard');
    renderScreen(<PaymentsScreen navigation={fakeNavigation()} />, 'tenant');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Copy the payment instructions'));
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('rentals@example.com'),
    );
  });

  test('Payment Detail is read only for the tenant', () => {
    renderScreen(
      <PaymentDetailScreen
        navigation={fakeNavigation()}
        route={{ params: { paymentId: 'demo-pay-sam-rejected' } }}
      />,
      'tenant',
    );
    expect(screen.getByText(/^Rejected: /)).toBeTruthy();
    expect(screen.queryByText('Confirm')).toBeNull();
    expect(screen.queryByText('Void Payment')).toBeNull();
    expect(screen.getByText('Share Receipt')).toBeTruthy();
  });
});
