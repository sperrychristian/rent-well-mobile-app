import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setActiveScheme, paletteFor } from '../theme';

// Appearance: System, Light, or Dark, saved on this phone (not per account), so it applies before login,
// in the demo, in real mode, and after logging out
export const appearance_key = 'rent_well_appearance';
export const appearance_options = ['system', 'light', 'dark'];

const ThemeContext = createContext(null);

// System follows the phone's own setting, live, and anything unknown counts as System
export function resolveScheme(preference, system_scheme) {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return system_scheme === 'dark' ? 'dark' : 'light';
}

// reads the saved choice first (the splash stays up until it's in, so the app never flashes the wrong theme),
// then sets the active palette before anything below it draws
export function ThemeProvider(props) {
  const system_scheme = useColorScheme();
  const [preference, setPreferenceState] = useState(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(appearance_key)
      .then((saved) => {
        if (active) {
          setPreferenceState(appearance_options.includes(saved) ? saved : 'system');
        }
      })
      .catch(() => {
        if (active) {
          setPreferenceState('system');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const scheme = resolveScheme(preference, system_scheme);
  // the palette everything reads has to switch before the children draw, so it happens right here
  setActiveScheme(scheme);

  function setPreference(next) {
    const value = appearance_options.includes(next) ? next : 'system';
    setPreferenceState(value);
    AsyncStorage.setItem(appearance_key, value).catch((error) =>
      console.log('Could not save the appearance', error.message),
    );
  }

  const value = {
    ready: preference !== null,
    preference: preference || 'system',
    scheme: scheme,
    is_dark: scheme === 'dark',
    colors: paletteFor(scheme),
    setPreference: setPreference,
  };
  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

// screens and components that need the theme itself (not just its colors) call this
// outside a provider (some tests) it's the light theme
export function useTheme() {
  const value = useContext(ThemeContext);
  return (
    value || {
      ready: true,
      preference: 'system',
      scheme: 'light',
      is_dark: false,
      colors: paletteFor('light'),
      setPreference: () => {},
    }
  );
}
