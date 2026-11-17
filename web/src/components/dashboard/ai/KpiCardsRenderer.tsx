'use client';

import React from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import type { KpiCard, Tone } from './ai-dashboard-types';
import { TrendingUp, TrendingDown, CreditCard, PiggyBank, Wallet, Target, AlertTriangle, DollarSign } from 'lucide-react';

const TONE_STYLES: Record<Tone, string> = {
  emerald: 'border-pulse-emerald-500 bg-pulse-emerald-50',
  red: 'border-pulse-red-500 bg-pulse-red-50',
  blue: 'border-pulse-blue-500 bg-pulse-blue-50',
  yellow: 'border-yellow-500 bg-yellow-50',
  info: 'border-pulse-blue-500 bg-pulse-blue-50',
  warning: 'border-yellow-500 bg-yellow-50',
  danger: 'border-pulse-red-500 bg-pulse-red-50',
};

const TONE_TEXT: Record<Tone, string> = {
  emerald: 'text-pulse-emerald-700',
  red: 'text-pulse-red-700',
  blue: 'text-pulse-blue-700',
  yellow: 'text-yellow-700',
  info: 'text-pulse-blue-700',
  warning: 'text-yellow-700',
  danger: 'text-pulse-red-700',
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  'wallet': Wallet,
  'target': Target,
  'alert-triangle': AlertTriangle,
  'dollar-sign': DollarSign,
};

export function KpiCardsRenderer({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = ICONS[card.icon || 'wallet'] || Wallet;
        return (
          <div
            key={i}
            className={cn('rounded-xl border-l-4 p-4 shadow-sm', TONE_STYLES[card.tone])}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">{card.label}</span>
              <Icon className={cn('h-5 w-5', TONE_TEXT[card.tone])} />
            </div>
            <p className={cn('text-xl font-bold', TONE_TEXT[card.tone])}>
              {formatCurrency(card.value, card.currency)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
