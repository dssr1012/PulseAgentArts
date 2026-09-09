// ============================================================
// PulseExpends - Auth Store (Zustand)
// Manages authentication state, user data, and circle context
// ============================================================

import { create } from 'zustand';
import type { User, AuthTokens, CircleRole } from '../types';
import * as tokenStorage from '../services/tokenStorage';

interface AuthStoreState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  circleId: string | null;
  circleRole: CircleRole | null;

  // Actions
  setAuth: (user: User, tokens: AuthTokens) => Promise<void>;
  setCircleContext: (circleId: string, role: CircleRole) => Promise<void>;
  updateTokens: (tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  circleId: null,
  circleRole: null,

  setAuth: async (user: User, tokens: AuthTokens) => {
    await tokenStorage.saveTokens(tokens);
    await tokenStorage.saveUser(user);
    set({
      user,
      tokens,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  setCircleContext: async (circleId: string, role: CircleRole) => {
    await tokenStorage.saveCircleContext(circleId, role);
    set({ circleId, circleRole: role });
  },

  updateTokens: async (tokens: AuthTokens) => {
    await tokenStorage.saveTokens(tokens);
    set({ tokens });
  },

  logout: async () => {
    await tokenStorage.clearAll();
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      circleId: null,
      circleRole: null,
    });
  },

  initialize: async () => {
    try {
      const [tokens, user, circleId, circleRole] = await Promise.all([
        tokenStorage.getTokens(),
        tokenStorage.getUser(),
        tokenStorage.getCircleId(),
        tokenStorage.getCircleRole(),
      ]);

      if (tokens && user) {
        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
          circleId,
          circleRole,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));