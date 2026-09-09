'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, ApiError } from '@/types';
import { apiClient } from '@/lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, givenName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeJwtPayload(token: string): any {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // Check for existing session on mount
  useEffect(() => {
    // No localStorage check - access token is in memory only
    // If we had a session, it would have been set during login/register
    setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
  }, []);

  const handleAuthSuccess = useCallback((response: { accessToken: string; user: User }) => {
    apiClient.setAccessToken(response.accessToken);
    setState({
      user: response.user,
      isLoading: false,
      isAuthenticated: true,
      error: null,
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await apiClient.login(email, password);
      handleAuthSuccess(response);
    } catch (err) {
      const apiError = err as ApiError;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: apiError.message || 'Invalid email or password.',
      }));
      throw err;
    }
  }, [handleAuthSuccess]);

  const register = useCallback(async (email: string, password: string, givenName: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await apiClient.register(email, password, givenName);
      handleAuthSuccess(response);
    } catch (err) {
      const apiError = err as ApiError;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: apiError.message || 'Registration failed.',
      }));
      throw err;
    }
  }, [handleAuthSuccess]);

  const loginWithGoogle = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error('Google Client ID not configured');
      }

      // Google OAuth2 popup flow
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      const scope = 'openid email profile';

      // Generate cryptographically secure state parameter
      const stateArray = new Uint8Array(32);
      crypto.getRandomValues(stateArray);
      const state = Array.from(stateArray, (b) => b.toString(16).padStart(2, '0')).join('');

      // Store state in sessionStorage for verification in callback
      sessionStorage.setItem('google_oauth_state', state);

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      const width = 500;
      const height = 600;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      const popup = window.open(
        authUrl.toString(),
        'GoogleSignIn',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popup) {
        // Popup blocked - fallback to redirect
        window.location.href = authUrl.toString();
        return;
      }

      // Listen for popup callback
      return new Promise<void>((resolve, reject) => {
        const handleMessage = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (event.data.type !== 'google-auth-callback') return;

          window.removeEventListener('message', handleMessage);
          popup.close();

          try {
            const { code, receivedState } = event.data;

            // Verify state parameter to prevent CSRF
            const savedState = sessionStorage.getItem('google_oauth_state');
            sessionStorage.removeItem('google_oauth_state');

            if (!savedState || receivedState !== savedState) {
              throw new Error('OAuth state verification failed');
            }

            // Exchange the one-time auth code for tokens via backend
            const response = await apiClient.exchangeAuthCode(code);
            handleAuthSuccess(response);
            resolve();
          } catch (error) {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              error: 'Google sign-in failed. Please try again.',
            }));
            reject(error);
          }
        };

        window.addEventListener('message', handleMessage);

        // Check if popup was closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            setState((prev) => ({ ...prev, isLoading: false }));
          }
        }, 1000);
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Google sign-in failed. Please try again.',
      }));
      throw err;
    }
  }, [handleAuthSuccess]);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } finally {
      apiClient.clearTokens();
      setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const refreshUser = useCallback(async () => {
    // Re-read in-memory access token to refresh user state
    const token = apiClient.getAccessToken();
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload) {
        setState((prev) => ({
          ...prev,
          user: {
            id: payload.sub,
            email: payload.email || prev.user?.email || '',
            given_name: payload.given_name || prev.user?.given_name || '',
            picture_url: payload.picture || prev.user?.picture_url || null,
            auth_provider: payload.auth_provider || prev.user?.auth_provider || 'traditional',
            circle_id: payload.circle_id || prev.user?.circle_id || null,
            circle_role: payload.role || prev.user?.circle_role || null,
            created_at: payload.created_at || prev.user?.created_at || '',
          },
        }));
      } else {
        // Token invalid, logout
        apiClient.clearTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        loginWithGoogle,
        logout,
        clearError,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}