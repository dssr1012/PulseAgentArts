// ============================================================
// PulseExpends - Cards Screen
// Credit card management and statement upload
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import * as cardsApi from '../../api/cards';
import type { CreditCard } from '../../types';

export function CardsScreen() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const data = await cardsApi.listCards();
      setCards(data);
    } catch {
      // Error handling
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCards();
    setIsRefreshing(false);
  };

  const renderItem = ({ item }: { item: CreditCard }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>💳</Text>
        <Text style={styles.bankName}>{item.bank_name}</Text>
      </View>
      <View style={styles.cardDetails}>
        <Text style={styles.cardType}>{item.card_type}</Text>
        <Text style={styles.lastFour}>**** {item.last_four_digits}</Text>
      </View>
      {item.due_date && (
        <Text style={styles.dueDate}>
          Vencimiento: {new Date(item.due_date).toLocaleDateString('es-AR')}
        </Text>
      )}
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={() => {
          // Navigate to StatementUpload
        }}
      >
        <Text style={styles.uploadButtonText}>📄 Subir Resumen</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) return <LoadingSpinner fullScreen message="Cargando tarjetas..." />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tarjetas</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => {}}>
          <Text style={styles.addButtonText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cards}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyText}>No hay tarjetas registradas</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: { fontSize: 13, fontWeight: '700', color: Colors.textInverse },
  listContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardIcon: { fontSize: 24 },
  bankName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardType: { fontSize: 13, color: Colors.textSecondary },
  lastFour: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  dueDate: { fontSize: 12, color: Colors.alert, marginBottom: 8 },
  uploadButton: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  uploadButtonText: { fontSize: 13, fontWeight: '600', color: Colors.textInverse },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});