'use client';

import React from 'react';
import type { Transaction } from '@/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Lock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Link from 'next/link';

interface TransactionFeedProps {
  transactions: Transaction[];
}

export function TransactionFeed({ transactions }: TransactionFeedProps) {
  if (transactions.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
        <p className="text-sm text-gray-500">No transactions yet. Add your first expense!</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
        <Link
          href="/transactions"
          className="text-sm font-medium text-pulse-blue-500 hover:text-pulse-blue-600"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-3">
        {transactions.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} />
        ))}
      </div>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isExpense = transaction.type === 'expense';
  const isPrivate = transaction.is_private;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
      role="listitem"
    >
      {/* Icon */}
      <div
        className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
          isExpense ? 'bg-pulse-red-100' : 'bg-pulse-emerald-100'
        )}
      >
        {isExpense ? (
          <ArrowDownRight className="h-5 w-5 text-pulse-red-500" />
        ) : (
          <ArrowUpRight className="h-5 w-5 text-pulse-emerald-500" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {isPrivate ? (
              <span className="flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-pulse-red-500" />
                Gasto Privado
              </span>
            ) : (
              transaction.description || transaction.merchant_name || transaction.category_name
            )}
          </p>
          {isPrivate && (
            <Badge variant="private">Private</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-500">{transaction.category_name}</p>
          <span className="text-xs text-gray-300">•</span>
          <p className="text-xs text-gray-500">{formatDate(transaction.transaction_date)}</p>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p
          className={cn(
            'text-sm font-semibold',
            isExpense ? 'text-pulse-red-500' : 'text-pulse-emerald-500'
          )}
        >
          {isExpense ? '-' : '+'}{formatCurrency(transaction.amount, transaction.currency)}
        </p>
        {transaction.currency !== 'ARS' && (
          <p className="text-xs text-gray-400">{transaction.currency}</p>
        )}
      </div>
    </div>
  );
}