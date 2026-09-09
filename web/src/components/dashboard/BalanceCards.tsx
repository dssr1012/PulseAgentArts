'use client';

import React from 'react';
import type { BalanceResponse } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

interface BalanceCardsProps {
  balance: BalanceResponse | null;
}

export function BalanceCards({ balance }: BalanceCardsProps) {
  if (!balance) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: 'Total Income', color: 'emerald' },
          { title: 'Total Expenses', color: 'red' },
          { title: 'Net Balance', color: 'blue' },
        ].map((card) => (
          <div key={card.title} className="card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  const isNegativeBalance = balance.net_balance < 0;

  const cards = [
    {
      title: 'Total Income',
      amount: balance.total_income,
      currency: balance.base_currency,
      icon: <TrendingUp className="h-6 w-6" />,
      bgClass: 'balance-card-emerald',
    },
    {
      title: 'Total Expenses',
      amount: balance.total_expenses,
      currency: balance.base_currency,
      icon: <TrendingDown className="h-6 w-6" />,
      bgClass: 'balance-card-red',
    },
    {
      title: 'Net Balance',
      amount: Math.abs(balance.net_balance),
      currency: balance.base_currency,
      icon: <Wallet className="h-6 w-6" />,
      bgClass: isNegativeBalance ? 'balance-card-red' : 'balance-card-blue',
      prefix: isNegativeBalance ? '-' : '',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={card.bgClass}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-white/80">{card.title}</p>
            <div className="rounded-lg bg-white/20 p-2">{card.icon}</div>
          </div>
          <p className="text-2xl font-bold text-white">
            {card.prefix || ''}{formatCurrency(card.amount, card.currency)}
          </p>
          {/* Currency breakdown */}
          {balance.breakdown_by_currency && Object.keys(balance.breakdown_by_currency).length > 1 && (
            <div className="mt-3 space-y-1">
              {Object.entries(balance.breakdown_by_currency).map(([currency, amounts]) => (
                <div key={currency} className="flex items-center justify-between text-xs text-white/70">
                  <span>{currency}</span>
                  <span>
                    {card.title === 'Total Income'
                      ? formatCurrency(amounts.income, currency)
                      : card.title === 'Total Expenses'
                      ? formatCurrency(amounts.expenses, currency)
                      : formatCurrency(amounts.income - amounts.expenses, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}