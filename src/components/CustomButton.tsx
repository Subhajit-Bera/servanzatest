import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { COLORS, SHADOWS } from '../config/theme';

interface Props {
  mode?: 'text' | 'outlined' | 'contained';
  onPress: () => void;
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: any;
}

export default function CustomButton({ mode = 'contained', onPress, children, loading, disabled, style }: Props) {
  return (
    <Button
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      style={[
        styles.button,
        mode === 'contained' && !disabled && SHADOWS.light,
        style
      ]}
      contentStyle={styles.content}
      labelStyle={styles.label}
      buttonColor={mode === 'contained' ? COLORS.primary : undefined}
      textColor={mode === 'contained' ? COLORS.white : COLORS.primary}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    marginVertical: 8,
  },
  content: {
    height: 48,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});