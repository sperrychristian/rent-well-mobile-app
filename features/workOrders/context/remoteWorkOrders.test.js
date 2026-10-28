import { useEffect } from 'react';
import { Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkOrdersProvider, useWorkOrders } from '../../../context/WorkOrdersContext';
import { RemoteWorkOrdersProvider } from './RemoteWorkOrdersProvider';
import { openCount } from '../utils/workOrderHelpers';
import * as api from '../../../services/api';

// the shared state in real mode: a signed-in landlord, the work order routes mocked like docs/API.md answers,
// and two small "screens" reading the same store (a list row and a badge), like the Work Orders tab and the tab bar

const mock_user = { id: 'owner-1', role: 'owner', name: 'Olivia Owner' };
jest.mock('../../auth/context/AuthContext', () => ({
  useAuth: () => ({ user: mock_user }),
}));
// the socket's listeners are kept so a test can play a server event into them
const mock_socket = {};
jest.mock('../../../services/socket', () => ({
  onSocketEvent: (name, handler) => {
    mock_socket[name] = handler;
    return () => {};
  },
}));
jest.mock('../../../services/push', () => ({ listenForWorkOrderTaps: () => () => {} }));
jest.mock('../../../services/navigationRef', () => ({ navigateWhenReady: jest.fn() }));
jest.mock('../../../services/api', () => ({
  getAllWorkOrders: jest.fn(),
  getWorkOrder: jest.fn(),
  createTenantWorkOrder: jest.fn(),
  createOwnerWorkOrder: jest.fn(),
  updateWorkOrderStatus: jest.fn(),
  updateWorkOrderPriority: jest.fn(),
  updateWorkOrderNotes: jest.fn(),
  updateWorkOrderContractor: jest.fn(),
  addWorkOrderPhotos: jest.fn(),
  uploadImage: jest.fn(),
}));

const api_order = (id, title, status) => ({
  id: id,
  title: title,
  description: '',
  property: { id: 'p-maple', name: 'Maple Court', address: '12 Maple St' },
  unitLabel: 'Unit 2B',
  tenantName: 'Tara Tenant',
  tenant: { id: 'u-tara' },
  status: status,
  priority: 'Normal',
  createdAt: '2026-10-20T15:00:00.000Z',
  startedAt: status === 'Open' ? null : '2026-10-21T15:00:00.000Z',
  resolvedAt: null,
  photos: [],
});

// the "list screen": one line per order with its status
function ListRows() {
  const { orders } = useWorkOrders();
  return orders.map((order) => <Text key={order.id}>{order.title + ': ' + order.status}</Text>);
}

// the "tab bar": the same open count the real badge uses
function Badge() {
  const { orders } = useWorkOrders();
  return <Text>{'badge ' + openCount(orders)}</Text>;
}

const peek = { store: null };
function Peek() {
  const store = useWorkOrders();
  useEffect(() => {
    peek.store = store;
  });
  return null;
}

async function settle() {
  for (let index = 0; index < 4; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function renderReal() {
  render(
    <WorkOrdersProvider user_id={mock_user.id}>
      <RemoteWorkOrdersProvider>
        <ListRows />
        <Badge />
        <Peek />
      </RemoteWorkOrdersProvider>
    </WorkOrdersProvider>,
  );
  await settle();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  api.getAllWorkOrders.mockResolvedValue([api_order('wo-1', 'Leaky faucet', 'Open')]);
});

describe('work orders for a real landlord, one store for every screen', () => {
  test('a status change shows on every reader right away, before the server answers', async () => {
    await renderReal();
    expect(screen.getByText('Leaky faucet: Open')).toBeTruthy();
    expect(screen.getByText('badge 1')).toBeTruthy();

    // the server is slow, so the request stays out while I look
    let answer;
    api.updateWorkOrderStatus.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    let pending;
    act(() => {
      pending = peek.store.startWorkOrder('wo-1');
    });
    expect(screen.getByText('Leaky faucet: In Progress')).toBeTruthy();
    expect(screen.getByText('badge 0')).toBeTruthy();

    await act(async () => {
      answer(api_order('wo-1', 'Leaky faucet', 'In Progress'));
      await pending;
    });
    expect(api.updateWorkOrderStatus).toHaveBeenCalledWith('wo-1', 'In Progress');
    expect(screen.getByText('Leaky faucet: In Progress')).toBeTruthy();
  });

  test('a failed change rolls back on every reader and throws so the screen can say why', async () => {
    await renderReal();
    api.updateWorkOrderStatus.mockRejectedValue(new Error("Can't reach the server."));
    let thrown = null;
    await act(async () => {
      try {
        await peek.store.startWorkOrder('wo-1');
      } catch (error) {
        thrown = error;
      }
    });
    expect(thrown.message).toBe("Can't reach the server.");
    expect(screen.getByText('Leaky faucet: Open')).toBeTruthy();
    expect(screen.getByText('badge 1')).toBeTruthy();
  });

  test("a tenant's new request from the socket lands in the landlord's list and badge", async () => {
    await renderReal();
    act(() => {
      mock_socket['workorder:new']({ workOrder: api_order('wo-2', 'No hot water', 'Open') });
    });
    expect(screen.getByText('No hot water: Open')).toBeTruthy();
    expect(screen.getByText('badge 2')).toBeTruthy();
  });
});
