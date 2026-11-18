import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveSession, readSession, clearSession, forgetSecureStoreCheck } from './sessionStorage';
import { auth_session_key } from './storageKeys';

// the stand-in from jest.setup.js, with its saved map and the available switch
const SecureStore = jest.requireMock('expo-secure-store');

// made-up values only
const session = {
  idToken: 'fake-id-abc',
  refreshToken: 'fake-refresh-abc',
  localId: 'uid-1',
  expiresAt: 1700000000000,
  user: { id: 'uid-1', role: 'owner', name: 'Robin', email: 'robin@example.com', ownerId: null },
};

const original_os = Platform.OS;

beforeEach(async () => {
  await AsyncStorage.clear();
  SecureStore.__saved.clear();
  SecureStore.__available.value = false;
  forgetSecureStoreCheck();
});

afterEach(() => {
  Platform.OS = original_os;
});

test('on a phone with SecureStore the session goes there, not AsyncStorage', async () => {
  SecureStore.__available.value = true;
  await saveSession(session);
  expect(JSON.parse(SecureStore.__saved.get(auth_session_key))).toEqual(session);
  expect(await AsyncStorage.getItem(auth_session_key)).toBeNull();
  expect(await readSession()).toEqual(session);
  await clearSession();
  expect(SecureStore.__saved.has(auth_session_key)).toBe(false);
  expect(await readSession()).toBeNull();
});

test('the key is one SecureStore can take', () => {
  expect(auth_session_key).toMatch(/^[A-Za-z0-9._-]+$/);
});

test('without SecureStore (tests, the web render) it falls back to AsyncStorage', async () => {
  await saveSession(session);
  expect(JSON.parse(await AsyncStorage.getItem(auth_session_key))).toEqual(session);
  expect(await readSession()).toEqual(session);
  await clearSession();
  expect(await AsyncStorage.getItem(auth_session_key)).toBeNull();
});

test('the web render never asks SecureStore', async () => {
  Platform.OS = 'web';
  SecureStore.__available.value = true;
  await saveSession(session);
  expect(SecureStore.__saved.size).toBe(0);
  expect(await readSession()).toEqual(session);
});

test('a broken or half saved session reads as nothing', async () => {
  await AsyncStorage.setItem(auth_session_key, '{not json');
  expect(await readSession()).toBeNull();
  await AsyncStorage.setItem(auth_session_key, JSON.stringify({ idToken: 'x' }));
  expect(await readSession()).toBeNull();
});
