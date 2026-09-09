// ============================================================
// PulseExpends - Currency Constants
// ============================================================

import type { Currency } from '../types';

export const CURRENCIES: Currency[] = ['ARS', 'USD', 'EUR'];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ARS: '$',
  USD: 'US$',
  EUR: '€',
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  ARS: 'Pesos Argentinos',
  USD: 'Dólares',
  EUR: 'Euros',
};

export const CURRENCY_FLAGS: Record<Currency, string> = {
  ARS: '🇦🇷',
  USD: '🇺🇸',
  EUR: '🇪🇺',
};

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = Math.abs(amount).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

export function formatCurrencyShort(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}${symbol}${abs.toFixed(2)}`;
}