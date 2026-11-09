import { Alert, Text } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NewWorkOrderScreen from './NewWorkOrderScreen';
import { optionsFor } from '../../../navigation/screenOptions';

// the work order screen in real mode, with the shared context mocked the way RemoteWorkOrdersProvider answers:
// a failed save keeps the form open with the values, a good one goes back with no discard prompt,
// and an owner's edit only sends what the server can change

const mock_store = {
  is_remote: true,
  role: 'owner',
  demo_mode: false,
  demo_role: 'owner',
  properties: [],
  orders: [],
  addWorkOrder: jest.fn(),
  updateWorkOrder: jest.fn(),
  getOrder: jest.fn(),
};
jest.mock('../../../store/WorkOrdersContext', () => ({
  useWorkOrders: () => mock_store,
}));
jest.mock('../../../store/TenantsContext', () => ({
  useTenants: () => ({
    properties: [
      {
        id: 'p-maple',
        name: 'Maple Court',
        tenancies: [
          { id: 't-1', tenant_id: 'u-tara', tenant_name: 'Tara Tenant', unit_label: '2B' },
        ],
      },
    ],
    my_active_tenancies: [],
  }),
}));
jest.mock('../../auth/hooks/useAppRole', () => ({ useAppRole: () => mock_store.role }));
jest.mock('../../../services/api', () => ({
  getMe: jest.fn(() =>
    Promise.resolve({
      activeTenancies: [{ id: 'ten-1', property: { name: 'Maple Court' }, unitLabel: '2B' }],
    }),
  ),
}));

const Stack = createNativeStackNavigator();

function Home(props) {
  return (
    <Text onPress={() => props.navigation.navigate('NewWorkOrder', props.route.params)}>
      Open form
    </Text>
  );
}

function MyRequests() {
  return <Text>My requests list</Text>;
}

