'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { AnomalyAlert, AnomalySeverity } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/Tabs';
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
  const { t } = useTranslation();
  const router = useRouter();

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
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'CIRCLE_NOT_FOUND') {
        router.replace('/circle');
      } else {
        addToast('error', t('anomalies.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, severityFilter, addToast, router, t]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleAssociate = async (expenseId: string) => {
    try {
      addToast('info', t('anomalies.associateHint'));
    } catch {
      addToast('error', t('anomalies.associateFailed'));
    }
  };

  const handleDiscard = async (expenseId: string) => {
    if (!confirm(t('anomalies.confirmDiscard'))) return;
    try {
      await apiClient.discardExpense(expenseId);
      addToast('success', t('anomalies.discarded'));
      fetchAlerts();
    } catch {
      addToast('error', t('anomalies.discardFailed'));
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('anomalies.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} {total !== 1 ? t('anomalies.irregularExpensesPlural') : t('anomalies.irregularExpenses')} {t('anomalies.detected')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSeverityFilter('')}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', !severityFilter ? 'bg-pulse-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
          >
            {t('anomalies.all')}
          </button>
          <button
            onClick={() => setSeverityFilter('alert')}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', severityFilter === 'alert' ? 'bg-pulse-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
          >
            {t('anomalies.alerts')}
          </button>
          <button
            onClick={() => setSeverityFilter('critical')}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', severityFilter === 'critical' ? 'bg-pulse-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}
          >
            {t('anomalies.critical')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingOverlay />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-12 w-12" />}
          title={t('anomalies.noAnomalies')}
          description={t('anomalies.noAnomaliesDesc')}
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

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={alert.severity === 'critical' ? 'danger' : 'warning'}>
                      {alert.severity === 'critical' ? t('anomalies.criticalBadge') : t('anomalies.alertBadge')}
                    </Badge>
                    <Badge variant="default">
                      {alert.reason === 'amount_discrepancy' ? t('anomalies.amountDiscrepancy') : t('anomalies.orphanedDuplicate')}
                    </Badge>
                  </div>

                  <p className="text-sm font-medium text-gray-900">
                    {alert.expense.description || alert.expense.merchant_name || t('common.unnamedExpense')}
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
                      {t('anomalies.amountDiscrepancyDesc')}
                    </p>
                  )}
                  {alert.reason === 'orphaned_duplicate' && (
                    <p className="text-xs text-pulse-red-700 mt-2">
                      {t('anomalies.orphanedDuplicateDesc')}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    {(alert.available_actions || []).includes('associate') && (
                      <button
                        onClick={() => handleAssociate(alert.expense_id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-pulse-blue-50 text-pulse-blue-600 hover:bg-pulse-blue-100 transition-colors"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {t('anomalies.associate')}
                      </button>
                    )}
                    {(alert.available_actions || []).includes('edit') && (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        {t('common.edit')}
                      </button>
                    )}
                    {(alert.available_actions || []).includes('discard') && (
                      <button
                        onClick={() => handleDiscard(alert.expense_id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-pulse-red-50 text-pulse-red-600 hover:bg-pulse-red-100 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('anomalies.discard')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{t('common.page')} {page} {t('common.of')} {totalPages}</p>
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
