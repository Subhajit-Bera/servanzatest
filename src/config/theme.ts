import { DefaultTheme } from 'react-native-paper';

export const COLORS = {
  primary: '#2ECC71',      // Primary Green
  darkGreen: '#27AE60',
  lightGreen: '#A8E6CF',
  accent: '#FF6B6B',       // Coral/Orange
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  charcoal: '#212529',
  darkGray: '#495057',
  mediumGray: '#ADB5BD',
  lightGray: '#E9ECEF',
  error: '#E74C3C',
  warning: '#F39C12',
  info: '#3498DB',
};

export const SHADOWS = {
  light: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  green: {
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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