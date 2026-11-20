'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate, cn, CURRENCIES } from '@/lib/utils';
import type { Transaction, Category, TransactionQuery, Currency } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/Tabs';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionFilters } from '@/components/transactions/TransactionFilters';
import {
  Plus,
  Search,
  Filter,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Wallet,
  CreditCard as CreditCardIcon,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

export default function TransactionsPage() {
  const { user, activeCircleId } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<TransactionQuery>({ page: 1, limit: 20 });
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<'expense' | 'income'>('expense');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Check for query param action
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add-expense') {
      setModalType('expense');
      setShowAddModal(true);
    } else if (action === 'add-income') {
      setModalType('income');
      setShowAddModal(true);
    }
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    if (!activeCircleId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const [expensesData, incomesData, categoriesData] = await Promise.all([
        apiClient.getExpenses({ ...filters, limit: 100 }),
        apiClient.getIncomes({ ...filters, limit: 100 }),
        apiClient.getCategories(activeCircleId),
      ]);
      const combined = [
        ...(expensesData.data || []),
        ...(incomesData.data || []),
      ].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

      setAllTransactions(combined);
      setTotal(combined.length);
      setTotalPages(Math.max(1, Math.ceil(combined.length / pageSize)));
      setCategories(categoriesData);
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'CIRCLE_NOT_FOUND') {
        router.replace('/circle');
      } else {
        addToast('error', t('transactions.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeCircleId, filters, pageSize, addToast, router, t]);

  useEffect(() => {
    let cancelled = false;

    const doFetch = async () => {
      if (!activeCircleId) { if (!cancelled) setIsLoading(false); return; }
      if (!cancelled) setIsLoading(true);
      try {
        const [expensesData, incomesData, categoriesData] = await Promise.all([
          apiClient.getExpenses({ ...filters, limit: 100 }),
          apiClient.getIncomes({ ...filters, limit: 100 }),
          apiClient.getCategories(activeCircleId),
        ]);
        if (cancelled) return;
        const combined = [
          ...(expensesData.data || []),
          ...(incomesData.data || []),
        ].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

        setAllTransactions(combined);
        setTotal(combined.length);
        setTotalPages(Math.max(1, Math.ceil(combined.length / pageSize)));
        setCategories(categoriesData);
      } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code === 'CIRCLE_NOT_FOUND') {
          if (!cancelled) router.replace('/circle');
        } else if (!cancelled) {
          addToast('error', t('transactions.loadFailed'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    doFetch();
    return () => { cancelled = true; };
  }, [activeCircleId, filters, pageSize, addToast, t]);

  const filteredTransactions = searchQuery
    ? allTransactions.filter(t =>
        (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.merchant_name?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : allTransactions;

  const transactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [filters, searchQuery, pageSize]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('transactions.confirmDelete'))) return;
    try {
      await apiClient.deleteExpense(id);
      addToast('success', t('transactions.deleted'));
      fetchData();
    } catch {
      addToast('error', t('transactions.deleteFailed'));
    }
  };

  const handleFormSuccess = () => {
    setShowAddModal(false);
    setEditingTransaction(null);
    fetchData();
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('transactions.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{filteredTransactions.length} {t('transactions.totalTransactions')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setModalType('expense'); setShowAddModal(true); }}
            className="btn-danger flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('transactions.expense')}
          </button>
          <button
            onClick={() => { setModalType('income'); setShowAddModal(true); }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-pulse-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-pulse-emerald-600"
          >
            <Plus className="h-4 w-4" />
            {t('transactions.income')}
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('transactions.searchPlaceholder')}
            className="input-field pl-10"
          />
        </div>
        <TransactionFilters
          categories={categories}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {/* Transaction List */}
      {isLoading ? (
        <LoadingOverlay message={t('transactions.loadingTransactions')} />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<ArrowDownRight className="h-12 w-12" />}
          title={t('transactions.noTransactions')}
          description={t('transactions.noTransactionsDesc')}
          action={{ label: t('transactions.addExpense'), onClick: () => { setModalType('expense'); setShowAddModal(true); } }}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden p-0">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.date')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.description')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.category')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('transactions.payment')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.currency')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.amount')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((txn) => (
                  <tr key={txn.id} className={cn('transition-colors', txn.confirmation_status === 'pending_confirmation' ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50')}>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(txn.transaction_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {txn.is_private && <Lock className="h-3.5 w-3.5 text-pulse-red-500" />}
                        <span className="text-sm font-medium text-gray-900">
                          {txn.is_private && txn.user_id !== user?.id
                            ? t('transactions.privateExpense')
                            : txn.description || txn.merchant_name || '-'}
                        </span>
                        {txn.is_private && <Badge variant="private">{t('transactions.private')}</Badge>}
                        {txn.confirmation_status === 'pending_confirmation' && (
                          <Badge variant="warning">
                            <AlertCircle className="h-3 w-3 mr-0.5" />
                            {t('transactions.pendingReview')}
                          </Badge>
                        )}
                        {txn.recurring_transaction_id && (
                          <Badge variant="info">
                            <RefreshCw className="h-3 w-3 mr-0.5" />
                            {txn.installment_number ? `${t('transactions.installment')} ${txn.installment_number}` : t('transactions.recurring')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{txn.category_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {txn.payment_method === 'card' && txn.card ? (
                        <span className="inline-flex items-center gap-1">
                          <CreditCardIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span className={txn.card.card_mode === 'credit' ? 'text-amber-600 font-medium' : 'text-blue-600 font-medium'}>
                            {txn.card.card_mode === 'credit' ? t('common.credit') : t('common.debit')}
                          </span>
                          {txn.card.bank_name} •••• {txn.card.last_four_digits}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Wallet className="h-3.5 w-3.5 text-gray-400" />
                          {t('common.cash')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{txn.currency}</td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right ${txn.type === 'expense' ? 'text-pulse-red-500' : 'text-pulse-emerald-500'}`}>
                      {txn.type === 'expense' ? '-' : '+'}{formatCurrency(txn.amount, txn.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingTransaction(txn)}
                          className={cn(
                            'p-1.5 rounded-md transition-colors',
                            txn.confirmation_status === 'pending_confirmation'
                              ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-100'
                              : 'text-gray-400 hover:text-pulse-blue-500 hover:bg-pulse-blue-50'
                          )}
                          aria-label="Edit transaction"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(txn.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-pulse-red-500 hover:bg-pulse-red-50 transition-colors"
                          aria-label="Delete transaction"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden space-y-3">
            {transactions.map((txn) => (
              <div key={txn.id} className={cn('card p-4', txn.confirmation_status === 'pending_confirmation' && 'border-amber-300 bg-amber-50')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', txn.confirmation_status === 'pending_confirmation' ? 'bg-amber-100' : txn.type === 'expense' ? 'bg-pulse-red-100' : 'bg-pulse-emerald-100')}>
                      {txn.confirmation_status === 'pending_confirmation' ? <AlertCircle className="h-5 w-5 text-amber-500" /> : txn.type === 'expense' ? <ArrowDownRight className="h-5 w-5 text-pulse-red-500" /> : <ArrowUpRight className="h-5 w-5 text-pulse-emerald-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {txn.is_private && txn.user_id !== user?.id ? (
                          <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-pulse-red-500" /> {t('transactions.privateExpense')}</span>
                        ) : txn.description || txn.merchant_name || '-'}
                      </p>
                      <p className="text-xs text-gray-500">{txn.category_name} • {formatDate(txn.transaction_date)} • {txn.payment_method === 'card' && txn.card ? `${txn.card.card_mode === 'credit' ? t('common.credit') : t('common.debit')} ${txn.card.bank_name} •••• ${txn.card.last_four_digits}` : t('common.cash')}</p>
                      {txn.confirmation_status === 'pending_confirmation' && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-amber-700">
                          <AlertCircle className="h-3 w-3" />
                          {t('transactions.pendingReviewEdit')}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={cn('text-sm font-semibold', txn.type === 'expense' ? 'text-pulse-red-500' : 'text-pulse-emerald-500')}>
                    {txn.type === 'expense' ? '-' : '+'}{formatCurrency(txn.amount, txn.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-sm text-gray-500">
                {t('common.page')} {page} {t('common.of')} {Math.max(1, Math.ceil(filteredTransactions.length / pageSize))}
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="page-size-select" className="text-sm text-gray-500">
                  {t('common.rowsPerPage')}
                </label>
                <select
                  id="page-size-select"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-pulse-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-ghost disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(Math.max(1, Math.ceil(filteredTransactions.length / pageSize)), page + 1))}
                disabled={page >= Math.ceil(filteredTransactions.length / pageSize)}
                className="btn-ghost disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Transaction Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={modalType === 'expense' ? t('transactions.addExpense') : t('transactions.addIncome')}
        size="lg"
      >
        <TransactionForm
          type={modalType}
          categories={categories}
          onSuccess={handleFormSuccess}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        title={t('transactions.editTransaction')}
        size="lg"
      >
        {editingTransaction && (
          <TransactionForm
            type={editingTransaction.type}
            categories={categories}
            transaction={editingTransaction}
            onSuccess={handleFormSuccess}
            onCancel={() => setEditingTransaction(null)}
          />
        )}
      </Modal>
    </div>
  );
}
