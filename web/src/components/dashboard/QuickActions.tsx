'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';

export function QuickActions() {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => router.push('/transactions?action=add-expense')}
        className="btn-danger flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        <TrendingDown className="h-4 w-4" />
        Add Expense
      </button>
      <button
        onClick={() => router.push('/transactions?action=add-income')}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-pulse-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-pulse-emerald-600 focus:outline-none focus:ring-2 focus:ring-pulse-emerald-500 focus:ring-offset-2"
      >
        <Plus className="h-4 w-4" />
        <TrendingUp className="h-4 w-4" />
        Add Income
      </button>
    </div>
  );
}