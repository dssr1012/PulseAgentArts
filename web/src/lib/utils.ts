import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string): string {
  const localeMap: Record<string, string> = {
    ARS: 'es-AR',
    USD: 'en-US',
    EUR: 'de-DE',
  };
  const c = localeMap[currency ?? ''] ? currency : 'ARS';
  const amt = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const locale = localeMap[c];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: c,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amt);
}

function getDateLocale(): string {
  if (typeof window === 'undefined') return 'es-AR';
  const lang = localStorage.getItem('preferred_language');
  return lang === 'en' ? 'en-US' : 'es-AR';
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(getDateLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(getDateLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    ARS: '$',
    USD: 'US$',
    EUR: '€',
  };
  return symbols[currency] || '$';
}

export function getTimeUntilExpiry(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferred_language') === 'en' ? 'Expired' : 'Expirada';
    }
    return 'Expirada';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const CURRENCIES = ['ARS', 'USD', 'EUR'] as const;
export const DEFAULT_CATEGORIES = ['Alimentación', 'Servicios', 'Transporte', 'Salud'] as const;
