// ============================================================
// PulseExpends - Circle Screen
// Family circle management, invitations, members
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import * as circlesApi from '../../api/circles';
import type { FamilyGroup, FamilyGroupMember, Invitation } from '../../types';

export function CircleScreen() {
  const { user, circleId, circleRole } = useAuth();
  const [circle, setCircle] = useState<FamilyGroup | null>(null);
  const [members, setMembers] = useState<FamilyGroupMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (circleId) loadCircle();
  }, [circleId]);

  const loadCircle = async () => {
    if (!circleId) return;
    try {
      const data = await circlesApi.getCircle(circleId);
      setCircle(data.circle);
      setMembers(data.members);
    } catch {
      // Error handling
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!circleId || !inviteEmail) return;
    setIsInviting(true);
    try {
      await circlesApi.createInvitation(circleId, { email: inviteEmail });
      Alert.alert('✅ Invitación Enviada', `Se envió una invitación a ${inviteEmail}`);
      setInviteEmail('');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'CIRCLE_PERMISSION_DENIED') {
        Alert.alert('Error', 'Solo el administrador puede enviar invitaciones');
      } else if (code === 'INVITE_ALREADY_MEMBER') {
        Alert.alert('Error', 'Este email ya es miembro del círculo');
      } else {
        Alert.alert('Error', 'No se pudo enviar la invitación');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = (userId: string, userName: string) => {
    Alert.alert('Remover Miembro', `¿Remover a ${userName} del círculo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          if (!circleId) return;
          try {
            await circlesApi.removeMember(circleId, userId);
            setMembers(members.filter((m) => m.user_id !== userId));
          } catch {
            Alert.alert('Error', 'No se pudo remover al miembro');
          }
        },
      },
    ]);
  };

  const renderMember = ({ item }: { item: FamilyGroupMember }) => (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {item.user?.given_name?.charAt(0)?.toUpperCase() || '?'}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.user?.given_name || 'Usuario'}</Text>
        <Text style={styles.memberRole}>
          {item.role === 'admin' ? '👑 Administrador' : 'Miembro'}
        </Text>
      </View>
      {circleRole === 'admin' && item.role !== 'admin' && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveMember(item.user_id, item.user?.given_name || '')}
        >
          <Text style={styles.removeText}>Remover</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading) {
    return <View style={styles.container}><Text style={styles.loadingText}>Cargando...</Text></View>;
  }

  if (!circle) {
    return (
      <View style={styles.container}>
        <Text style={styles.noCircleTitle}>No pertenecés a un Círculo Familiar</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => {}}>
          <Text style={styles.createButtonText}>Crear Círculo Familiar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Circle Info */}
      <View style={styles.circleHeader}>
        <Text style={styles.circleIcon}>👨‍👩‍👧‍👦</Text>
        <Text style={styles.circleName}>{circle.name}</Text>
        <Text style={styles.circleCurrency}>Moneda base: {circle.base_currency}</Text>
      </View>

      {/* Members */}
      <Text style={styles.sectionTitle}>Miembros ({members.length})</Text>
      <FlatList
        data={members}
        renderItem={renderMember}
        keyExtractor={(item) => item.user_id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadCircle} tintColor={Colors.primary} />}
      />

      {/* Invite Form (Admin only) */}
      {circleRole === 'admin' && (
        <View style={styles.inviteSection}>
          <Text style={styles.sectionTitle}>Enviar Invitación</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.inviteInput}
              placeholder="Email del invitado"
              placeholderTextColor={Colors.textTertiary}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isInviting}
            />
            <TouchableOpacity
              style={[styles.inviteButton, isInviting && styles.disabledButton]}
              onPress={handleInvite}
              disabled={isInviting}
            >
              <Text style={styles.inviteButtonText}>Invitar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  circleHeader: {
    backgroundColor: Colors.primary,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  circleIcon: { fontSize: 32, marginBottom: 4 },
  circleName: { fontSize: 20, fontWeight: '700', color: Colors.textInverse },
  circleCurrency: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: { fontSize: 16, fontWeight: '700', color: Colors.textInverse },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  memberRole: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  removeButton: { paddingHorizontal: 12, paddingVertical: 4 },
  removeText: { fontSize: 13, color: Colors.expense, fontWeight: '600' },
  inviteSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  inviteRow: { flexDirection: 'row', gap: 8 },
  inviteInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  inviteButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  disabledButton: { opacity: 0.5 },
  inviteButtonText: { fontSize: 14, fontWeight: '700', color: Colors.textInverse },
  noCircleTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginTop: 40 },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
    alignSelf: 'center',
  },
  createButtonText: { fontSize: 16, fontWeight: '700', color: Colors.textInverse },
  loadingText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
});