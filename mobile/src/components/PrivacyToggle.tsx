// ============================================================
// PulseExpends - Privacy Toggle Component
// Gift Hidden Mode (Modo Regalo Oculto)
// ============================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { toInputDate } from '../utils/dates';

interface PrivacyToggleProps {
  isPrivate: boolean;
  hiddenUntil?: string;
  onTogglePrivate: (isPrivate: boolean) => void;
  onSetHiddenUntil: (date?: string) => void;
}

export function PrivacyToggle({
  isPrivate,
  hiddenUntil,
  onTogglePrivate,
  onSetHiddenUntil,
}: PrivacyToggleProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.label}>Modo Regalo Oculto</Text>
        <Switch
          value={isPrivate}
          onValueChange={onTogglePrivate}
          trackColor={{ false: Colors.border, true: Colors.privacy }}
          thumbColor={isPrivate ? Colors.background : Colors.textTertiary}
        />
      </View>

      {isPrivate && (
        <View style={styles.dateSection}>
          <Text style={styles.dateLabel}>Visible a partir de:</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <Text style={styles.dateValue}>
              {hiddenUntil
                ? new Date(hiddenUntil).toLocaleDateString('es-AR')
                : 'Seleccionar fecha'}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <View style={styles.quickDates}>
              {/* Quick date options */}
              {[
                { label: '1 semana', days: 7 },
                { label: '2 semanas', days: 14 },
                { label: '1 mes', days: 30 },
                { label: '3 meses', days: 90 },
              ].map(({ label, days }) => (
                <TouchableOpacity
                  key={days}
                  style={styles.quickDateButton}
                  onPress={() => {
                    const date = new Date();
                    date.setDate(date.getDate() + days);
                    onSetHiddenUntil(toInputDate(date));
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.quickDateText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.privacyLight,
    borderRadius: 12,
    padding: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.privacy,
  },
  dateSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  dateLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dateButton: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateValue: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  quickDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  quickDateButton: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.privacy,
  },
  quickDateText: {
    fontSize: 12,
    color: Colors.privacy,
    fontWeight: '600',
  },
});