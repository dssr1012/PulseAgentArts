'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { ReconciliationResult, ReconciledItem } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Plus,
  X,
  Calendar,
  CreditCard,
} from 'lucide-react';

interface StatementReconciliationProps {
  previewId: string;
  onComplete: () => void;
  onClose: () => void;
}

export function StatementReconciliation({ previewId, onComplete, onClose }: StatementReconciliationProps) {
  const { addToast } = useToast();
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemCategories, setItemCategories] = useState<Record<string, string>>({});
  const [fraudItems, setFraudItems] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReconciliation = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reconData, catData] = await Promise.all([
        apiClient.reconcileStatement(previewId),
        apiClient.getCategories(),
      ]);
      setReconciliation(reconData);
      setCategories(catData);
    } catch {
      addToast('error', 'Failed to load reconciliation data.');
    } finally {
      setIsLoading(false);
    }
  }, [previewId, addToast]);

  useEffect(() => { fetchReconciliation(); }, [fetchReconciliation]);

  const toggleSelect = (itemId: string) => {
    const next = new Set(selectedItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelectedItems(next);
  };

  const toggleFraud = (itemId: string) => {
    const next = new Set(fraudItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setFraudItems(next);
    const selNext = new Set(selectedItems);
    selNext.delete(itemId);
    setSelectedItems(selNext);
  };

  const setCategory = (itemId: string, categoryId: string) => {
    setItemCategories({ ...itemCategories, [itemId]: categoryId });
  };

  const handleAccept = async () => {
    if (!reconciliation || selectedItems.size === 0) return;
    setIsSubmitting(true);
    try {
      const items = Array.from(selectedItems).map((statementItemId) => ({
        statementItemId,
        categoryId: itemCategories[statementItemId],
      }));
      const result = await apiClient.acceptStatementItems(previewId, items);
      addToast('success', `${result.count} expense${result.count > 1 ? 's' : ''} created as card expenses.`);
      onComplete();
      onClose();
    } catch {
      addToast('error', 'Failed to create expenses.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportFraud = async () => {
    if (!reconciliation || fraudItems.size === 0) return;
    setIsSubmitting(true);
    try {
      const result = await apiClient.reportStatementFraud(previewId, Array.from(fraudItems));
      addToast('warning', `${result.count} item${result.count > 1 ? 's' : ''} reported as fraud. Review in Anomalies.`);
      onComplete();
      onClose();
    } catch {
      addToast('error', 'Failed to report fraud.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !reconciliation) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-pulse-blue-500" />
        <span className="ml-2 text-sm text-gray-500">Cross-referencing with your expenses...</span>
      </div>
    );
  }

  const matchedItems = reconciliation.items.filter((i) => i.matched);
  const unmatchedItems = reconciliation.items.filter((i) => !i.matched);

  return (
    <div className="space-y-5">
      {/* Statement Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-gray-50">
          <p className="text-xs text-gray-500">Close Date</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(reconciliation.closingDate)}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50">
          <p className="text-xs text-gray-500">Due Date</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(reconciliation.dueDate)}</p>
        </div>
        <div className="p-3 rounded-lg bg-red-50">
          <p className="text-xs text-red-500">Total</p>
          <p className="text-sm font-semibold text-red-600 mt-1">
            {formatCurrency(reconciliation.totalAmount, reconciliation.currency)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-yellow-50">
          <p className="text-xs text-yellow-600">Min Payment</p>
          <p className="text-sm font-semibold text-yellow-700 mt-1">
            {formatCurrency(reconciliation.minPayment, reconciliation.currency)}
          </p>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
        <CreditCard className="h-5 w-5 text-blue-500 shrink-0" />
        <p className="text-sm text-blue-800">
          <span className="font-semibold">{reconciliation.cardBank} •••• {reconciliation.cardLastFour}</span>
          {' — '}
          {reconciliation.summary.total} charges:{' '}
          <span className="text-green-700 font-medium">{reconciliation.summary.matched} already loaded</span>
          {', '}
          <span className="text-orange-700 font-medium">{reconciliation.summary.unmatched} not loaded</span>
        </p>
      </div>

      {/* Matched Items */}
      {matchedItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              Already Loaded ({matchedItems.length})
            </h3>
          </div>
          <div className="space-y-1.5">
            {matchedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(item.date)}</span>
                  <span className="text-sm text-gray-700 truncate">{item.description}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {item.matchedExpense && (
                    <span className="text-xs text-gray-400">
                      → {item.matchedExpense.paymentMethod === 'card' ? 'card' : 'cash'}
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(item.amount, item.currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmatched Items */}
      {unmatchedItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              Not Loaded — Review ({unmatchedItems.length})
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            These charges are not in your expenses. Select the ones you recognize to add them, or flag suspicious ones as fraud.
          </p>
          <div className="space-y-2">
            {unmatchedItems.map((item) => {
              const isSelected = selectedItems.has(item.id);
              const isFraud = fraudItems.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    isFraud
                      ? 'bg-red-50 border-red-200'
                      : isSelected
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      disabled={isFraud}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-pulse-blue-500 focus:ring-pulse-blue-400"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs text-gray-400">{formatDate(item.date)}</span>
                          <p className="text-sm text-gray-900 truncate">{item.description}</p>
                        </div>
                        <span className="text-sm font-medium text-gray-900 shrink-0">
                          {formatCurrency(item.amount, item.currency)}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-xs text-gray-500">Category:</label>
                          <select
                            value={itemCategories[item.id] || ''}
                            onChange={(e) => setCategory(item.id, e.target.value)}
                            className="text-xs rounded-md border border-gray-200 px-2 py-1 focus:border-pulse-blue-400 focus:ring-1 focus:ring-pulse-blue-400"
                          >
                            <option value="">Default</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {isFraud && (
                        <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" /> Flagged as fraud
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleFraud(item.id)}
                      className={`shrink-0 p-1.5 rounded-md text-xs font-medium transition-colors ${
                        isFraud
                          ? 'text-red-600 bg-red-100 hover:bg-red-200'
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="Report as fraud"
                    >
                      <ShieldAlert className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary flex items-center gap-2" disabled={isSubmitting}>
          <X className="h-4 w-4" />
          Close
        </button>
        <div className="flex items-center gap-3">
          {fraudItems.size > 0 && (
            <button
              onClick={handleReportFraud}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
            >
              <ShieldAlert className="h-4 w-4" />
              Report {fraudItems.size} as Fraud
            </button>
          )}
          <button
            onClick={handleAccept}
            disabled={isSubmitting || selectedItems.size === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add {selectedItems.size > 0 ? selectedItems.size : ''} as Card Expenses
          </button>
        </div>
      </div>
    </div>
  );
}
