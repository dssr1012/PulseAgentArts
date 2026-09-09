// ============================================================
// PulseExpends - Secure Token Storage Service
// Uses expo-secure-store for sensitive token persistence
// ============================================================

import * as SecureStore from 'expo-secure-store';
import { TOKEN_STORAGE_KEYS } from '../constants/config';
import type { AuthTokens, User, CircleRole } from '../types';

/**
 * Save authentication tokens securely
 */
export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
}

/**
 * Retrieve stored authentication tokens
 */
export async function getTokens(): Promise<AuthTokens | null> {
  const accessToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { access_token: accessToken, refresh_token: refreshToken };
}

/**
 * Get the current access token
 */
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Get the current refresh token
 */
export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Save user data (non-sensitive, but stored securely for consistency)
 */
export async function saveUser(user: User): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEYS.USER_DATA, JSON.stringify(user));
}

/**
 * Retrieve stored user data
 */
export async function getUser(): Promise<User | null> {
  const data = await SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.USER_DATA);
  if (!data) return null;
  try {
    return JSON.parse(data) as User;
  } catch {
    return null;
  }
}

/**
 * Save circle context
 */
export async function saveCircleContext(circleId: string, role: CircleRole): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEYS.CIRCLE_ID, circleId);
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEYS.CIRCLE_ROLE, role);
}

/**
 * Get stored circle ID
 */
export async function getCircleId(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.CIRCLE_ID);
}

/**
 * Get stored circle role
 */
export async function getCircleRole(): Promise<CircleRole | null> {
  const role = await SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.CIRCLE_ROLE);
  if (role === 'admin' || role === 'member') return role;
  return null;
}

/**
 * Clear all stored authentication data (logout)
 */
export async function clearAll(): Promise<void> {
  const keys = Object.values(TOKEN_STORAGE_KEYS);
  await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(key)));
}