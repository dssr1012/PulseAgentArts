// ============================================================
// PulseExpends - Auth Context Provider
// Provides auth state and actions to the component tree
// ============================================================

import React, { useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import * as authApi from '../api/auth';
import * as googleSignInService from '../services/googleSignIn';
import { PulseExpendsApiError } from '../api/client';
import type { User, AuthTokens } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  circleId: string | null;
  circleRole: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, givenName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const store = useAuthStore();

  // Initialize auth state on mount
  useEffect(() => {
    store.initialize();
    googleSignInService.configureGoogleSignIn();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      await store.setAuth(response.user, {
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      });

      // Extract circle context from JWT if available
      // The JWT payload contains circle_id and role
      const tokenPayload = JSON.parse(
        atob(response.access_token.split('.')[1])
      );
      if (tokenPayload.circle_id && tokenPayload.role) {
        await store.setCircleContext(tokenPayload.circle_id, tokenPayload.role);
      }
    } catch (error) {
      if (error instanceof PulseExpendsApiError) {
        throw error;
      }
      throw new PulseExpendsApiError('AUTH_INVALID_CREDENTIALS', 'Email o contraseña incorrectos', 401);
    }
  }, [store]);

  const register = useCallback(async (email: string, password: string, givenName: string) => {
    try {
      const response = await authApi.register({
        email,
        password,
        given_name: givenName,
      });
      await store.setAuth(response.user, {
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      });
    } catch (error) {
      if (error instanceof PulseExpendsApiError) {
        throw error;
      }
      throw new PulseExpendsApiError('AUTH_INVALID_INPUT', 'Error en el registro', 400);
    }
  }, [store]);

  const loginWithGoogle = useCallback(async () => {
    try {
      const { idToken } = await googleSignInService.signIn();
      const response = await authApi.googleSignIn(idToken);
      await store.setAuth(response.user, {
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      });

      const tokenPayload = JSON.parse(
        atob(response.access_token.split('.')[1])
      );
      if (tokenPayload.circle_id && tokenPayload.role) {
        await store.setCircleContext(tokenPayload.circle_id, tokenPayload.role);
      }
    } catch (error) {
      await googleSignInService.signOut();
      if (error instanceof PulseExpendsApiError) {
        throw error;
      }
      throw new PulseExpendsApiError('AUTH_SSO_TOKEN_INVALID', 'Error al iniciar sesión con Google', 401);
    }
  }, [store]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors
    }
    await googleSignInService.signOut();
    await store.logout();
  }, [store]);

  const value: AuthContextValue = {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    circleId: store.circleId,
    circleRole: store.circleRole,
    login,
    register,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}