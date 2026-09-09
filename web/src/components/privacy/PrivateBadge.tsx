'use client';

import React from 'react';
import type { Transaction } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Eye, Clock } from 'lucide-react';
import { formatDate, getTimeUntilExpiry } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface PrivateBadgeProps {
  transaction: Transaction;
}

export function PrivateBadge({ transaction }: PrivateBadgeProps) {
  const { user } = useAuth();
  const isCreator = transaction.user_id === user?.id;

  if (!transaction.is_private) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <Lock className="h-3.5 w-3.5 text-pulse-red-500" />
      {isCreator ? (
        <Badge variant="private">
          <span className="flex items-center gap-1">
            Private
            {transaction.hidden_until && (
              <span className="text-[10px] opacity-75">
                (visible {getTimeUntilExpiry(transaction.hidden_until)})
              </span>
            )}
          </span>
        </Badge>
      ) : (
        <Badge variant="private">
          Gasto Privado de {transaction.user_name}
        </Badge>
      )}
    </div>
  );
}

interface PrivateTransactionDisplayProps {
  transaction: Transaction;
}

export function PrivateTransactionDisplay({ transaction }: PrivateTransactionDisplayProps) {
  const { user } = useAuth();
  const isCreator = transaction.user_id === user?.id;

  if (!transaction.is_private) {
    return (
      <span>{transaction.description || transaction.merchant_name || '-'}</span>
    );
  }

  if (isCreator) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-pulse-red-500" />
          <span className="text-sm font-medium text-gray-900">
            {transaction.description || transaction.merchant_name || '-'}
          </span>
        </div>
        {transaction.hidden_until && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            <span>Visible after: {formatDate(transaction.hidden_until)}</span>
            <span className="text-pulse-yellow-600">
              ({getTimeUntilExpiry(transaction.hidden_until)})
            </span>
          </div>
        )}
      </div>
    );
  }

  // Non-creator view - obfuscated
  if (transaction.description?.includes('Regalo')) {
    return (
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-pulse-red-500" />
        <span className="text-sm font-medium text-gray-600 italic">Regalo Sorpresa</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Lock className="h-4 w-4 text-pulse-red-500" />
      <span className="text-sm font-medium text-gray-600 italic">
        Gasto Privado de {transaction.user_name}
      </span>
    </div>
  );
}