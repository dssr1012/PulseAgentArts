// ============================================================
// PulseExpends - Dashboard Screen (HomeScreen)
// Balance cards, recent transactions, FAB, pull-to-refresh
// ============================================================

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTransactionStore } from '../../store/transactionStore';
import { useNotificationStore } from '../../store/notificationStore';
import { Colors } from '../../constants/colors';
import { BalanceCard } from '../../components/BalanceCard';
import { TransactionItem } from '../../components/TransactionItem';
import { FloatingAddButton } from '../../components/FloatingAddButton';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import type { DashboardScreenProps } from '../../navigation/types';

export function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { user, circleId } = useAuth();
  const {
    transactions,
    balance,
    categories,
    pendingExpenses,
    isRefreshing,
    isLoadingBalance,
    refreshTransactions,
    loadBalance,
    loadCategories,
    loadTransactions,
    loadPendingExpenses,
  } = useTransactionStore();
  const { config } = useNotificationStore();

  // Load data on mount
  useEffect(() => {
    if (circleId) {
      loadTransactions(circleId, true);
      loadBalance(circleId);
      loadCategories(circleId);
      loadPendingExpenses();
    }
  }, [circleId]);

  const handleRefresh = useCallback(async () => {
    if (circleId) {
      await Promise.all([
        refreshTransactions(circleId),
        loadBalance(circleId),
        loadCategories(circleId),
        loadPendingExpenses(),
      ]);
    }
  }, [circleId]);

  const handleTransactionPress = useCallback(
    (transactionId: string) => {
      (navigation as any).navigate('TransactionDetail', { transactionId });
    },
    [navigation]
  );

  const handleAddExpense = useCallback(() => {
    (navigation as any).navigate('QuickEntry');
  }, [navigation]);

  const handleViewPending = useCallback(() => {
    (navigation as any).navigate('PendingList');
  }, [navigation]);

  const recentTransactions = transactions.slice(0, 5);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Hola, {user?.given_name || 'Usuario'} 👋
          </Text>
          {balance?.rates_stale && (
            <Text style={styles.staleWarning}>
              ⚠ Tasas de cambio pueden estar desactualizadas
            </Text>
          )}
        </View>

        {/* Balance Cards */}
        <View style={styles.balanceSection}>
          {balance ? (
            <View style={styles.balanceRow}>
              <BalanceCard
                title="Ingresos"
                amount={balance.total_income}
                currency={balance.base_currency}
                type="income"
              />
              <BalanceCard
                title="Gastos"
                amount={balance.total_expenses}
                currency={balance.base_currency}
                type="expense"
              />
              <BalanceCard
                title="Balance"
                amount={balance.net_balance}
                currency={balance.base_currency}
                type="balance"
                isStale={balance.rates_stale}
              />
            </View>
          ) : (
            <LoadingSpinner message="Cargando balance..." />
          )}
        </View>

        {/* Pending Confirmation Section (Mode 2) */}
        {pendingExpenses.length > 0 && (
          <View style={styles.pendingSection}>
            <TouchableOpacity onPress={handleViewPending} style={styles.pendingHeader}>
              <Text style={styles.pendingTitle}>
                ⏳ Gastos por Confirmar ({pendingExpenses.length})
              </Text>
              <Text style={styles.pendingViewAll}>Ver todos →</Text>
            </TouchableOpacity>
            {pendingExpenses.slice(0, 2).map((expense) => (
              <TransactionItem
                key={expense.id}
                transaction={expense}
                categories={categories}
                currentUserId={user?.id || ''}
                onPress={handleTransactionPress}
              />
            ))}
          </View>
        )}

        {/* Recent Transactions */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gastos Recientes</Text>
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('Transactions')}
            >
              <Text style={styles.viewAll}>Ver todos →</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length > 0 ? (
            <View style={styles.transactionList}>
              {recentTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  categories={categories}
                  currentUserId={user?.id || ''}
                  onPress={handleTransactionPress}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>
                No hay gastos registrados. ¡Agregá el primero!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Add Button */}
      <FloatingAddButton onPress={handleAddExpense} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  staleWarning: {
    fontSize: 12,
    color: Colors.alert,
    marginTop: 4,
  },
  balanceSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingSection: {
    backgroundColor: Colors.alertLight,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.alert,
  },
  pendingViewAll: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  transactionsSection: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  viewAll: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  transactionList: {
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});