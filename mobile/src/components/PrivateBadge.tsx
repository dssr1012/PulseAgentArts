// ============================================================
// PulseExpends - Private Badge Component
// Shows obfuscated view for other members' private expenses
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface PrivateBadgeProps {
  creatorName?: string;
  hiddenUntil?: string;
}

export function PrivateBadge({ creatorName, hiddenUntil }: PrivateBadgeProps) {
  const displayText = creatorName
    ? `Gasto Privado de ${creatorName}`
    : 'Gasto Privado';

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.text}>{displayText}</Text>
      {hiddenUntil && (
        <Text style={styles.until}>
          Visible: {new Date(hiddenUntil).toLocaleDateString('es-AR')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.privacyLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  icon: {
    fontSize: 12,
  },
  text: {
    fontSize: 11,
    color: Colors.privacy,
    fontWeight: '600',
  },
  until: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginLeft: 4,
  },
});