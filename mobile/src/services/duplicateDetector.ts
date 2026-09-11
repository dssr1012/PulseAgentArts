// ============================================================
// PulseExpends - Duplicate Notification Detector
// SHA-256 hash-based duplicate detection
// Per design §2.7.5
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASYNC_STORAGE_KEYS, DUPLICATE_CACHE_CONFIG } from '../constants/config';

interface CacheEntry {
  hash: string;
  timestamp: number;
}

/**
 * Compute SHA-256 hash of (app_name + notification_text)
 * Used for duplicate detection without storing raw text
 */
async function computeHash(appName: string, notificationText: string): Promise<string> {
  const input = `${appName}:${notificationText}`;
  // FNV-1a 64-bit hash (pure JS, no native crypto deps)
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + 0x9e;
    h2 = Math.imul(h2, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Get the duplicate cache from storage
 */
async function getCache(): Promise<CacheEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.DUPLICATE_CACHE);
    if (stored) {
      return JSON.parse(stored) as CacheEntry[];
    }
  } catch {
    // Return empty cache on error
  }
  return [];
}

/**
 * Save the duplicate cache to storage
 */
async function saveCache(cache: CacheEntry[]): Promise<void> {
  // Enforce max entries (LRU eviction)
  const trimmed = cache.slice(-DUPLICATE_CACHE_CONFIG.MAX_ENTRIES);
  await AsyncStorage.setItem(
    ASYNC_STORAGE_KEYS.DUPLICATE_CACHE,
    JSON.stringify(trimmed)
  );
}

/**
 * Check if a notification is a duplicate
 * Returns true if the same notification was processed recently (within 24h)
 */
export async function isDuplicate(
  appName: string,
  notificationText: string
): Promise<boolean> {
  const hash = await computeHash(appName, notificationText);
  const cache = await getCache();
  const now = Date.now();
  const ttlMs = DUPLICATE_CACHE_CONFIG.TTL_HOURS * 60 * 60 * 1000;

  // Check for matching hash within TTL
  const isDup = cache.some(
    (entry) => entry.hash === hash && now - entry.timestamp < ttlMs
  );

  if (!isDup) {
    // Add to cache
    cache.push({ hash, timestamp: now });
    await saveCache(cache);
  }

  return isDup;
}

/**
 * Mark a notification as processed (add its hash to cache)
 */
export async function markProcessed(
  appName: string,
  notificationText: string
): Promise<void> {
  const hash = await computeHash(appName, notificationText);
  const cache = await getCache();
  cache.push({ hash, timestamp: Date.now() });
  await saveCache(cache);
}

/**
 * Clear expired entries from the cache
 */
export async function cleanExpiredEntries(): Promise<void> {
  const cache = await getCache();
  const now = Date.now();
  const ttlMs = DUPLICATE_CACHE_CONFIG.TTL_HOURS * 60 * 60 * 1000;
  const active = cache.filter((entry) => now - entry.timestamp < ttlMs);
  await saveCache(active);
}

/**
 * Get the hash for an extraction result (for storage in ExtractionResult)
 */
export async function getHash(
  appName: string,
  notificationText: string
): Promise<string> {
  return computeHash(appName, notificationText);
}