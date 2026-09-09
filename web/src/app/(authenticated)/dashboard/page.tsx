'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { BalanceResponse, Transaction, Category } from '@/types';
import { BalanceCards } from '@/components/dashboard/BalanceCards';
import { CategoryChart } from '@/components/dashboard/CategoryChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { TransactionFeed } from '@/components/dashboard/TransactionFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConsolidated, setShowConsolidated] = useState(false);
  const [anomalyCount, setAnomalyCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.circle_id) {
        setIsLoading(false);
        return;
      }

      try {
        const [balanceData, expensesData, categoriesData, anomalyData] = await Promise.allSettled([
          apiClient.getBalance(user.circle_id, showConsolidated),
          apiClient.getExpenses({ limit: 10, page: 1 }),
          apiClient.getCategories(user.circle_id),
          apiClient.getIrregularExpenses({ limit: 1, page: 1 }),
        ]);

        if (balanceData.status === 'fulfilled') setBalance(balanceData.value);
        if (expensesData.status === 'fulfilled') setTransactions(expensesData.value.data || []);
        if (categoriesData.status === 'fulfilled') setCategories(categoriesData.value);
        if (anomalyData.status === 'fulfilled') setAnomalyCount(anomalyData.value.total || 0);
      } catch {
        addToast('error', 'Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.circle_id, showConsolidated, addToast]);

  const handleRefresh = async () => {
    if (!user?.circle_id) return;
    setIsLoading(true);
    try {
      const balanceData = await apiClient.getBalance(user.circle_id, showConsolidated);
      setBalance(balanceData);
      addToast('success', 'Dashboard refreshed.');
    } catch {
      addToast('error', 'Failed to refresh.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {user?.given_name || 'User'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Currency conversion toggle */}
          <button
            onClick={() => setShowConsolidated(!showConsolidated)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              showConsolidated
                ? 'bg-pulse-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
            aria-pressed={showConsolidated}
          >
            <RefreshCw className="h-4 w-4" />
            Consolidated
          </button>
          <button
            onClick={handleRefresh}
            className="btn-secondary"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stale rates warning */}
      {balance?.rates_stale && (
        <div className="alert-yellow flex items-center gap-3" role="alert">
          <AlertTriangle className="h-5 w-5 text-pulse-yellow-500 shrink-0" />
          <p className="text-sm text-pulse-yellow-800">
            Exchange rates may be outdated. Last update: {balance.last_rate_fetch ? new Date(balance.last_rate_fetch).toLocaleString() : 'unknown'}
          </p>
        </div>
      )}

      {/* Anomaly count alert */}
      {anomalyCount > 0 && (
        <div className="alert-yellow flex items-center justify-between" role="alert">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-pulse-yellow-500 shrink-0" />
            <p className="text-sm text-pulse-yellow-800">
              You have <strong>{anomalyCount}</strong> irregular expense alert{anomalyCount > 1 ? 's' : ''} requiring attention.
            </p>
          </div>
          <a href="/anomalies" className="text-sm font-semibold text-pulse-yellow-700 hover:underline">
            View →
          </a>
        </div>
      )}

      {/* Balance Cards */}
      <BalanceCards balance={balance} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart
          categories={categories}
          breakdown={balance?.breakdown_by_category || {}}
        />
        <TrendChart transactions={transactions} />
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Recent Transactions */}
      <TransactionFeed transactions={transactions} />
    </div>
  );
}