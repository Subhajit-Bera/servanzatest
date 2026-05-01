import { DefaultTheme } from 'react-native-paper';

// Servanza Brand Colors — Muted Teal / Sage + Warm Rust
// Synced with servanza-customer theme
export const COLORS = {
  // Primary Brand Colors (Muted Teal / Sage)
  primary: '#47855f',       // muted-teal-600
  primaryDark: '#366347',   // muted-teal-700
  primaryLight: '#eef6f1',  // muted-teal-50
  darkGreen: '#366347',     // muted-teal-700

  // Secondary / Accent
  accent: '#E17A5E',        // Warm Rust / Terracotta
  lightGreen: '#eef6f1',    // muted-teal-50

  // Neutrals
  white: '#FFFFFF',
  offWhite: '#FAFAFA',
  charcoal: '#122118',      // muted-teal-900
  darkGray: '#366347',      // muted-teal-700
  mediumGray: '#7ab892',    // muted-teal-400
  lightGray: '#deede4',     // muted-teal-100

  // Status
  success: '#59a677',       // muted-teal-500
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  light: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  green: {
    shadowColor: '#47855f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    accent: COLORS.accent,
    background: COLORS.offWhite,
    text: COLORS.charcoal,
    error: COLORS.error,
  },
  roundness: 12,
};