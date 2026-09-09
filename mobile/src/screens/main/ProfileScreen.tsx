// ============================================================
// PulseExpends - Profile Screen
// User info, circle, notification settings, logout
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/colors';
import { unregisterForPushNotifications } from '../../services/pushNotifications';
import { stopListener } from '../../services/notificationListener';

export function ProfileScreen() {
  const { user, circleId, circleRole, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro que querés cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await unregisterForPushNotifications();
          await stopListener();
          await logout();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Info */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.given_name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.given_name || 'Usuario'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      {/* Circle Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Círculo Familiar</Text>
        {circleId ? (
          <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
            <Text style={styles.menuItemIcon}>👨‍👩‍👧‍👦</Text>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Mi Círculo</Text>
              <Text style={styles.menuItemSubtitle}>
                {circleRole === 'admin' ? 'Administrador' : 'Miembro'}
              </Text>
            </View>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
            <Text style={styles.menuItemIcon}>➕</Text>
            <Text style={styles.menuItemTitle}>Crear Círculo Familiar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificaciones</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
          <Text style={styles.menuItemIcon}>🔔</Text>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Configuración de Notificaciones</Text>
            <Text style={styles.menuItemSubtitle}>Apps, modo de captura</Text>
          </View>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
          <Text style={styles.menuItemIcon}>⏳</Text>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Gastos por Confirmar</Text>
            <Text style={styles.menuItemSubtitle}>Capturas automáticas pendientes</Text>
          </View>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Other Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
          <Text style={styles.menuItemIcon}>💱</Text>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Tasas de Cambio</Text>
          </View>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
          <Text style={styles.menuItemIcon}>📊</Text>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemTitle}>Gastos Irregulares</Text>
          </View>
          <Text style={styles.menuItemArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.textInverse,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: Colors.primary },
  userName: { fontSize: 20, fontWeight: '700', color: Colors.textInverse },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  menuItemIcon: { fontSize: 20 },
  menuItemContent: { flex: 1 },
  menuItemTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  menuItemSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  menuItemArrow: { fontSize: 16, color: Colors.textTertiary },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.expenseLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: Colors.expense },
});