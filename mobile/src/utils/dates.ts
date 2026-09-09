// ============================================================
// PulseExpends - Date Utilities
// ============================================================

import { format, isToday, isYesterday, parseISO, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Format date for API (ISO 8601)
 */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format date for display (es-AR locale)
 */
export function toDisplayDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  return format(date, 'd MMM yyyy', { locale: es });
}

/**
 * Format date and time for display
 */
export function toDisplayDateTime(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, 'd MMM yyyy, HH:mm', { locale: es });
}

/**
 * Format short date for transaction list
 */
export function toShortDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  return format(date, 'd MMM', { locale: es });
}

/**
 * Get days difference from now
 */
export function daysFromNow(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), new Date());
}

/**
 * Get date N days from now
 */
export function getDateFromNow(days: number): Date {
  return addDays(new Date(), days);
}

/**
 * Get today's date as ISO string
 */
export function getTodayISO(): string {
  return toISODate(new Date());
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(dateStr: string): boolean {
  return parseISO(dateStr) > new Date();
}

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function toInputDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}