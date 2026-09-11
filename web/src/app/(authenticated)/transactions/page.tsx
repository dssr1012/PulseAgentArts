'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
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
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function TransactionsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<TransactionQuery>({ page: 1, limit: 20 });
  const [searchQuery, setSearchQuery] = useState('');

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
    if (!user?.circle_id) return;
    setIsLoading(true);
    try {
      const [expensesData, categoriesData] = await Promise.all([
        apiClient.getExpenses({ ...filters, page, search: searchQuery || undefined }),
        apiClient.getCategories(user.circle_id),
      ]);
      setTransactions(expensesData.data || []);
      setTotalPages(expensesData.total_pages || 1);
      setTotal(expensesData.total || 0);
      setCategories(categoriesData);
    } catch {
      addToast('error', 'Failed to load transactions.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.circle_id, filters, page, searchQuery, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await apiClient.deleteExpense(id);
      addToast('success', 'Transaction deleted.');
      fetchData();
    } catch {
      addToast('error', 'Failed to delete transaction.');
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
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setModalType('expense'); setShowAddModal(true); }}
            className="btn-danger flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Expense
          </button>
          <button
            onClick={() => { setModalType('income'); setShowAddModal(true); }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-pulse-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-pulse-emerald-600"
          >
            <Plus className="h-4 w-4" />
            Income
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
            placeholder="Search by merchant or description..."
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
        <LoadingOverlay message="Loading transactions..." />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<ArrowDownRight className="h-12 w-12" />}
          title="No transactions found"
          description="Start tracking your expenses by adding your first transaction."
          action={{ label: 'Add Expense', onClick: () => { setModalType('expense'); setShowAddModal(true); } }}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden p-0">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(t.transaction_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.is_private && <Lock className="h-3.5 w-3.5 text-pulse-red-500" />}
                        <span className="text-sm font-medium text-gray-900">
                          {t.is_private && t.user_id !== user?.id
                            ? 'Gasto Privado'
                            : t.description || t.merchant_name || '-'}
                        </span>
                        {t.is_private && <Badge variant="private">Private</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.category_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.currency}</td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right ${t.type === 'expense' ? 'text-pulse-red-500' : 'text-pulse-emerald-500'}`}>
                      {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount, t.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingTransaction(t)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-pulse-blue-500 hover:bg-pulse-blue-50 transition-colors"
                          aria-label="Edit transaction"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
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
            {transactions.map((t) => (
              <div key={t.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', t.type === 'expense' ? 'bg-pulse-red-100' : 'bg-pulse-emerald-100')}>
                      {t.type === 'expense' ? <ArrowDownRight className="h-5 w-5 text-pulse-red-500" /> : <ArrowUpRight className="h-5 w-5 text-pulse-emerald-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {t.is_private && t.user_id !== user?.id ? (
                          <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-pulse-red-500" /> Gasto Privado</span>
                        ) : t.description || t.merchant_name || '-'}
                      </p>
                      <p className="text-xs text-gray-500">{t.category_name} • {formatDate(t.transaction_date)}</p>
                    </div>
                  </div>
                  <p className={cn('text-sm font-semibold', t.type === 'expense' ? 'text-pulse-red-500' : 'text-pulse-emerald-500')}>
                    {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount, t.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
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
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
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
        title={modalType === 'expense' ? 'Add Expense' : 'Add Income'}
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
        title="Edit Transaction"
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