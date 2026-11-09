import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DocumentsScreen from './DocumentsScreen';
import { seed_documents } from '../../../data/documents';

// the two empty Documents messages: nothing saved at all ("No documents yet" with Add Document), and a
// search or filter that finds nothing ("No documents match" with Clear Filters), in the demo and in Firebase

const mock_store = { documents: [], properties: [], demo_mode: true, cloud_status: 'off' };
jest.mock('../../../store/WorkOrdersContext', () => ({
  useWorkOrders: () => ({
    ...mock_store,
    addDocument: jest.fn(),
    updateDocument: jest.fn(),
    deleteDocument: jest.fn(),
  }),
}));
// the data gate and the focus reload read every store, here the store is ready and nothing reloads
jest.mock('../../../store/useScreenData', () => ({
  useScreenData: () => ({ status: 'ready', message: '', retry: () => {}, banner: '' }),
}));
jest.mock('../../../navigation/useRefreshOnFocus', () => ({ useRefreshOnFocus: () => {} }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ addListener: () => () => {}, navigate: jest.fn() }),
}));

function renderDocuments() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <DocumentsScreen />
    </SafeAreaProvider>,
  );
}

// a Firebase record looks like what util/data/documents.js gives back
const firebase_documents = seed_documents.map((document) => ({
  ...document,
  stored_name: null,
  sample: false,
  record_only: true,
}));

describe.each([
  ['demo', { demo_mode: true, cloud_status: 'off' }, seed_documents],
  ['Firebase', { demo_mode: false, cloud_status: 'ready' }, firebase_documents],
])('Documents in %s mode', (mode_name, mode, documents) => {
  test('nothing saved says No documents yet with Add Document', () => {
    Object.assign(mock_store, mode, { documents: [] });
    renderDocuments();
    expect(screen.getByText('No documents yet')).toBeTruthy();
    expect(screen.queryByText('No documents match')).toBeNull();
    expect(screen.getAllByText('Add Document').length).toBeGreaterThan(1);
    expect(screen.queryByText('Clear Filters')).toBeNull();
  });

  test('a search that finds nothing says No documents match, and Clear Filters brings the list back', () => {
    Object.assign(mock_store, mode, { documents: documents });
    renderDocuments();
    fireEvent.changeText(
      screen.getByPlaceholderText('Search name, tenant, property, or notes'),
      'nothing like this',
    );
    expect(screen.getByText('No documents match')).toBeTruthy();
    expect(screen.queryByText('No documents yet')).toBeNull();
    fireEvent.press(screen.getByText('Clear Filters'));
    expect(screen.queryByText('No documents match')).toBeNull();
    expect(screen.getByText(documents[0].name)).toBeTruthy();
  });
});
