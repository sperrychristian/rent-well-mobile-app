import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// the demo tour shows itself once, the first time someone enters the demo on this phone
// it's a phone setting, not account data, so it has its own key and never touches the real data keys
// gives back { visible, open, close }, auto (true on the homes) opens it once if it hasn't been seen
export const demo_tour_key = 'rent_well_demo_tour_seen';

export function useDemoTour(auto) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!auto) {
      return undefined;
    }
    let active = true;
    AsyncStorage.getItem(demo_tour_key)
      .then((value) => {
        if (active && value !== 'yes') {
          setVisible(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [auto]);

  function close() {
    setVisible(false);
    AsyncStorage.setItem(demo_tour_key, 'yes').catch(() => {});
  }

  return { visible: visible, open: () => setVisible(true), close: close };
}
