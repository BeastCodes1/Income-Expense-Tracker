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
  heroBackground: string;
  heroText: string;
  heroLabel: string;
  avatarBackground: string;
  avatarText: string;
};

export const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    text: '#172033',
    background: '#F6F7FB',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EEF0FE',
    textSecondary: '#788196',
    textMuted: '#8A93A6',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F3F8',
    border: '#E7EAF0',
    primary: '#4F46E5',
    primarySoft: '#EEF0FE',
    income: '#159563',
    incomeBackground: '#E1F7EC',
    expense: '#E05252',
    expenseBackground: '#FDEAEA',
    icon: '#45516A',
    heroBackground: '#4F46E5',
    heroText: '#FFFFFF',
    heroLabel: '#DCDDFF',
    avatarBackground: '#DDF5EA',
    avatarText: '#16845B',
  },
  dark: {
    text: '#F3F4F6',
    background: '#0B1120',
    backgroundElement: '#111827',
    backgroundSelected: '#263A63',
    textSecondary: '#A1AAB9',
    textMuted: '#8C96A8',
    surface: '#111827',
    surfaceAlt: '#1F2937',
    border: '#374151',
    primary: '#8B9DFF',
    primarySoft: '#232E4D',
    income: '#61D6A0',
    incomeBackground: '#183B31',
    expense: '#FF8282',
    expenseBackground: '#462A31',
    icon: '#CFD7E5',
    heroBackground: '#26304E',
    heroText: '#EEF2FF',
    heroLabel: '#B9C4E6',
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
