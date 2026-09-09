// ============================================================
// PulseExpends - Regex Dictionary API
// ============================================================

import apiClient from './client';
import type { RegexDictionary, ExchangeRateResponse } from '../types';

/**
 * Download the versioned regex pattern dictionary
 */
export async function getRegexDictionary(version?: number): Promise<RegexDictionary> {
  const response = await apiClient.get<RegexDictionary>('/regex-dictionary', {
    params: version ? { version } : undefined,
  });
  return response.data;
}

/**
 * Get current exchange rates with staleness indicator
 */
export async function getExchangeRates(): Promise<ExchangeRateResponse> {
  const response = await apiClient.get<ExchangeRateResponse>('/exchange-rates');
  return response.data;
}

/**
 * Register device token for push notifications
 */
export async function registerDeviceToken(token: string): Promise<void> {
  await apiClient.post('/notifications/device-token', { token });
}

/**
 * Unregister device token (on logout)
 */
export async function unregisterDeviceToken(token: string): Promise<void> {
  await apiClient.delete('/notifications/device-token', {
    data: { token },
  });
}