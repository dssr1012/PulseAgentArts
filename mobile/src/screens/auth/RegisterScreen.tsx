// ============================================================
// PulseExpends - Register Screen
// Email, password, given_name form with validation
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/colors';
import { isValidEmail, isValidPassword, isValidGivenName } from '../../utils/validators';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import type { RegisterScreenProps } from '../../navigation/types';

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [givenName, setGivenName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value.length > 0) {
      const { errors } = isValidPassword(value);
      setPasswordErrors(errors);
    } else {
      setPasswordErrors([]);
    }
  };

  const handleRegister = async () => {
    setError(null);

    if (!isValidEmail(email)) {
      setError('Email inválido');
      return;
    }
    if (!isValidGivenName(givenName)) {
      setError('Ingrese su nombre');
      return;
    }
    const { valid, errors } = isValidPassword(password);
    if (!valid) {
      setError(errors.join('. '));
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, givenName);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'AUTH_EMAIL_EXISTS') {
        setError('Este email ya está registrado');
      } else if (code === 'AUTH_INVALID_INPUT') {
        setError('Datos inválidos. Verifique los campos.');
      } else {
        setError('Error al registrarse. Intente nuevamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Crear Cuenta</Text>
        <Text style={styles.subtitle}>Unite a PulseExpends</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Given Name */}
        <TextInput
          style={styles.input}
          placeholder="Nombre"
          placeholderTextColor={Colors.textTertiary}
          value={givenName}
          onChangeText={setGivenName}
          autoCapitalize="words"
          editable={!isLoading}
        />

        {/* Email */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />

        {/* Password */}
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={Colors.textTertiary}
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry
          autoCapitalize="none"
          editable={!isLoading}
        />

        {/* Password Requirements */}
        {passwordErrors.length > 0 && (
          <View style={styles.passwordHints}>
            {passwordErrors.map((err, i) => (
              <Text key={i} style={styles.passwordHint}>
                • {err}
              </Text>
            ))}
          </View>
        )}

        {/* Register Button */}
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.disabledButton]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <Text style={styles.primaryButtonText}>Registrarse</Text>
          )}
        </TouchableOpacity>

        {/* Back to Login */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          disabled={isLoading}
        >
          <Text style={styles.loginLink}>
            ¿Ya tenés cuenta? <Text style={styles.loginLinkBold}>Iniciá sesión</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  error: {
    fontSize: 13,
    color: Colors.expense,
    textAlign: 'center',
    backgroundColor: Colors.expenseLight,
    borderRadius: 8,
    padding: 8,
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
  passwordHints: {
    backgroundColor: Colors.alertLight,
    borderRadius: 8,
    padding: 8,
  },
  passwordHint: {
    fontSize: 12,
    color: Colors.alert,
  },
  primaryButton: {
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  loginLink: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  loginLinkBold: {
    color: Colors.primary,
    fontWeight: '700',
  },
});