import { useEffect } from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingCard from './OnboardingCard';
import DemoTourSheet, { tour_points } from './DemoTourSheet';
import { useDemoTour, demo_tour_key } from '../hooks/useDemoTour';
import EmptyState from '../../../components/ui/EmptyState';
import { ToastProvider } from '../../../components/ui/Toast';

// the card reads the account, tenants, and ledger from these, the tests set them instead of signing in
const mock_state = {
  user: { id: 'owner-1', role: 'owner' },
  tenants: { status: 'ready', properties: [], tenants: [], invites: [] },
  ledger: {
    mode: 'real',
    role: 'owner',
    status: 'ready',
    today: '2026-10-15',
    ledgers: [],
    setRentSchedule: jest.fn(() => Promise.resolve()),
  },
};
jest.mock('../../auth/context/AuthContext', () => ({
  useAuth: () => ({ user: mock_state.user }),
}));
jest.mock('../../tenants/context/TenantsContext', () => ({
  useTenants: () => mock_state.tenants,
}));
jest.mock('../../payments/context/LedgerContext', () => ({
  useLedger: () => mock_state.ledger,
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
  return { navigate: jest.fn() };
}

function renderCard(navigation) {
  return render(
    <ToastProvider>
      <OnboardingCard navigation={navigation || fakeNavigation()} />
    </ToastProvider>,
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mock_state.user = { id: 'owner-1', role: 'owner' };
  mock_state.tenants = { status: 'ready', properties: [], tenants: [], invites: [] };
  mock_state.ledger = { ...mock_state.ledger, mode: 'real', role: 'owner', ledgers: [] };
  mock_state.ledger.setRentSchedule = jest.fn(() => Promise.resolve());
});

describe('the first-run setup checklist', () => {
  test('a brand new landlord sees three steps, and Add a property opens Your Properties', async () => {
    const navigation = fakeNavigation();
    renderCard(navigation);
    await waitFor(() => expect(screen.getByText(/^Get set up/)).toBeTruthy());
    expect(screen.getByText('Add a property')).toBeTruthy();
    expect(screen.getByText('Add a property first')).toBeTruthy();
    expect(screen.getByLabelText('0 of 3 setup steps done')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Add a property, Where your rentals are'));
    expect(navigation.navigate).toHaveBeenCalledWith('Properties');
    // the later steps can't be tapped yet
    expect(screen.queryByRole('button', { name: /^Invite a tenant/ })).toBeNull();
  });

  test('with a property, Invite a tenant opens Invite a New Tenant', async () => {
    mock_state.tenants = { ...mock_state.tenants, properties: [{ id: 'p1' }] };
    const navigation = fakeNavigation();
    renderCard(navigation);
    await waitFor(() => expect(screen.getByText(/^Get set up/)).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: /^Invite a tenant/ }));
    expect(navigation.navigate).toHaveBeenCalledWith('InviteTenant');
  });

  test('Set the rent opens the existing schedule sheet and saves through the ledger', async () => {
    mock_state.tenants = {
      ...mock_state.tenants,
      properties: [{ id: 'p1' }],
      tenants: [{ id: 'u1' }],
    };
    mock_state.ledger.ledgers = [
      {
        tenancy_id: 'ten-1',
        tenancy_status: 'active',
        tenant_name: 'Tara Tenant',
        property_name: 'Maple Court',
        schedule: null,
      },
    ];
    renderCard();
    await waitFor(() => expect(screen.getByText('For Tara Tenant')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: /^Set the rent/ }));
    fireEvent.changeText(screen.getByLabelText('Monthly rent, dollars'), '1450');
    await act(async () => {
      fireEvent.press(screen.getByText('Save Schedule'));
    });
    expect(mock_state.ledger.setRentSchedule).toHaveBeenCalledWith(
      'ten-1',
      expect.objectContaining({ amount_cents: 145000, due_day: 1 }),
    );
  });

  test('hiding it for good keeps it hidden on the next launch, for this account only', async () => {
    const first = renderCard();
    await waitFor(() => expect(screen.getByText(/^Get set up/)).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('Hide this for good'));
    });
    expect(screen.queryByText(/^Get set up/)).toBeNull();
    first.unmount();
    renderCard();
    await act(async () => {});
    expect(screen.queryByText(/^Get set up/)).toBeNull();
    // a different account on the same phone still gets it
    mock_state.user = { id: 'owner-2', role: 'owner' };
    renderCard();
    await waitFor(() => expect(screen.getByText(/^Get set up/)).toBeTruthy());
  });

  test('never in the demo, never for a tenant, and gone once every step is done', async () => {
    mock_state.ledger = { ...mock_state.ledger, mode: 'demo' };
    const demo = renderCard();
    await act(async () => {});
    expect(screen.queryByText(/^Get set up/)).toBeNull();
    demo.unmount();
    mock_state.ledger = { ...mock_state.ledger, mode: 'real', role: 'tenant' };
    const tenant = renderCard();
    await act(async () => {});
    expect(screen.queryByText(/^Get set up/)).toBeNull();
    tenant.unmount();
    mock_state.ledger = {
      ...mock_state.ledger,
      role: 'owner',
      ledgers: [{ tenancy_id: 't', tenancy_status: 'active', schedule: { amount_cents: 1 } }],
    };
    mock_state.tenants = {
      ...mock_state.tenants,
      properties: [{ id: 'p' }],
      tenants: [{ id: 'u' }],
    };
    renderCard();
    await act(async () => {});
    expect(screen.queryByText(/^Get set up/)).toBeNull();
  });
});

// a tiny home that uses the hook the way the Dashboard does
function TourHost(props) {
  const tour = useDemoTour(props.auto);
  useEffect(() => {
    props.onTour(tour);
  });
  return (
    <>
      <Text>{tour.visible ? 'tour open' : 'tour closed'}</Text>
      <DemoTourSheet visible={tour.visible} role={props.role} onClose={tour.close} />
    </>
  );
}

describe('the demo tour', () => {
  test('opens by itself the first time, then never again once closed', async () => {
    let tour = null;
    const first = render(<TourHost auto role="owner" onTour={(value) => (tour = value)} />);
    await waitFor(() => expect(screen.getByText('Try the landlord side')).toBeTruthy());
    tour_points.owner.forEach((point) => expect(screen.getByText(point.text)).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('Got It'));
    });
    expect(screen.getByText('tour closed')).toBeTruthy();
    expect(await AsyncStorage.getItem(demo_tour_key)).toBe('yes');
    first.unmount();
    render(<TourHost auto role="owner" onTour={(value) => (tour = value)} />);
    await act(async () => {});
    expect(screen.getByText('tour closed')).toBeTruthy();
    // Settings can still open it on purpose
    act(() => tour.open());
    expect(screen.getByText('Try the landlord side')).toBeTruthy();
  });

  test('the tenant side gets its own four points, and real mode never opens it', async () => {
    render(<TourHost auto={false} role="tenant" onTour={() => {}} />);
    await act(async () => {});
    expect(screen.getByText('tour closed')).toBeTruthy();
    expect(tour_points.tenant).toHaveLength(4);
    expect(tour_points.owner).toHaveLength(4);
  });
});

describe('empty states', () => {
  test('a title, a sentence, and one green pill that runs the action', () => {
    const add = jest.fn();
    render(
      <EmptyState
        illustration="empty_mileage"
        title="No trips logged for 2026"
        message="Log each drive."
        action_label="Add Trip"
        onAction={add}
      />,
    );
    expect(screen.getByText('car-outline', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Add Trip' }));
    expect(add).toHaveBeenCalled();
  });
});
