// ============================================================
// PulseExpends - Statement Upload Screen
// Camera capture + file picker for statement upload
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '../../constants/colors';
import * as cardsApi from '../../api/cards';
import { PulseExpendsApiError } from '../../api/client';
import type { StatementPreview } from '../../types';

interface StatementUploadScreenProps {
  route: { params: { cardId: string } };
  navigation: { navigate: (screen: string, params?: any) => void };
}

export function StatementUploadScreen({ route, navigation }: StatementUploadScreenProps) {
  const { cardId } = route.params;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingFile, setPendingFile] = useState<{
    uri: string;
    type: 'application/pdf' | 'text/plain';
  } | null>(null);

  const handleCameraCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara para escanear resúmenes.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0].uri, 'application/pdf');
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo acceder a la cámara');
    }
  };

  const handleFilePicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileType = asset.mimeType || 'application/pdf';
        await uploadFile(asset.uri, fileType as 'application/pdf' | 'text/plain');
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const uploadFile = async (
    fileUri: string,
    fileType: 'application/pdf' | 'text/plain',
    password?: string
  ) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const preview = await cardsApi.uploadStatement(
        cardId,
        fileUri,
        fileType,
        (progress) => setUploadProgress(progress),
        password
      );

      // Navigate to preview screen
      navigation.navigate('StatementPreview', {
        previewId: preview.preview_id,
        cardId,
        preview,
      });
    } catch (err) {
      if (err instanceof PulseExpendsApiError) {
        switch (err.code) {
          case 'STMT_UNSUPPORTED_FORMAT':
            Alert.alert('Error', 'Formato no soportado. Use PDF o texto plano.');
            break;
          case 'STMT_FILE_TOO_LARGE':
            Alert.alert('Error', 'El archivo es demasiado grande (máximo 10 MB).');
            break;
          case 'STMT_PASSWORD_REQUIRED':
            setPendingFile({ uri: fileUri, type: fileType });
            setNeedsPassword(true);
            break;
          case 'STMT_ALREADY_UPLOADED':
            Alert.alert('Ya cargado', 'Este resumen ya fue cargado para esta tarjeta.');
            break;
          case 'STMT_PARSE_FAILED':
            Alert.alert('Error', 'No se pudo analizar el resumen. Verifique que sea un resumen válido.');
            break;
          default:
            Alert.alert('Error', err.message);
        }
      } else {
        Alert.alert('Error', 'Error al subir el archivo');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handlePasswordSubmit = () => {
    if (!passwordInput.trim() || !pendingFile) return;
    const file = pendingFile;
    const pw = passwordInput.trim();
    setNeedsPassword(false);
    setPasswordInput('');
    setPendingFile(null);
    uploadFile(file.uri, file.type, pw);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Subir Resumen</Text>
      <Text style={styles.subtitle}>
        Escaneá o seleccioná el archivo de tu resumen de tarjeta
      </Text>

      {/* Upload Options */}
      <View style={styles.optionsContainer}>
        {/* Camera Option */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleCameraCapture}
          disabled={isUploading}
        >
          <Text style={styles.optionIcon}>📸</Text>
          <Text style={styles.optionTitle}>Escanear con Cámara</Text>
          <Text style={styles.optionDescription}>
            Tomá una foto del resumen en papel
          </Text>
        </TouchableOpacity>

        {/* File Picker Option */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleFilePicker}
          disabled={isUploading}
        >
          <Text style={styles.optionIcon}>📄</Text>
          <Text style={styles.optionTitle}>Seleccionar Archivo</Text>
          <Text style={styles.optionDescription}>
            PDF o texto plano (máx. 10 MB)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Upload Progress */}
      {isUploading && (
        <View style={styles.progressSection}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.progressText}>
            Analizando resumen... {Math.round(uploadProgress * 100)}%
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${uploadProgress * 100}%` }]}
            />
          </View>
        </View>
      )}

      {/* PAN/CVV Notice */}
      <View style={styles.notice}>
        <Text style={styles.noticeIcon}>🔒</Text>
        <Text style={styles.noticeText}>
          Por seguridad, no almacenamos números de tarjeta completos ni códigos de seguridad.
        </Text>
      </View>

      {/* Password Modal */}
      <Modal
        visible={needsPassword}
        transparent
        animationType="fade"
        onRequestClose={() => setNeedsPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>PDF protegido</Text>
            <Text style={styles.modalSubtitle}>
              Ingrese la contraseña del resumen. Se guardará para esta tarjeta.
            </Text>
            <TextInput
              style={styles.passwordInput}
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder="Contraseña del PDF"
              secureTextEntry
              autoFocus
              onSubmitEditing={handlePasswordSubmit}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setNeedsPassword(false);
                  setPasswordInput('');
                  setPendingFile(null);
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handlePasswordSubmit}
              >
                <Text style={styles.modalButtonTextPrimary}>Desbloquear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  optionsContainer: { gap: 12, marginBottom: 24 },
  optionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionIcon: { fontSize: 36, marginBottom: 8 },
  optionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  optionDescription: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  progressSection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  progressText: { fontSize: 14, color: Colors.textSecondary },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  notice: {
    flexDirection: 'row',
    backgroundColor: Colors.alertLight,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginTop: 16,
  },
  noticeIcon: { fontSize: 16 },
  noticeText: { flex: 1, fontSize: 12, color: Colors.alert, lineHeight: 16 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 360,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  passwordInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonSecondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  modalButtonPrimary: { backgroundColor: Colors.primary },
  modalButtonTextSecondary: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  modalButtonTextPrimary: { fontSize: 14, fontWeight: '600', color: '#fff' },
});