// ============================================================
// PulseExpends - Balance Card Component
// Blue-themed balance display cards
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { formatAmountCompact } from '../utils/formatters';
import type { Currency } from '../types';

interface BalanceCardProps {
  title: string;
  amount: number;
  currency: Currency;
  type: 'income' | 'expense' | 'balance';
  isStale?: boolean;
}

export function BalanceCard({ title, amount, currency, type, isStale }: BalanceCardProps) {
  const colorMap = {
    income: Colors.success,
    expense: Colors.expense,
    balance: amount >= 0 ? Colors.primary : Colors.expense,
  };

  const bgColorMap = {
    income: Colors.successLight,
    expense: Colors.expenseLight,
    balance: amount >= 0 ? '#EBF5FF' : Colors.expenseLight,
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColorMap[type] }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.amount, { color: colorMap[type] }]}>
        {formatAmountCompact(amount, currency)}
      </Text>
      {isStale && (
        <Text style={styles.staleWarning}>⚠ Tasas pueden estar desactualizadas</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    flex: 1,
    minHeight: 80,
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
  },
  staleWarning: {
    fontSize: 10,
    color: Colors.alert,
    marginTop: 4,
  },
});