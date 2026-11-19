// test-only setup: small stand-ins for native pieces the render tests touch, nothing here ships in the app

// icons draw as their name, so a test can still find them and the font never has to load
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const Icon = (props) => <Text accessible={false}>{props.name}</Text>;
  return { Ionicons: Icon };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}));

// the drawer pulls in Reanimated and the gesture handler, these are their own test stand-ins
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');

// assignment 12: the tests have no Keychain, so SecureStore says it isn't there and the session falls back
// to AsyncStorage (util/sessionStorage.test.js turns it on to check the SecureStore path)
jest.mock('expo-secure-store', () => {
  const saved = new Map();
  return {
    __saved: saved,
    __available: { value: false },
    AFTER_FIRST_UNLOCK: 0,
    isAvailableAsync: jest.fn(async () => require('expo-secure-store').__available.value),
    setItemAsync: jest.fn(async (key, value) => {
      saved.set(key, value);
    }),
    getItemAsync: jest.fn(async (key) => (saved.has(key) ? saved.get(key) : null)),
    deleteItemAsync: jest.fn(async (key) => {
      saved.delete(key);
    }),
  };
});
