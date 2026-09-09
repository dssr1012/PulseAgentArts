// ============================================================
// PulseExpends - App Configuration Constants
// ============================================================

import type { WhitelistedApp, NotificationMode } from '../types';
import Constants from 'expo-constants';

export const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:3000/api/v1';

export const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleWebClientId ?? '';

export const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'pulse_expends_access_token',
  REFRESH_TOKEN: 'pulse_expends_refresh_token',
  USER_DATA: 'pulse_expends_user_data',
  CIRCLE_ID: 'pulse_expends_circle_id',
  CIRCLE_ROLE: 'pulse_expends_circle_role',
} as const;

export const ASYNC_STORAGE_KEYS = {
  REGEX_DICTIONARY: 'pulse_expends_regex_dict',
  REGEX_VERSION: 'pulse_expends_regex_version',
  NOTIFICATION_CONFIG: 'pulse_expends_notification_config',
  DUPLICATE_CACHE: 'pulse_expends_duplicate_cache',
  DEVICE_TOKEN: 'pulse_expends_device_token',
} as const;

export const API_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 4000,
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Pre-configured whitelisted financial apps
export const DEFAULT_WHITELISTED_APPS: WhitelistedApp[] = [
  { package_name: 'com.mercadopago.app', display_name: 'Mercado Pago', enabled: false },
  { package_name: 'ar.modo.app', display_name: 'MODO', enabled: false },
  { package_name: 'com.google.android.apps.walletnfcrel', display_name: 'Google Wallet', enabled: false },
  { package_name: 'com.santander.app', display_name: 'Santander', enabled: false },
  { package_name: 'com.bancogalicia.app', display_name: 'Galicia', enabled: false },
  { package_name: 'com.bancohipotecario.app', display_name: 'Hipotecario', enabled: false },
  { package_name: 'com.bbva.app', display_name: 'BBVA', enabled: false },
  { package_name: 'com.icbc.app', display_name: 'ICBC', enabled: false },
];

export const DEFAULT_NOTIFICATION_MODE: NotificationMode = 'quick_confirmation';

export const DUPLICATE_CACHE_CONFIG = {
  MAX_ENTRIES: 100,
  TTL_HOURS: 24,
} as const;

export const CARD_DUE_REMINDER_DAYS_BEFORE = 3;