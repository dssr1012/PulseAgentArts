// ============================================================
// PulseExpends - Statement Preview Screen
// Pre-visualization of parsed statement data before confirmation
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { formatAmountCompact } from '../../utils/formatters';
import * as cardsApi from '../../api/cards';
import type { StatementPreview, StatementItem } from '../../types';

interface StatementPreviewScreenProps {
  route: { params: { previewId: string; cardId: string; preview?: StatementPreview } };
}

export function StatementPreviewScreen({ route }: StatementPreviewScreenProps) {
  const navigation = useNavigation();
  const { previewId, preview: initialPreview } = route.params;
  const [isConfirming, setIsConfirming] = useState(false);

  const [preview, setPreview] = useState<StatementPreview | null>(initialPreview ?? null);

  const handleConfirm = async () => {
    Alert.alert(
      'Confirmar Resumen',
      'Se crearán gastos a partir de los items del resumen. ¿Confirmar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setIsConfirming(true);
            try {
              const result = await cardsApi.confirmStatement(previewId);
              Alert.alert(
                '✅ Resumen Confirmado',
                `Se crearon ${result.created_expense_ids.length} gastos.`
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'No se pudo confirmar el resumen');
            } finally {
              setIsConfirming(false);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: StatementItem }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <Text style={styles.itemDate}>
          {new Date(item.date).toLocaleDateString('es-AR')}
        </Text>
        <Text style={styles.itemDescription} numberOfLines={1}>
          {item.description}
        </Text>
      </View>
      <Text style={[styles.itemAmount, { color: Colors.expense }]}>
        -{formatAmountCompact(item.amount, item.currency)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Resumen de Tarjeta</Text>
        {preview && (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fecha de Cierre</Text>
              <Text style={styles.summaryValue}>
                {new Date(preview.closing_date).toLocaleDateString('es-AR')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fecha de Vencimiento</Text>
              <Text style={styles.summaryValue}>
                {new Date(preview.due_date).toLocaleDateString('es-AR')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={[styles.summaryValue, { color: Colors.expense, fontWeight: '700' }]}>
                {formatAmountCompact(preview.total_amount, preview.currency)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pago Mínimo</Text>
              <Text style={styles.summaryValue}>
                {formatAmountCompact(preview.min_payment, preview.currency)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Items */}
      <Text style={styles.itemsTitle}>Items del Resumen</Text>
      {preview ? (
        <FlatList
          data={preview.items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.date}-${index}`}
          contentContainerStyle={styles.itemsList}
        />
      ) : (
        <View style={styles.noPreview}>
          <Text style={styles.noPreviewText}>
            Los datos del resumen aparecerán aquí después de la carga
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.confirmButton, isConfirming && styles.disabledButton]}
          onPress={handleConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={styles.confirmButtonText}>✅ Confirmar Resumen</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => (navigation as any).goBack()}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    gap: 8,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  itemsTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 16, marginBottom: 8 },
  itemsList: { paddingHorizontal: 16, paddingBottom: 100 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  itemLeft: { flex: 1, gap: 2 },
  itemDate: { fontSize: 11, color: Colors.textTertiary },
  itemDescription: { fontSize: 14, color: Colors.textPrimary },
  itemAmount: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  noPreview: { padding: 32, alignItems: 'center' },
  noPreviewText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    gap: 8,
  },
  confirmButton: {
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.6 },
  confirmButtonText: { fontSize: 16, fontWeight: '700', color: Colors.textInverse },
  cancelButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 14, color: Colors.textSecondary },
});