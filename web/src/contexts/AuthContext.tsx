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
  // isLoading starts false: the token is held in memory only, so there is no
  // async session to restore on mount. Starting true would render the SSR HTML
  // with all inputs disabled (disabled={isLoading}) and "Signing in..." on the
  // button; if hydration then fails the page is frozen forever. False is correct.
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    error: null,
  });

  // No async session check on mount: access token is in memory only and is lost
  // on reload, so the user is always unauthenticated on a fresh page load.
  useEffect(() => {
    setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
  }, []);

  const handleAuthSuccess = useCallback((response: Record<string, unknown>): User => {
    // After camelToSnake conversion, accessToken → access_token
    const accessToken = (response.access_token ?? response.accessToken) as string;
    apiClient.setAccessToken(accessToken);
    const u = (response.user ?? {}) as Record<string, unknown>;
    const user: User = {
      id: u.id as string,
      email: u.email as string,
      given_name: (u.given_name ?? u.givenName ?? '') as string,
      picture_url: (u.picture_url ?? u.pictureUrl ?? null) as string | null,
      auth_provider: (u.auth_provider ?? u.authProvider ?? 'traditional') as User['auth_provider'],
      circle_id: (u.circle_id ?? u.circleId ?? null) as string | null,
      circle_role: (u.circle_role ?? u.role ?? null) as User['circle_role'],
      created_at: (u.created_at ?? u.createdAt ?? '') as string,
      must_change_password: (u.must_change_password ?? u.mustChangePassword ?? false) as boolean,
    };
    setState({
      user,
      isLoading: false,
      isAuthenticated: true,
      error: null,
    });
    return user;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await apiClient.login(email, password);
      return handleAuthSuccess(response);
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
            given_name: payload.givenName || payload.given_name || prev.user?.given_name || '',
            picture_url: payload.picture || payload.pictureUrl || prev.user?.picture_url || null,
            auth_provider: payload.authProvider || payload.auth_provider || prev.user?.auth_provider || 'traditional',
            circle_id: payload.circleId || payload.circle_id || prev.user?.circle_id || null,
            circle_role: payload.role || payload.circleRole || prev.user?.circle_role || null,
            created_at: payload.createdAt || payload.created_at || prev.user?.created_at || '',
            must_change_password: payload.mustChangePassword || payload.must_change_password || prev.user?.must_change_password || false,
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