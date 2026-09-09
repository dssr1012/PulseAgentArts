// ============================================================
// PulseExpends - Currency Selector (Segmented Control)
// ARS / USD / EUR
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { CURRENCY_SYMBOLS } from '../constants/currencies';
import type { Currency } from '../types';
import { CURRENCIES } from '../constants/currencies';

interface CurrencySelectorProps {
  selected: Currency;
  onChange: (currency: Currency) => void;
}

export function CurrencySelector({ selected, onChange }: CurrencySelectorProps) {
  return (
    <View style={styles.container}>
      {CURRENCIES.map((currency) => {
        const isActive = currency === selected;
        return (
          <TouchableOpacity
            key={currency}
            style={[styles.segment, isActive && styles.activeSegment]}
            onPress={() => onChange(currency)}
            activeOpacity={0.7}
          >
            <Text style={[styles.symbol, isActive && styles.activeSymbol]}>
              {CURRENCY_SYMBOLS[currency]}
            </Text>
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {currency}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  activeSegment: {
    backgroundColor: Colors.primary,
  },
  symbol: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  activeSymbol: {
    color: Colors.textInverse,
  },
  label: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  activeLabel: {
    color: Colors.textInverse,
  },
});