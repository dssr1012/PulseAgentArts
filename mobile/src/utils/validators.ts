// ============================================================
// PulseExpends - Validation Utilities
// ============================================================

import type { Currency } from '../types';
import { CURRENCIES } from '../constants/currencies';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate password strength:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 */
export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Mínimo 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Al menos 1 mayúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Al menos 1 número');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate given name
 */
export function isValidGivenName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 100;
}

/**
 * Validate currency is supported
 */
export function isValidCurrency(currency: string): currency is Currency {
  return CURRENCIES.includes(currency as Currency);
}

/**
 * Validate amount is positive and within range
 */
export function isValidAmount(amount: number): boolean {
  return amount > 0 && amount <= 99_999_999.99;
}

/**
 * Validate description length
 */
export function isValidDescription(description: string): boolean {
  return description.length <= 500;
}

/**
 * Validate merchant name length
 */
export function isValidMerchantName(name: string): boolean {
  return name.length <= 200;
}

/**
 * Validate hidden_until date is in the future
 */
export function isValidHiddenUntil(date: string): boolean {
  const hiddenUntil = new Date(date);
  const now = new Date();
  return hiddenUntil > now;
}

/**
 * Validate last 4 digits for card
 */
export function isValidLastFourDigits(digits: string): boolean {
  return /^\d{4}$/.test(digits);
}