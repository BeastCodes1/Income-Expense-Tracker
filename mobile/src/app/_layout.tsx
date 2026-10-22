import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AppThemeProvider, useThemeMode } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <AppThemeProvider>
      <ThemedTabLayout />
    </AppThemeProvider>
  );
}

function ThemedTabLayout() {
  const { mode } = useThemeMode();

  return (
    <ThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
