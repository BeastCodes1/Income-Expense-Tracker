import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

export type ThemeMode = 'light' | 'dark';

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const themePreferenceKey = 'mobile-theme-mode';
const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(
    systemColorScheme === 'dark' ? 'dark' : 'light'
  );

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(themePreferenceKey)
      .then((savedMode) => {
        if (isMounted && (savedMode === 'light' || savedMode === 'dark')) {
          setModeState(savedMode);
        }
      })
      .catch((error: unknown) => {
        console.error('Could not load the saved theme preference.', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    AsyncStorage.setItem(themePreferenceKey, nextMode).catch(
      (error: unknown) => {
        console.error('Could not save the theme preference.', error);
      }
    );
  }, []);

  return (
    <ThemeModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('Theme controls must be rendered inside AppThemeProvider.');
  }
  return context;
}

export function useTheme() {
  const { mode } = useThemeMode();
  return Colors[mode];
}
