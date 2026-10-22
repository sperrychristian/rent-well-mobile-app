import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { ToastProvider } from '../components/ui/Toast';
import ProfitScreen from './profit/screens/ProfitScreen';
import ReminderSheet from './reminders/components/ReminderSheet';
import TenantLeaseScreen from './tenants/screens/TenantLeaseScreen';
import LeasesScreen from './leases/screens/LeasesScreen';
import { fromApiTenant } from './tenants/utils/tenantHelpers';
import * as api from '../services/api';

// the new screens and the reminder sheet for a real landlord, with the routes mocked as docs/API.md answers

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const { createContext } = require('react');
  return { useSafeAreaInsets: () => insets, SafeAreaInsetsContext: createContext(insets) };
});
jest.mock('../services/socket', () => ({ onSocketEvent: () => () => {} }));
jest.mock('../services/api', () => ({
  getProfitReport: jest.fn(),
  getTaxSummary: jest.fn(),
  getTaxSummaryCsv: jest.fn(),
  getReminderPreview: jest.fn(),
  sendReminder: jest.fn(),
}));
jest.mock('./expenses/context/ExpensesContext', () => ({
  useExpenses: () => ({ is_remote: true, expenses: [] }),
}));
jest.mock('./payments/context/LedgerContext', () => ({
  useLedger: () => ({
    ledgers: [],
    today: '2026-10-22',
    getLedger: () => null,
    instructionsFor: () => '',
  }),
}));
jest.mock('./messages/context/MessagesContext', () => ({
  useMessages: () => ({ addReminderMessage: jest.fn() }),
}));
jest.mock('../context/WorkOrdersContext', () => ({
  useLocalWorkOrders: () => ({ demo_tenant_data: null, setDemoTenantData: jest.fn() }),
}));

// one real tenant from GET /tenants with the seed's 25 day lease
const api_tenant = {
  id: 'u-tara',
  name: 'Tara Tenant',
  email: 'tara@example.com',
  isActive: true,
  activeTenancies: [
    {
      id: 't-tara',
      tenantId: 'u-tara',
      property: { id: 'p-maple', name: 'Maple Court', address: '12 Maple St' },
      unitLabel: 'Unit 2B',
      status: 'active',
      startedAt: '2025-11-01T15:00:00.000Z',
      endedAt: null,
      moveOutNote: null,
      lease: {
        leaseStartOn: '2025-11-17',
        leaseEndOn: '2026-11-16',
        leaseTerm: 'fixed',
        renewalNoticeDays: 60,
        daysRemaining: 25,
        leaseStatus: 'expiring_soon',
        leaseNotes: 'Wants to renew',
      },
    },
  ],
  endedTenancies: [],
  openWorkOrderCount: 0,
  conversationId: 'c-tara',
};
const tenant = fromApiTenant(api_tenant);
const mock_tenants = {
  is_demo: false,
  status: 'ready',
  tenants: [tenant],
  properties: [{ id: 'p-maple', name: 'Maple Court' }],
  refresh: jest.fn(),
  refreshing: false,
  getTenantById: () => tenant,
  findTenancy: (tenancy_id) =>
    tenancy_id === 't-tara' ? { tenant, tenancy: tenant.active_tenancies[0] } : null,
  fetchLease: jest.fn(() =>
    Promise.resolve({
      events: [
        {
          id: 'ev1',
          type: 'set',
          data: { after: { leaseTerm: 'fixed', leaseEndOn: '2026-11-16' } },
          created_at: '2025-11-01T00:00:00.000Z',
        },
      ],
    }),
  ),
  setLease: jest.fn(),
  renewLease: jest.fn(),
};
jest.mock('./tenants/context/TenantsContext', () => ({ useTenants: () => mock_tenants }));

