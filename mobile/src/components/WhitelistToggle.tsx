// ============================================================
// PulseExpends - Whitelist Toggle Component
// Toggle for enabling/disabling notification interception per app
// ============================================================

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import type { WhitelistedApp } from '../types';

interface WhitelistToggleProps {
  app: WhitelistedApp;
  onToggle: (packageName: string) => void;
}

export function WhitelistToggle({ app, onToggle }: WhitelistToggleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Text style={styles.appIcon}>{getAppIcon(app.package_name)}</Text>
        <View>
          <Text style={styles.appName}>{app.display_name}</Text>
          <Text style={styles.packageName} numberOfLines={1}>
            {app.package_name}
          </Text>
        </View>
      </View>
      <Switch
        value={app.enabled}
        onValueChange={() => onToggle(app.package_name)}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={app.enabled ? Colors.background : Colors.textTertiary}
      />
    </View>
  );
}

function getAppIcon(packageName: string): string {
  const icons: Record<string, string> = {
    'com.mercadopago.app': '💳',
    'ar.modo.app': '🔄',
    'com.google.android.apps.walletnfcrel': '📱',
    'com.santander.app': '🏦',
    'com.bancogalicia.app': '🏦',
    'com.bancohipotecario.app': '🏦',
    'com.bbva.app': '🏦',
    'com.icbc.app': '🏦',
  };
  return icons[packageName] || '📦';
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
    gap: 12,
  },
  appIcon: {
    fontSize: 24,
  },
  appName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  packageName: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
});