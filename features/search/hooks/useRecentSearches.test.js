import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecentSearches, recent_searches_key } from './useRecentSearches';

// recent searches: saved per account in real mode, memory only in the demo

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useRecentSearches', () => {
  test('a signed-in account keeps its searches after the screen closes, and Clear removes them', async () => {
    const first = renderHook(() => useRecentSearches('owner-1', false));
    await settle();
    act(() => first.result.current.remember('faucet'));
    act(() => first.result.current.remember('sam'));
    await settle();
    first.unmount();
    expect(JSON.parse(await AsyncStorage.getItem(recent_searches_key + '_owner-1'))).toEqual([
      'sam',
      'faucet',
    ]);

    const second = renderHook(() => useRecentSearches('owner-1', false));
    await settle();
    expect(second.result.current.recents).toEqual(['sam', 'faucet']);
    act(() => second.result.current.clear());
    await settle();
    expect(second.result.current.recents).toEqual([]);
    expect(await AsyncStorage.getItem(recent_searches_key + '_owner-1')).toBeNull();
  });

  test('another account on the same phone never sees them', async () => {
    await AsyncStorage.setItem(recent_searches_key + '_owner-1', JSON.stringify(['faucet']));
    const other = renderHook(() => useRecentSearches('owner-2', false));
    await settle();
    expect(other.result.current.recents).toEqual([]);
  });

  test('the demo keeps them in memory only, nothing is saved', async () => {
    const demo = renderHook(() => useRecentSearches(null, true));
    await settle();
    act(() => demo.result.current.remember('faucet'));
    await settle();
    expect(demo.result.current.recents).toEqual(['faucet']);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});