async function settle() {
  for (let index = 0; index < 3; index++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function openForm(params) {
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={Home} initialParams={params} />
          <Stack.Screen
            name="NewWorkOrder"
            component={NewWorkOrderScreen}
            options={optionsFor('NewWorkOrder')}
          />
          <Stack.Screen name="MyRequests" component={MyRequests} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>,
  );
  await settle();
  fireEvent.press(screen.getByText('Open form'));
  await settle();
}

function type(label, text) {
  fireEvent.changeText(screen.getByLabelText(label), text);
}

const saved_order = {
  id: 'wo-1',
  title: 'Clean gutters before winter',
  description: 'Leaves everywhere along the back.',
  priority: 'Low',
  status: 'Open',
  contractor: '',
  estimate: null,
  property: 'Maple Court, 2B',
  photos: [],
};

beforeEach(() => {
  mock_store.role = 'owner';
  mock_store.addWorkOrder.mockReset();
  mock_store.updateWorkOrder.mockReset();
  mock_store.getOrder.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  Alert.alert.mockRestore();
});

describe('a real landlord adds a work order', () => {
  test('a failed save stays on the form with the values and the server message', async () => {
    mock_store.addWorkOrder.mockRejectedValue(new Error("Can't reach the server."));
    await openForm();
    // the real owner picks a property, and there's no preferred date (the server has nowhere to keep it)
    expect(screen.queryByLabelText('Preferred date (optional)')).toBeNull();
    fireEvent.press(screen.getByLabelText('Maple Court'));
    fireEvent.press(screen.getByLabelText('Tara Tenant, 2B'));
    expect(screen.getByLabelText('Unit (optional)').props.value).toBe('2B');
    type('Title', 'Clean gutters');
    type('Description', 'Leaves everywhere along the back.');
    fireEvent.press(screen.getByLabelText('Low priority'));
    type('Estimated cost (optional)', '150');
    fireEvent.press(screen.getByText('Add'));
    await settle();

    expect(mock_store.addWorkOrder).toHaveBeenCalledTimes(1);
    expect(mock_store.addWorkOrder.mock.calls[0][0]).toEqual({
      property_id: 'p-maple',
      title: 'Clean gutters',
      description: 'Leaves everywhere along the back.',
      priority: 'Low',
      photos: [],
      unit_label: '2B',
      tenant_user_id: 'u-tara',
      contractor: '',
      estimate: 150,
    });
    expect(screen.getByText("Not sent: Can't reach the server.")).toBeTruthy();
    expect(screen.getByLabelText('Title').props.value).toBe('Clean gutters');
    expect(screen.getByText('Add')).toBeTruthy();
    // still the form, nothing asked to discard
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('without a property it says so next to the chips and never calls the server', async () => {
    await openForm();
    type('Title', 'Clean gutters');
    type('Description', 'Leaves everywhere along the back.');
    fireEvent.press(screen.getByLabelText('Low priority'));
    fireEvent.press(screen.getByText('Add'));
    await settle();
    expect(screen.getByText('Choose which property this work order is for.')).toBeTruthy();
    expect(mock_store.addWorkOrder).not.toHaveBeenCalled();
  });

  test('a good save goes back without the discard prompt', async () => {
    mock_store.addWorkOrder.mockResolvedValue({ id: 'wo-2' });
    await openForm();
    fireEvent.press(screen.getByLabelText('Maple Court'));
    type('Title', 'Clean gutters');
    type('Description', 'Leaves everywhere along the back.');
    fireEvent.press(screen.getByLabelText('Low priority'));
    fireEvent.press(screen.getByText('Add'));
    await settle();
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.getByText('Open form')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('a real landlord edits a work order', () => {
  test('title and description are read only and only priority, contractor, and estimate are sent', async () => {
    mock_store.getOrder.mockReturnValue(saved_order);
    mock_store.updateWorkOrder.mockRejectedValueOnce(new Error('Server error'));
    await openForm({ workOrderId: 'wo-1' });
    expect(screen.getByLabelText('Title').props.editable).toBe(false);
    expect(screen.getByText('Maple Court, 2B')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Emergency priority'));
    type('Contractor (optional)', 'Gutter Pros');
    type('Estimated cost (optional)', '99.95');
    fireEvent.press(screen.getByText('Update'));
    await settle();
    expect(mock_store.updateWorkOrder).toHaveBeenCalledWith('wo-1', {
      priority: 'Emergency',
      contractor: 'Gutter Pros',
      estimate: 99.95,
    });
    // the first try failed, so the form is still here with the message
    expect(screen.getByText('Not updated: Server error')).toBeTruthy();
    mock_store.updateWorkOrder.mockResolvedValueOnce({});
    fireEvent.press(screen.getByText('Update'));
    await settle();
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('a resolved order opened by id shows the reason instead of a form', async () => {
    mock_store.getOrder.mockReturnValue({ ...saved_order, status: 'Resolved' });
    await openForm({ workOrderId: 'wo-1' });
    expect(
      screen.getByText('This work order is resolved, so it can no longer be edited.'),
    ).toBeTruthy();
    expect(screen.queryByText('Update')).toBeNull();
  });
});

describe('a real tenant reports an issue', () => {
  test('the rental comes from GET /me and a sent request opens My Requests', async () => {
    mock_store.role = 'tenant';
    mock_store.addWorkOrder.mockResolvedValue({ id: 'wo-3' });
    await openForm();
    expect(screen.getByText('Maple Court, 2B')).toBeTruthy();
    expect(screen.queryByLabelText('Estimated cost (optional)')).toBeNull();
    type('Title', 'No hot water');
    type('Description', 'Nothing but cold water since this morning.');
    fireEvent.press(screen.getByLabelText('Emergency priority'));
    fireEvent.press(screen.getByText('Add'));
    await settle();
    expect(mock_store.addWorkOrder.mock.calls[0][0]).toEqual({
      title: 'No hot water',
      description: 'Nothing but cold water since this morning.',
      priority: 'Emergency',
      photos: [],
      tenancy_id: undefined,
    });
    expect(screen.getByText('My requests list')).toBeTruthy();
  });
});
