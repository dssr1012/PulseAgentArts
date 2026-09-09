// ============================================================
// PulseExpends - Quick Entry Screen
// Optimized for point-of-sale: numpad, currency, category, submit
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Keyboard,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTransactionStore } from '../../store/transactionStore';
import { Colors } from '../../constants/colors';
import { CURRENCY_SYMBOLS } from '../../constants/currencies';
import { getTodayISO } from '../../utils/dates';
import { NumPad } from '../../components/NumPad';
import { CurrencySelector } from '../../components/CurrencySelector';
import { CategoryGrid } from '../../components/CategoryGrid';
import { PrivacyToggle } from '../../components/PrivacyToggle';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import * as haptics from '../../services/hapticFeedback';
import type { Currency, Category } from '../../types';

export function QuickEntryScreen() {
  const { user } = useAuth();
  const { categories, addExpense } = useTransactionStore();

  // Form state
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [merchantName, setMerchantName] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayISO());
  const [isPrivate, setIsPrivate] = useState(false);
  const [hiddenUntil, setHiddenUntil] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = parseFloat(amountStr) || 0;
  const canSubmit = amount > 0 && selectedCategory !== null;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedCategory) return;

    Keyboard.dismiss();
    setIsSubmitting(true);
    haptics.mediumImpact();

    try {
      await addExpense({
        amount,
        currency,
        category_id: selectedCategory.id,
        merchant_name: merchantName || undefined,
        description: description || undefined,
        transaction_date: transactionDate,
        is_private: isPrivate || undefined,
        hidden_until: hiddenUntil || undefined,
        source: 'manual',
        confirmation_status: 'confirmed',
      });

      haptics.successNotification();

      // Reset form
      setAmountStr('');
      setMerchantName('');
      setDescription('');
      setSelectedCategory(null);
      setIsPrivate(false);
      setHiddenUntil(undefined);

      Alert.alert('✅ Gasto registrado', `${CURRENCY_SYMBOLS[currency]}${amount.toFixed(2)} en ${merchantName || selectedCategory.name}`);
    } catch (err: any) {
      haptics.errorNotification();
      Alert.alert('Error', err?.message || 'No se pudo registrar el gasto');
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, amount, currency, selectedCategory, merchantName, description, transactionDate, isPrivate, hiddenUntil]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Amount Display */}
      <View style={styles.amountSection}>
        <Text style={styles.amountLabel}>Monto</Text>
        <View style={styles.amountDisplay}>
          <Text style={styles.currencySymbol}>{CURRENCY_SYMBOLS[currency]}</Text>
          <Text style={styles.amountText}>
            {amountStr || '0'}
          </Text>
        </View>
      </View>

      {/* Currency Selector */}
      <CurrencySelector selected={currency} onChange={setCurrency} />

      {/* NumPad */}
      <View style={styles.numpadSection}>
        <NumPad value={amountStr} onChange={setAmountStr} />
      </View>

      {/* Category Quick-Select Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categoría</Text>
        <CategoryGrid
          categories={categories}
          selectedId={selectedCategory?.id}
          onSelect={setSelectedCategory}
        />
      </View>

      {/* Merchant / Description */}
      <View style={styles.section}>
        <TextInput
          style={styles.input}
          placeholder="Comercio / Negocio"
          placeholderTextColor={Colors.textTertiary}
          value={merchantName}
          onChangeText={setMerchantName}
          autoFocus={false}
          returnKeyType="next"
        />
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          placeholder="Descripción (opcional)"
          placeholderTextColor={Colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />
      </View>

      {/* Date (defaults to today) */}
      <View style={styles.section}>
        <Text style={styles.dateLabel}>
          📅 Fecha: {new Date(transactionDate).toLocaleDateString('es-AR')}
        </Text>
      </View>

      {/* Privacy Toggle */}
      <View style={styles.section}>
        <PrivacyToggle
          isPrivate={isPrivate}
          hiddenUntil={hiddenUntil}
          onTogglePrivate={setIsPrivate}
          onSetHiddenUntil={setHiddenUntil}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!canSubmit || isSubmitting) && styles.disabledButton,
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit || isSubmitting}
      >
        {isSubmitting ? (
          <LoadingSpinner />
        ) : (
          <Text style={styles.submitButtonText}>Registrar Gasto</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  amountLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginRight: 4,
  },
  amountText: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  numpadSection: {
    marginHorizontal: -4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  descriptionInput: {
    height: 64,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  dateLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  submitButton: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});