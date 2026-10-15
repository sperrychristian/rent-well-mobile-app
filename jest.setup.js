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
