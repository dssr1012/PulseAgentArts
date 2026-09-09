// ============================================================
// PulseExpends - Notification Store (Zustand)
// Manages notification listener configuration and state
// ============================================================

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationConfig, NotificationMode, WhitelistedApp } from '../types';
import {
  DEFAULT_WHITELISTED_APPS,
  DEFAULT_NOTIFICATION_MODE,
  ASYNC_STORAGE_KEYS,
} from '../constants/config';

interface NotificationStoreState {
  config: NotificationConfig;
  isListenerActive: boolean;
  lastExtractionResult: {
    amount?: number;
    merchant?: string;
    currency?: string;
    app_name: string;
  } | null;

  // Actions
  loadConfig: () => Promise<void>;
  setMode: (mode: NotificationMode) => Promise<void>;
  toggleApp: (packageName: string) => Promise<void>;
  addCustomApp: (app: WhitelistedApp) => Promise<void>;
  setPermissionGranted: (granted: boolean) => Promise<void>;
  setListenerActive: (active: boolean) => void;
  setLastExtraction: (result: NotificationStoreState['lastExtractionResult']) => void;
}

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  config: {
    mode: DEFAULT_NOTIFICATION_MODE,
    whitelisted_apps: DEFAULT_WHITELISTED_APPS,
    is_permission_granted: false,
  },
  isListenerActive: false,
  lastExtractionResult: null,

  loadConfig: async () => {
    try {
      const stored = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.NOTIFICATION_CONFIG);
      if (stored) {
        const config = JSON.parse(stored) as NotificationConfig;
        set({ config });
      }
    } catch {
      // Use defaults
    }
  },

  setMode: async (mode: NotificationMode) => {
    const config = { ...get().config, mode };
    set({ config });
    await AsyncStorage.setItem(
      ASYNC_STORAGE_KEYS.NOTIFICATION_CONFIG,
      JSON.stringify(config)
    );
  },

  toggleApp: async (packageName: string) => {
    const apps = get().config.whitelisted_apps.map((app) =>
      app.package_name === packageName ? { ...app, enabled: !app.enabled } : app
    );
    const config = { ...get().config, whitelisted_apps: apps };
    set({ config });
    await AsyncStorage.setItem(
      ASYNC_STORAGE_KEYS.NOTIFICATION_CONFIG,
      JSON.stringify(config)
    );
  },

  addCustomApp: async (app: WhitelistedApp) => {
    const apps = [...get().config.whitelisted_apps, app];
    const config = { ...get().config, whitelisted_apps: apps };
    set({ config });
    await AsyncStorage.setItem(
      ASYNC_STORAGE_KEYS.NOTIFICATION_CONFIG,
      JSON.stringify(config)
    );
  },

  setPermissionGranted: async (granted: boolean) => {
    const config = { ...get().config, is_permission_granted: granted };
    set({ config });
    await AsyncStorage.setItem(
      ASYNC_STORAGE_KEYS.NOTIFICATION_CONFIG,
      JSON.stringify(config)
    );
  },

  setListenerActive: (active: boolean) => set({ isListenerActive: active }),

  setLastExtraction: (result) => set({ lastExtractionResult: result }),
}));