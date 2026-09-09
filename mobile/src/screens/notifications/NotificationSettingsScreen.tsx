// ============================================================
// PulseExpends - Notification Settings Screen
// App whitelist, mode selector, permission management
// ============================================================

import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import { useNotificationStore } from '../../store/notificationStore';
import { WhitelistToggle } from '../../components/WhitelistToggle';
import {
  isNotificationPermissionGranted,
  requestNotificationPermission,
  startListener,
  stopListener,
} from '../../services/notificationListener';
import type { NotificationMode } from '../../types';

export function NotificationSettingsScreen() {
  const { config, isListenerActive, setMode, toggleApp, setPermissionGranted } =
    useNotificationStore();

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await isNotificationPermissionGranted();
      setPermissionGranted(granted);
    }
  };

  const handleRequestPermission = () => {
    requestNotificationPermission();
  };

  const handleToggleListener = async () => {
    if (isListenerActive) {
      await stopListener();
    } else {
      const granted = await isNotificationPermissionGranted();
      if (!granted) {
        requestNotificationPermission();
      } else {
        await startListener();
      }
    }
  };

  const handleModeChange = (mode: NotificationMode) => {
    Alert.alert(
      'Cambiar Modo',
      mode === 'quick_confirmation'
        ? 'Se mostrará una notificación para confirmar cada gasto detectado.'
        : 'Los gastos se registrarán automáticamente y aparecerán en la lista de pendientes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => setMode(mode) },
      ]
    );
  };

  const handleAddCustomApp = () => {
    Alert.prompt(
      'Agregar App Personalizada',
      'Ingrese el nombre del paquete de la app (ej: com.app.name)',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Agregar',
          onPress: (packageName?: string) => {
            if (packageName) {
              useNotificationStore.getState().addCustomApp({
                package_name: packageName,
                display_name: packageName.split('.').pop() || packageName,
                enabled: true,
              });
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Permission Status (Android only) */}
      {Platform.OS === 'android' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permiso de Notificaciones</Text>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionIcon}>
              {config.is_permission_granted ? '✅' : '❌'}
            </Text>
            <View style={styles.permissionContent}>
              <Text style={styles.permissionStatus}>
                {config.is_permission_granted
                  ? 'Acceso a notificaciones concedido'
                  : 'Acceso a notificaciones no concedido'}
              </Text>
              <Text style={styles.permissionHint}>
                Requerido para detectar gastos de apps financieras
              </Text>
            </View>
          </View>
          {!config.is_permission_granted && (
            <TouchableOpacity
              style={styles.enableButton}
              onPress={handleRequestPermission}
            >
              <Text style={styles.enableButtonText}>Habilitar Acceso</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Listener Toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Servicio de Captura</Text>
        <TouchableOpacity
          style={[styles.listenerToggle, isListenerActive && styles.listenerActive]}
          onPress={handleToggleListener}
        >
          <Text style={styles.listenerIcon}>{isListenerActive ? '🟢' : '🔴'}</Text>
          <Text style={styles.listenerStatus}>
            {isListenerActive ? 'Servicio activo' : 'Servicio inactivo'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Mode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Modo de Confirmación</Text>
        <View style={styles.modeContainer}>
          <TouchableOpacity
            style={[
              styles.modeOption,
              config.mode === 'quick_confirmation' && styles.modeOptionActive,
            ]}
            onPress={() => handleModeChange('quick_confirmation')}
          >
            <Text style={styles.modeIcon}>👆</Text>
            <Text style={styles.modeTitle}>Confirmación Rápida</Text>
            <Text style={styles.modeDescription}>
              Notificación con botones [Confirmar] y [Editar/Descartar]
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeOption,
              config.mode === 'silent_auto_registration' && styles.modeOptionActive,
            ]}
            onPress={() => handleModeChange('silent_auto_registration')}
          >
            <Text style={styles.modeIcon}>🤫</Text>
            <Text style={styles.modeTitle}>Registro Automático</Text>
            <Text style={styles.modeDescription}>
              Se registra automáticamente y aparece en pendientes
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Whitelist */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Apps Monitoreadas</Text>
          <TouchableOpacity onPress={handleAddCustomApp}>
            <Text style={styles.addAppText}>+ Agregar</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionHint}>
          Habilitá las apps de las que querés capturar gastos automáticamente
        </Text>
        {config.whitelisted_apps.map((app) => (
          <WhitelistToggle
            key={app.package_name}
            app={app}
            onToggle={toggleApp}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHint: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  permissionIcon: { fontSize: 24 },
  permissionContent: { flex: 1 },
  permissionStatus: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  permissionHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  enableButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  enableButtonText: { fontSize: 14, fontWeight: '700', color: Colors.textInverse },
  listenerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  listenerActive: { backgroundColor: Colors.successLight },
  listenerIcon: { fontSize: 20 },
  listenerStatus: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  modeContainer: { gap: 8 },
  modeOption: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EBF5FF',
  },
  modeIcon: { fontSize: 24, marginBottom: 4 },
  modeTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  modeDescription: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  addAppText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});