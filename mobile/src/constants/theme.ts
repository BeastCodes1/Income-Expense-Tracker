/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export type ThemeColors = {
  text: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  textSecondary: string;
  textMuted: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  primary: string;
  primarySoft: string;
  income: string;
  incomeBackground: string;
  expense: string;
  expenseBackground: string;
  icon: string;
  balanceLabel: string;
  balanceFooter: string;
  avatarBackground: string;
  avatarText: string;
};

export const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    text: '#172033',
    background: '#F5F7FB',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E8EEFF',
    textSecondary: '#778198',
    textMuted: '#8992A4',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F3F9',
    border: '#E4E9F2',
    primary: '#245BDB',
    primarySoft: '#E8EEFF',
    income: '#159563',
    incomeBackground: '#E1F7EC',
    expense: '#E05252',
    expenseBackground: '#FDEAEA',
    icon: '#45516A',
    balanceLabel: '#DCE7FF',
    balanceFooter: '#E3EBFF',
    avatarBackground: '#DDF5EA',
    avatarText: '#16845B',
  },
  dark: {
    text: '#F3F6FC',
    background: '#101522',
    backgroundElement: '#1B2433',
    backgroundSelected: '#263A63',
    textSecondary: '#B3BED0',
    textMuted: '#929FB3',
    surface: '#1B2433',
    surfaceAlt: '#222D40',
    border: '#303B4E',
    primary: '#779AFF',
    primarySoft: '#263A63',
    income: '#61D6A0',
    incomeBackground: '#183B31',
    expense: '#FF8282',
    expenseBackground: '#462A31',
    icon: '#CFD7E5',
    balanceLabel: '#E0E9FF',
    balanceFooter: '#E0E9FF',
    avatarBackground: '#173A32',
    avatarText: '#62D3A1',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
