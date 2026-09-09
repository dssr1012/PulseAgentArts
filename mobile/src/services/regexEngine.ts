// ============================================================
// PulseExpends - Regex Engine Service
// On-device regex pattern matching for notification parsing
// Per design §2.7.2 - Edge Parsing (no raw text sent to server)
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RegexDictionary, RegexPattern, ExtractionResult, Currency } from '../types';
import { ASYNC_STORAGE_KEYS } from '../constants/config';
import * as regexApi from '../api/regexDictionary';

/**
 * Download and cache the regex dictionary from the backend
 * Checks local version vs backend; downloads if newer
 */
export async function updateRegexDictionary(): Promise<RegexDictionary | null> {
  try {
    // Get current local version
    const localVersionStr = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.REGEX_VERSION);
    const localVersion = localVersionStr ? parseInt(localVersionStr, 10) : 0;

    // Fetch latest dictionary from backend
    const dictionary = await regexApi.getRegexDictionary();

    // Update if newer version available
    if (dictionary.version > localVersion) {
      await AsyncStorage.setItem(
        ASYNC_STORAGE_KEYS.REGEX_DICTIONARY,
        JSON.stringify(dictionary)
      );
      await AsyncStorage.setItem(
        ASYNC_STORAGE_KEYS.REGEX_VERSION,
        dictionary.version.toString()
      );
      return dictionary;
    }

    // Return cached dictionary if up to date
    return await getCachedDictionary();
  } catch {
    // On failure, return cached dictionary if available
    return await getCachedDictionary();
  }
}

/**
 * Get the locally cached regex dictionary
 */
export async function getCachedDictionary(): Promise<RegexDictionary | null> {
  try {
    const stored = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.REGEX_DICTIONARY);
    if (stored) {
      return JSON.parse(stored) as RegexDictionary;
    }
  } catch {
    // Return null on error
  }
  return null;
}

/**
 * Apply regex patterns to notification text on-device
 * Returns extracted structured data or null if no match
 * Per spec §5.8.1 rule 6: NEVER transmit raw notification text
 */
export function parseNotification(
  notificationText: string,
  appName: string,
  patterns: RegexPattern[]
): ExtractionResult | null {
  // Find patterns matching this app
  const appPatterns = patterns.filter((p) => p.app_name === appName);

  if (appPatterns.length === 0) {
    return null; // No patterns for this app - silently discard
  }

  // Try each pattern until one matches
  for (const pattern of appPatterns) {
    try {
      const regex = new RegExp(pattern.pattern, 'i');
      const match = regex.exec(notificationText);

      if (match && match.groups) {
        const result: ExtractionResult = {
          app_name: appName,
          raw_hash: '', // Will be set by DuplicateDetector
        };

        // Extract fields based on named capture groups
        if (match.groups.amount) {
          result.amount = parseAmount(match.groups.amount);
        }
        if (match.groups.merchant) {
          result.merchant = match.groups.merchant.trim();
        }
        if (match.groups.currency) {
          result.currency = parseCurrency(match.groups.currency);
        }
        if (match.groups.payment_method) {
          result.payment_method = match.groups.payment_method.trim();
        }

        // Only return if we extracted at least an amount
        if (result.amount !== undefined) {
          return result;
        }
      }
    } catch {
      // Invalid regex pattern - skip and try next
      continue;
    }
  }

  // No pattern matched - silently discard per spec §5.8.3 scenario 1
  return null;
}

/**
 * Parse amount string to number
 * Handles formats: "5.500", "$5.500", "5500,00", "5,500.00"
 */
function parseAmount(amountStr: string): number | undefined {
  try {
    // Remove currency symbols and whitespace
    let cleaned = amountStr.replace(/[$€£¥\s]/g, '');

    // Handle Argentine format: "5.500" or "5.500,00"
    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        // Format: 1.234,56 (Argentine/European)
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // Format: 1,234.56 (US)
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
      // Could be "5500,00" (decimal comma) or "5,500" (thousand separator)
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Decimal comma: "5500,00"
        cleaned = cleaned.replace(',', '.');
      } else {
        // Thousand separator: "5,500"
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes('.') && !cleaned.includes(',')) {
      // Could be "5.500" (thousand) or "5500.00" (decimal)
      const parts = cleaned.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length > 2)) {
        // Thousand separator: "5.500" or "1.234.567"
        cleaned = cleaned.replace(/\./g, '');
      }
      // Otherwise it's a decimal: "5500.00" - keep as is
    }

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? undefined : amount;
  } catch {
    return undefined;
  }
}

/**
 * Parse currency string to Currency type
 */
function parseCurrency(currencyStr: string): Currency | undefined {
  const upper = currencyStr.toUpperCase().trim();

  if (upper.includes('ARS') || upper.includes('PESO') || upper === '$') {
    return 'ARS';
  }
  if (upper.includes('USD') || upper.includes('DOLAR') || upper === 'US$') {
    return 'USD';
  }
  if (upper.includes('EUR') || upper === '€') {
    return 'EUR';
  }

  return undefined; // Default will be set by caller based on app config
}