async function settle() {
  for (let index = 0; index < 3; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const navigation = { navigate: jest.fn(), addListener: () => () => {}, setOptions: jest.fn() };

const month = (number, rent, expenses) => ({
  month: '2026-' + String(number).padStart(2, '0'),
  rentCollectedCents: rent,
  expensesCents: expenses,
  netCents: rent - expenses,
});
const row = (rent, expenses) => ({
  rentCollectedCents: rent,
  expensesCents: expenses,
  netCents: rent - expenses,
  months: Array.from({ length: 12 }, (_, index) =>
    month(index + 1, index === 9 ? rent : 0, index === 9 ? expenses : 0),
  ),
});

beforeEach(() => jest.clearAllMocks());

describe('Profit for a real landlord', () => {
  test('the server report shows, and a new year asks the server again', async () => {
    api.getProfitReport.mockResolvedValue({
      year: 2026,
      propertyId: null,
      properties: [{ property: { id: 'p-maple', name: 'Maple Court' }, ...row(2900000, 812000) }],
      general: row(0, 34200),
      total: row(2900000, 846200),
    });
    render(
      <ToastProvider>
        <ProfitScreen />
      </ToastProvider>,
    );
    await settle();
    const this_year = String(new Date().getFullYear());
    expect(api.getProfitReport).toHaveBeenCalledWith(Number(this_year), undefined);
    expect(screen.getByText('$20,538.00')).toBeTruthy();
    expect(screen.getByText('Maple Court')).toBeTruthy();
    expect(screen.getByText('General (no property)')).toBeTruthy();
    fireEvent.press(screen.getByText(String(Number(this_year) - 1)));
    await settle();
    expect(api.getProfitReport).toHaveBeenLastCalledWith(Number(this_year) - 1, undefined);
  });
});

describe('the reminder sheet for a real landlord', () => {
  test('the server preview fills the text, and a too-soon send says when', async () => {
    api.getReminderPreview.mockResolvedValue({
      kind: 'friendly',
      messageText:
        'Hi Tara, just a friendly reminder that your balance of $1,450.00 was due October 1.',
      amountCents: 145000,
      chargeId: 'ch1',
      dueOn: '2026-10-01',
      lastReminderAt: '2026-10-20T16:04:00.000Z',
      canSendNow: true,
      canSendAt: null,
    });
    const too_soon = Object.assign(new Error('You can send one reminder every 24 hours.'), {
      code: 'REMINDER_TOO_SOON',
      info: { canSendAt: '2026-10-23T16:04:00.000Z' },
    });
    api.sendReminder.mockRejectedValue(too_soon);
    render(
      <ToastProvider>
        <ReminderSheet
          visible
          tenancy_id="t-tara"
          tenant_name="Tara Tenant"
          place="Maple Court"
          onClose={jest.fn()}
        />
      </ToastProvider>,
    );
    await settle();
    expect(api.getReminderPreview).toHaveBeenCalledWith('t-tara', 'friendly');
    expect(screen.getByDisplayValue(/just a friendly reminder/)).toBeTruthy();
    expect(screen.getByText('$1,450.00 owed, due October 1')).toBeTruthy();
    expect(screen.getByText('Last reminder sent Oct 20')).toBeTruthy();
    fireEvent.press(screen.getByText('Send'));
    await settle();
    expect(api.sendReminder).toHaveBeenCalledWith(
      't-tara',
      'friendly',
      expect.stringContaining('Hi Tara'),
    );
    expect(
      screen.getByText(/One reminder every 24 hours\. You can send the next one Oct 23 at/),
    ).toBeTruthy();
  });

  test('nothing owed and an ended tenancy turn Send off with a reason', async () => {
    api.getReminderPreview.mockRejectedValueOnce(
      Object.assign(new Error('x'), { code: 'NOTHING_OWED' }),
    );
    const first = render(
      <ToastProvider>
        <ReminderSheet visible tenancy_id="t-tara" place="Maple Court" onClose={jest.fn()} />
      </ToastProvider>,
    );
    await settle();
    expect(screen.getByText(/Nothing is owed right now/)).toBeTruthy();
    first.unmount();
    api.getReminderPreview.mockRejectedValueOnce(
      Object.assign(new Error('x'), { code: 'NO_ACTIVE_TENANCY' }),
    );
    render(
      <ToastProvider>
        <ReminderSheet visible tenancy_id="t-tara" place="Maple Court" onClose={jest.fn()} />
      </ToastProvider>,
    );
    await settle();
    expect(screen.getByText(/This tenancy has ended/)).toBeTruthy();
    expect(api.sendReminder).not.toHaveBeenCalled();
  });
});

describe('leases for a real landlord', () => {
  test('the list and the lease screen read the server lease block and timeline', async () => {
    render(<LeasesScreen navigation={navigation} />);
    expect(screen.getByText('Tara Tenant')).toBeTruthy();
    expect(screen.getByText('Expiring soon')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/^Tara Tenant, Maple Court, Unit 2B/));
    expect(navigation.navigate).toHaveBeenCalledWith('TenantLease', { tenancyId: 't-tara' });

    render(
      <ToastProvider>
        <TenantLeaseScreen navigation={navigation} route={{ params: { tenancyId: 't-tara' } }} />
      </ToastProvider>,
    );
    await settle();
    expect(mock_tenants.fetchLease).toHaveBeenCalledWith('t-tara');
    expect(screen.getByText('25 days left')).toBeTruthy();
    expect(screen.getByText('Wants to renew')).toBeTruthy();
    expect(screen.getByText(/^Lease set, ends Nov 16/)).toBeTruthy();
    expect(screen.getByText('Renew')).toBeTruthy();
  });
});
