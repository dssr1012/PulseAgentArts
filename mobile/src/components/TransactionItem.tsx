// ============================================================
// PulseExpends - Transaction Item Component
// Color-coded amounts, private indicators, obfuscated text
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { formatAmountCompact } from '../constants/currencies';
import { toShortDate } from '../utils/dates';
import type { Transaction, Category } from '../types';

interface TransactionItemProps {
  transaction: Transaction;
  categories: Category[];
  currentUserId: string;
  onPress: (transactionId: string) => void;
}

export function TransactionItem({
  transaction,
  categories,
  currentUserId,
  onPress,
}: TransactionItemProps) {
  const isExpense = transaction.type === 'expense';
  const isOwnPrivate = transaction.is_private && transaction.user_id === currentUserId;
  const isOtherPrivate = transaction.is_private && transaction.user_id !== currentUserId;
  const isPending = transaction.confirmation_status === 'pending_confirmation';

  const category = categories.find((c) => c.id === transaction.category_id);
  const amountColor = isExpense ? Colors.expense : Colors.success;

  // Determine display text
  const description = isOtherPrivate
    ? `Gasto Privado de ${transaction.user?.given_name ?? 'Otro'}`
    : transaction.description || transaction.merchant_name || category?.name || 'Gasto';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(transaction.id)}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        <View style={[styles.categoryIcon, { backgroundColor: isExpense ? Colors.expenseLight : Colors.successLight }]}>
          <Text style={styles.categoryEmoji}>{category?.icon || (isExpense ? '💸' : '💰')}</Text>
        </View>
        <View style={styles.textSection}>
          <Text style={styles.description} numberOfLines={1}>
            {isOwnPrivate && '🔒 '}{description}
          </Text>
          <Text style={styles.subtitle}>
            {toShortDate(transaction.transaction_date)}
            {transaction.merchant_name && !isOtherPrivate && ` · ${transaction.merchant_name}`}
            {isPending && ' · ⏳ Pendiente'}
          </Text>
        </View>
      </View>
      <View style={styles.rightSection}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {isExpense ? '-' : '+'}{formatAmountCompact(transaction.amount, transaction.currency)}
        </Text>
        {isOtherPrivate && (
          <Text style={styles.privateBadge}>Privado</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  textSection: {
    flex: 1,
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  privateBadge: {
    fontSize: 10,
    color: Colors.privacy,
    fontWeight: '600',
    marginTop: 2,
  },
});