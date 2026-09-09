// ============================================================
// PulseExpends - Numeric Keypad Component
// Large numpad optimized for point-of-sale quick entry
// ============================================================

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export function NumPad({ value, onChange, maxLength = 12 }: NumPadProps) {
  const handlePress = useCallback(
    (key: string) => {
      if (value.length >= maxLength && key !== 'backspace') return;

      if (key === 'backspace') {
        onChange(value.slice(0, -1));
      } else if (key === '.') {
        // Only one decimal point
        if (value.includes('.')) return;
        // Don't start with a decimal
        if (value.length === 0) {
          onChange('0.');
          return;
        }
        onChange(value + '.');
      } else if (key === '00') {
        // Handle double zero
        if (value.length === 0 || value === '0') return;
        if (value.length + 2 > maxLength) return;
        onChange(value + '00');
      } else {
        // Regular digit
        // Prevent leading zeros
        if (value === '0' && key !== '.') {
          onChange(key);
        } else {
          onChange(value + key);
        }
      }
    },
    [value, maxLength, onChange]
  );

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '00'],
  ];

  return (
    <View style={styles.container}>
      {keys.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={styles.key}
              onPress={() => handlePress(key)}
              activeOpacity={0.6}
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      {/* Backspace row */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.key, styles.backspaceKey]}
          onPress={() => handlePress('backspace')}
          activeOpacity={0.6}
        >
          <Text style={styles.backspaceText}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  key: {
    flex: 1,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  backspaceKey: {
    backgroundColor: Colors.expenseLight,
  },
  backspaceText: {
    fontSize: 24,
    color: Colors.expense,
    fontWeight: '700',
  },
});