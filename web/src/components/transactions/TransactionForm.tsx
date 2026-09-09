'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn, CURRENCIES } from '@/lib/utils';
import type { Transaction, Category, Currency, TransactionType } from '@/types';
import { Loader2, Lock, Unlock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface TransactionFormProps {
  type: TransactionType;
  categories: Category[];
  transaction?: Transaction;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TransactionForm({ type, categories, transaction, onSuccess, onCancel }: TransactionFormProps) {
  const { addToast } = useToast();
  const { user } = useAuth();

  const [amount, setAmount] = useState(transaction?.amount?.toString() || '');
  const [currency, setCurrency] = useState<Currency>(transaction?.currency || 'ARS');
  const [categoryId, setCategoryId] = useState(transaction?.category_id || '');
  const [description, setDescription] = useState(transaction?.description || '');
  const [merchantName, setMerchantName] = useState(transaction?.merchant_name || '');
  const [transactionDate, setTransactionDate] = useState(
    transaction?.transaction_date ? format(new Date(transaction.transaction_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [isPrivate, setIsPrivate] = useState(transaction?.is_private || false);
  const [hiddenUntil, setHiddenUntil] = useState(
    transaction?.hidden_until ? format(new Date(transaction.hidden_until), 'yyyy-MM-dd') : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        addToast('warning', 'Please enter a valid amount.');
        setIsSubmitting(false);
        return;
      }

      if (!categoryId && type === 'expense') {
        addToast('warning', 'Please select a category.');
        setIsSubmitting(false);
        return;
      }

      const baseData = {
        amount: parsedAmount,
        currency,
        category_id: categoryId || undefined,
        description: description || undefined,
        merchant_name: merchantName || undefined,
        is_private: isPrivate,
        hidden_until: isPrivate && hiddenUntil ? new Date(hiddenUntil).toISOString() : undefined,
      };

      if (transaction) {
        // Update existing
        await apiClient.updateExpense(transaction.id, baseData);
        addToast('success', 'Transaction updated successfully.');
      } else if (type === 'expense') {
        // Create expense
        await apiClient.createExpense({
          ...baseData,
          transaction_date: new Date(transactionDate).toISOString(),
        });
        addToast('success', 'Expense added successfully.');
      } else {
        // Create income
        await apiClient.createIncome({
          amount: parsedAmount,
          currency,
          category_id: categoryId || undefined,
          description: description || undefined,
          income_date: new Date(transactionDate).toISOString(),
        });
        addToast('success', 'Income added successfully.');
      }

      onSuccess();
    } catch (err: unknown) {
      const error = err as { message?: string };
      addToast('error', error.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Amount and Currency */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label htmlFor="amount" className="label-field">Amount</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field text-lg font-semibold"
            placeholder="0.00"
            required
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="currency" className="label-field">Currency</label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="select-field"
            disabled={isSubmitting}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category */}
      {type === 'expense' && (
        <div>
          <label htmlFor="category" className="label-field">Category</label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="select-field"
            required
            disabled={isSubmitting}
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} {cat.is_default ? '(default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div>
        <label htmlFor="description" className="label-field">
          Description
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-field"
          placeholder="What was this for?"
          maxLength={500}
          disabled={isSubmitting}
        />
      </div>

      {/* Merchant Name */}
      <div>
        <label htmlFor="merchant" className="label-field">
          Merchant / Business
        </label>
        <input
          id="merchant"
          type="text"
          value={merchantName}
          onChange={(e) => setMerchantName(e.target.value)}
          className="input-field"
          placeholder="Where did you spend?"
          maxLength={200}
          disabled={isSubmitting}
        />
      </div>

      {/* Date */}
      <div>
        <label htmlFor="date" className="label-field">
          Date
        </label>
        <div className="relative">
          <input
            id="date"
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            className="input-field"
            required
            disabled={isSubmitting}
          />
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Privacy Toggle - Gift Hidden Mode */}
      {type === 'expense' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-3">
              {isPrivate ? (
                <Lock className="h-5 w-5 text-pulse-red-500" />
              ) : (
                <Unlock className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">Gift Hidden Mode</p>
                <p className="text-xs text-gray-500">
                  Hide details from other members while including in totals
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                isPrivate ? 'bg-pulse-red-500' : 'bg-gray-300'
              )}
              role="switch"
              aria-checked={isPrivate}
              aria-label="Toggle gift hidden mode"
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  isPrivate ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {isPrivate && (
            <div>
              <label htmlFor="hiddenUntil" className="label-field">
                Visible after (optional)
              </label>
              <input
                id="hiddenUntil"
                type="date"
                value={hiddenUntil}
                onChange={(e) => setHiddenUntil(e.target.value)}
                className="input-field"
                min={format(new Date(), 'yyyy-MM-dd')}
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to keep private indefinitely.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={type === 'expense' ? 'btn-danger' : 'inline-flex items-center justify-center rounded-lg bg-pulse-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-pulse-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed'}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            transaction ? 'Save Changes' : type === 'expense' ? 'Add Expense' : 'Add Income'
          )}
        </button>
      </div>
    </form>
  );
}