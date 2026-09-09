// ============================================================
// PulseExpends - Pending List Screen
// Expenses pending confirmation with swipe actions
// ============================================================

import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useTransactionStore } from '../../store/transactionStore';
import { TransactionItem } from '../../components/TransactionItem';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import * as haptics from '../../services/hapticFeedback';
import type { Transaction } from '../../types';

export function PendingListScreen() {
  const { user } = useAuth();
  const {
    pendingExpenses,
    categories,
    confirmPendingExpense,
    discardPendingExpense,
    loadPendingExpenses,
  } = useTransactionStore();

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  useEffect(() => {
    loadPendingExpenses();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPendingExpenses();
    setIsRefreshing(false);
  };

  const handleConfirm = (expenseId: string) => {
    Alert.alert('Confirmar Gasto', '¿Confirmar este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          haptics.mediumImpact();
          await confirmPendingExpense(expenseId);
          haptics.successNotification();
        },
      },
    ]);
  };

  const handleDiscard = (expenseId: string) => {
    Alert.alert('Descartar Gasto', '¿Descartar este gasto? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: async () => {
          haptics.mediumImpact();
          await discardPendingExpense(expenseId);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.itemContainer}>
      <TransactionItem
        transaction={item}
        categories={categories}
        currentUserId={user?.id || ''}
        onPress={() => {}}
      />
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => handleConfirm(item.id)}
        >
          <Text style={styles.confirmText}>✅ Confirmar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.discardButton}
          onPress={() => handleDiscard(item.id)}
        >
          <Text style={styles.discardText}>🗑 Descartar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={pendingExpenses}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No hay gastos pendientes de confirmación</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingBottom: 20 },
  itemContainer: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.successLight,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  confirmText: { fontSize: 13, fontWeight: '700', color: Colors.success },
  discardButton: {
    flex: 1,
    backgroundColor: Colors.expenseLight,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  discardText: { fontSize: 13, fontWeight: '700', color: Colors.expense },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});