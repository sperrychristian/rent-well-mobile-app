import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageKey } from '../../../utils/storageKeys';
import { addRecentSearch } from '../utils/searchIndex';

export const recent_searches_key = 'rent_well_recent_searches';

// the last few searches, saved per account so a shared phone never shows someone else's
// the demo keeps them in memory only (nothing in the demo is ever saved), and they go away when it ends
export function useRecentSearches(user_id, demo_mode) {
  const [recents, setRecents] = useState([]);
  const saves = !demo_mode && !!user_id;
  const key = storageKey(recent_searches_key, user_id);
  // the newest list, so remember and clear never work from an old copy
  const latest = useRef(recents);
  useEffect(() => {
    latest.current = recents;
  }, [recents]);

  useEffect(() => {
    if (!saves) {
      return undefined;
    }
    let active = true;
    AsyncStorage.getItem(key)
      .then((text) => {
        const saved = text ? JSON.parse(text) : [];
        if (active && Array.isArray(saved)) {
          setRecents(saved);
        }
      })
      .catch((error) => console.log('Could not read recent searches', error));
    return () => {
      active = false;
    };
  }, [key, saves]);

  function save(next) {
    setRecents(next);
    if (saves) {
      AsyncStorage.setItem(key, JSON.stringify(next)).catch((error) =>
        console.log('Could not save recent searches', error),
      );
    }
  }

  function remember(query) {
    const next = addRecentSearch(latest.current, query);
    if (next !== latest.current) {
      save(next);
    }
  }

  function clear() {
    save([]);
    if (saves) {
      AsyncStorage.removeItem(key).catch(() => {});
    }
  }

  return { recents, remember, clear };
}
