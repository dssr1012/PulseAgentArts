'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Transaction, Category } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { Plus, ArrowUpRight, Edit2, Trash2 } from 'lucide-react';

export default function IncomesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [incomes, setIncomes] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.circle_id) return;
    setIsLoading(true);
    try {
      const [expensesData, categoriesData] = await Promise.all([
        apiClient.getExpenses({ type: 'income', limit: 50 }),
        apiClient.getCategories(user.circle_id),
      ]);
      setIncomes(expensesData.data || []);
      setCategories(categoriesData);
    } catch {
      addToast('error', 'Failed to load incomes.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.circle_id, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this income record?')) return;
    try {
      await apiClient.deleteExpense(id);
      addToast('success', 'Income deleted.');
      fetchData();
    } catch {
      addToast('error', 'Failed to delete.');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incomes</h1>
          <p className="text-sm text-gray-500 mt-1">Track all income sources</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-pulse-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-pulse-emerald-600">
          <Plus className="h-4 w-4" /> Add Income
        </button>
      </div>

      {isLoading ? (
        <LoadingOverlay />
      ) : incomes.length === 0 ? (
        <EmptyState
          icon={<ArrowUpRight className="h-12 w-12" />}
          title="No incomes recorded"
          description="Start tracking your income sources."
          action={{ label: 'Add Income', onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <div className="space-y-3">
          {incomes.map((income) => (
            <div key={income.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-pulse-emerald-100 flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5 text-pulse-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{income.description || income.category_name}</p>
                  <p className="text-xs text-gray-500">{formatDate(income.transaction_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-pulse-emerald-500">
                  +{formatCurrency(income.amount, income.currency)}
                </p>
                <button onClick={() => handleDelete(income.id)} className="p-1.5 rounded-md text-gray-400 hover:text-pulse-red-500 hover:bg-pulse-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Income" size="lg">
        <TransactionForm type="income" categories={categories} onSuccess={() => { setShowAddModal(false); fetchData(); }} onCancel={() => setShowAddModal(false)} />
      </Modal>
    </div>
  );
}