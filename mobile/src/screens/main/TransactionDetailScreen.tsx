// ============================================================
// PulseExpends - Transaction Detail Screen
// ============================================================

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { formatAmountCompact } from '../../constants/currencies';
import { toDisplayDate, toDisplayDateTime } from '../../utils/dates';
import { PrivateBadge } from '../../components/PrivateBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import * as expensesApi from '../../api/expenses';
import { useAuth } from '../../context/AuthContext';
import type { Transaction } from '../../types';

interface TransactionDetailScreenProps {
  route: { params: { transactionId: string } };
}

export function TransactionDetailScreen({ route }: TransactionDetailScreenProps) {
  const { transactionId } = route.params;
  const { user } = useAuth();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await expensesApi.getExpense(transactionId);
        setTransaction(data);
      } catch {
        // Error handling
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [transactionId]);

  if (isLoading) return <LoadingSpinner fullScreen message="Cargando..." />;
  if (!transaction) return <View style={styles.container}><Text style={styles.error}>Gasto no encontrado</Text></View>;

  const isOwnPrivate = transaction.is_private && transaction.user_id === user?.id;
  const isOtherPrivate = transaction.is_private && transaction.user_id !== user?.id;
  const isExpense = transaction.type === 'expense';
  const isPending = transaction.confirmation_status === 'pending_confirmation';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Amount */}
      <View style={styles.amountSection}>
        <Text style={[styles.amount, { color: isExpense ? Colors.expense : Colors.success }]}>
          {isExpense ? '-' : '+'}{formatAmountCompact(transaction.amount, transaction.currency)}
        </Text>
        {isPending && <Text style={styles.pendingBadge}>⏳ Pendiente de confirmación</Text>}
      </View>

      {/* Privacy Badge */}
      {(isOwnPrivate || isOtherPrivate) && (
        <PrivateBadge
          creatorName={isOtherPrivate ? transaction.user?.given_name : undefined}
          hiddenUntil={transaction.hidden_until}
        />
      )}

      {/* Details */}
      <View style={styles.detailsSection}>
        <DetailRow label="Categoría" value={transaction.category?.name || '—'} />
        <DetailRow
          label="Comercio"
          value={isOtherPrivate ? '***' : (transaction.merchant_name || '—')}
        />
        <DetailRow
          label="Descripción"
          value={isOtherPrivate ? 'Gasto Privado' : (transaction.description || '—')}
        />
        <DetailRow label="Fecha" value={toDisplayDate(transaction.transaction_date)} />
        <DetailRow label="Moneda" value={transaction.currency} />
        <DetailRow label="Registrado" value={toDisplayDateTime(transaction.created_at)} />
        <DetailRow label="Origen" value={getSourceLabel(transaction.source)} />
        {isOwnPrivate && transaction.hidden_until && (
          <DetailRow
            label="Visible a partir de"
            value={toDisplayDate(transaction.hidden_until)}
          />
        )}
      </View>

      {/* Actions */}
      {isPending && (
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.confirmButton} onPress={() => {}}>
            <Text style={styles.confirmButtonText}>✅ Confirmar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.discardButton} onPress={() => {}}>
            <Text style={styles.discardButtonText}>🗑 Descartar</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    manual: 'Manual',
    statement: 'Resumen',
    notification_capture: 'Captura automática',
    mcp: 'Asistente',
  };
  return labels[source] || source;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16 },
  amountSection: { alignItems: 'center', paddingVertical: 16 },
  amount: { fontSize: 32, fontWeight: '700' },
  pendingBadge: {
    fontSize: 13,
    color: Colors.alert,
    fontWeight: '600',
    marginTop: 4,
  },
  detailsSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.success,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  discardButton: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.expense,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discardButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  error: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
});

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
});