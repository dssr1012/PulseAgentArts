// ============================================================
// PulseExpends - Transaction List Screen
// Infinite scroll, pull-to-refresh, color-coded amounts
// ============================================================

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTransactionStore } from '../../store/transactionStore';
import { Colors } from '../../constants/colors';
import { TransactionItem } from '../../components/TransactionItem';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import type { Transaction } from '../../types';

export function TransactionListScreen() {
  const navigation = useNavigation();
  const { user, circleId } = useAuth();
  const {
    transactions,
    categories,
    isLoadingTransactions,
    isRefreshing,
    hasMore,
    loadTransactions,
    loadMoreTransactions,
    refreshTransactions,
    loadCategories,
  } = useTransactionStore();

  useEffect(() => {
    if (circleId) {
      loadTransactions(circleId, true);
      loadCategories(circleId);
    }
  }, [circleId]);

  const handleRefresh = useCallback(async () => {
    if (circleId) {
      await refreshTransactions(circleId);
    }
  }, [circleId]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingTransactions) {
      loadMoreTransactions();
    }
  }, [hasMore, isLoadingTransactions]);

  const handleTransactionPress = useCallback(
    (transactionId: string) => {
      (navigation as any).navigate('TransactionDetail', { transactionId });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionItem
        transaction={item}
        categories={categories}
        currentUserId={user?.id || ''}
        onPress={handleTransactionPress}
      />
    ),
    [categories, user?.id]
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gastos</Text>
        <Text style={styles.count}>{transactions.length} registros</Text>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !isLoadingTransactions ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No hay gastos registrados</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoadingTransactions && !isRefreshing ? (
            <LoadingSpinner message="Cargando más..." />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  count: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});