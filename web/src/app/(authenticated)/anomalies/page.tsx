'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { AnomalyAlert, AnomalySeverity } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner';
import {
  AlertTriangle,
  AlertCircle,
  Link2,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';

export default function AnomaliesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | ''>('');

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getIrregularExpenses({
        page,
        limit: 20,
        severity: severityFilter || undefined,
      });
      setAlerts(data.data || []);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch {
      addToast('error', 'Failed to load anomaly alerts.');
    } finally {
      setIsLoading(false);
    }
  }, [page, severityFilter, addToast]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleAssociate = async (expenseId: string) => {
    try {
      // In a real app, we'd show a modal to select the statement item
      addToast('info', 'Select the matching statement item to associate.');
    } catch {
      addToast('error', 'Failed to associate expense.');
    }
  };

  const handleDiscard = async (expenseId: string) => {
    if (!confirm('Discard this flagged expense?')) return;
    try {
      await apiClient.discardExpense(expenseId);
      addToast('success', 'Expense discarded and alert resolved.');
      fetchAlerts();
    } catch {
      addToast('error', 'Failed to discard expense.');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anomaly Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} irregular expense{total !== 1 ? 's' : ''} detected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSeverityFilter('')}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', !severityFilter ? 'bg-pulse-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
          >
            All
          </button>
          <button
            onClick={() => setSeverityFilter('alert')}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', severityFilter === 'alert' ? 'bg-pulse-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
          >
            ⚠️ Alerts
          </button>
          <button
            onClick={() => setSeverityFilter('critical')}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', severityFilter === 'critical' ? 'bg-pulse-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
          >
            🔴 Critical
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingOverlay />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-12 w-12" />}
          title="No anomalies detected"
          description="All expenses match their statements. Great job!"
        />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'rounded-xl border p-5',
                alert.severity === 'critical'
                  ? 'bg-pulse-red-50 border-pulse-red-200'
                  : 'bg-pulse-yellow-50 border-pulse-yellow-200'
              )}
            >
              <div className="flex items-start gap-4">
                {/* Severity icon */}
                <div
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                    alert.severity === 'critical'
                      ? 'bg-pulse-red-100'
                      : 'bg-pulse-yellow-100'
                  )}
                >
                  {alert.severity === 'critical' ? (
                    <AlertCircle className="h-5 w-5 text-pulse-red-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-pulse-yellow-500" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={alert.severity === 'critical' ? 'danger' : 'warning'}>
                      {alert.severity === 'critical' ? 'Critical' : 'Alert'}
                    </Badge>
                    <Badge variant="default">
                      {alert.reason === 'amount_discrepancy' ? 'Amount Discrepancy' : 'Orphaned Duplicate'}
                    </Badge>
                  </div>

                  <p className="text-sm font-medium text-gray-900">
                    {alert.expense.description || alert.expense.merchant_name || 'Unnamed expense'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                    <span>{formatCurrency(alert.expense.amount, alert.expense.currency)}</span>
                    <span>•</span>
                    <span>{alert.expense.category_name}</span>
                    <span>•</span>
                    <span>{formatDate(alert.expense.transaction_date)}</span>
                  </div>

                  {alert.reason === 'amount_discrepancy' && (
                    <p className="text-xs text-pulse-yellow-700 mt-2">
                      Same merchant and date found in statement, but amounts differ.
                    </p>
                  )}
                  {alert.reason === 'orphaned_duplicate' && (
                    <p className="text-xs text-pulse-red-700 mt-2">
                      No matching statement entry found after 30 days.
                    </p>
                  )}

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {alert.available_actions.includes('associate') && (
                      <button
                        onClick={() => handleAssociate(alert.expense_id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-pulse-blue-50 text-pulse-blue-600 hover:bg-pulse-blue-100 transition-colors"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Associate
                      </button>
                    )}
                    {alert.available_actions.includes('edit') && (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    )}
                    {alert.available_actions.includes('discard') && (
                      <button
                        onClick={() => handleDiscard(alert.expense_id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-pulse-red-50 text-pulse-red-600 hover:bg-pulse-red-100 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Discard
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-ghost disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn-ghost disabled:opacity-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}