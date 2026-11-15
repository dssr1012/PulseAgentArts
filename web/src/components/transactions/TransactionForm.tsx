'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/i18n';
import { cn, CURRENCIES } from '@/lib/utils';
import type { Transaction, Category, Currency, TransactionType, CreditCard, PaymentMethod } from '@/types';
import { Loader2, Lock, Unlock, Calendar, Wallet, CreditCard as CreditCardIcon } from 'lucide-react';
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
  const { t } = useTranslation();

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction?.payment_method || 'cash');
  const [cardId, setCardId] = useState(transaction?.card_id || '');
  const [cards, setCards] = useState<CreditCard[]>([]);

  useEffect(() => {
    apiClient.getCards().then(setCards).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        addToast('warning', t('transactionForm.invalidAmount'));
        setIsSubmitting(false);
        return;
      }

      if (!categoryId) {
        addToast('warning', t('transactionForm.selectCategoryWarning'));
        setIsSubmitting(false);
        return;
      }

      if (paymentMethod === 'card' && !cardId) {
        addToast('warning', t('transactionForm.selectCardWarning'));
        setIsSubmitting(false);
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      if (transactionDate > today) {
        addToast('warning', t('transactionForm.futureDate'));
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
        hidden_until: isPrivate && hiddenUntil ? new Date(hiddenUntil + 'T00:00:00').toISOString() : undefined,
        payment_method: paymentMethod,
        card_id: paymentMethod === 'card' ? cardId : undefined,
        transaction_date: new Date(transactionDate + 'T00:00:00').toISOString(),
      };

      if (transaction) {
        // Update existing
        await apiClient.updateExpense(transaction.id, baseData);
        addToast('success', t('transactionForm.updated'));
      } else if (type === 'expense') {
        await apiClient.createExpense(baseData);
        addToast('success', t('transactionForm.expenseAdded'));
      } else {
        // Create income
        await apiClient.createIncome({
          amount: parsedAmount,
          currency,
          category_id: categoryId || undefined,
          description: description || undefined,
          income_date: new Date(transactionDate + 'T00:00:00').toISOString(),
          payment_method: paymentMethod,
          card_id: paymentMethod === 'card' ? cardId : undefined,
        });
        addToast('success', t('transactionForm.incomeAdded'));
      }

      onSuccess();
    } catch (err: unknown) {
      const error = err as { message?: string };
      addToast('error', error.message || t('transactionForm.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Amount and Currency */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label htmlFor="amount" className="label-field">{t('transactionForm.amount')}</label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const sanitized = e.target.value.replace(/[^0-9.]/g, '');
              const parts = sanitized.split('.');
              if (parts.length > 2) {
                setAmount(parts[0] + '.' + parts.slice(1).join(''));
              } else {
                setAmount(sanitized);
              }
            }}
            className="input-field text-lg font-semibold"
            placeholder="0.00"
            required
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="currency" className="label-field">{t('transactionForm.currency')}</label>
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
      <div>
        <label htmlFor="category" className="label-field">{t('transactionForm.category')}</label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="select-field"
          required
          disabled={isSubmitting}
        >
          <option value="">{t('transactionForm.selectCategory')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} {cat.is_default ? `(${t('common.default').toLowerCase()})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="label-field">
          {t('transactionForm.description')}
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-field"
          placeholder={t('transactionForm.descriptionPlaceholder')}
          maxLength={500}
          disabled={isSubmitting}
        />
      </div>

      {/* Merchant Name */}
      <div>
        <label htmlFor="merchant" className="label-field">
          {t('transactionForm.merchant')}
        </label>
        <input
          id="merchant"
          type="text"
          value={merchantName}
          onChange={(e) => setMerchantName(e.target.value)}
          className="input-field"
          placeholder={t('transactionForm.merchantPlaceholder')}
          maxLength={200}
          disabled={isSubmitting}
        />
      </div>

      {/* Payment Method */}
      <div className="space-y-3">
          <div>
            <label className="label-field">{t('transactionForm.paymentMethod')}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors',
                  paymentMethod === 'cash'
                    ? 'border-pulse-blue-500 bg-pulse-blue-50 text-pulse-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <Wallet className="h-4 w-4" />
                <span className="text-sm font-medium">{t('common.cash')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors',
                  paymentMethod === 'card'
                    ? 'border-pulse-blue-500 bg-pulse-blue-50 text-pulse-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <CreditCardIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{t('common.card')}</span>
              </button>
            </div>
          </div>
          {paymentMethod === 'card' && (
            <div>
              <label htmlFor="card" className="label-field">{t('recurring.card')}</label>
              {cards.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  {t('transactionForm.noCards')}
                </p>
              ) : (
                <select
                  id="card"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  className="select-field"
                  required
                  disabled={isSubmitting}
                >
                  <option value="">{t('transactionForm.selectCard')}</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.bank_name} •••• {card.last_four_digits} ({card.card_mode}){card.tag ? ` ${card.tag}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

      {/* Date */}
      <div>
        <label htmlFor="date" className="label-field">
          {t('transactionForm.date')}
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
            max={format(new Date(), 'yyyy-MM-dd')}
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
                <p className="text-sm font-medium text-gray-900">{t('transactionForm.giftHiddenMode')}</p>
                <p className="text-xs text-gray-500">
                  {t('transactionForm.giftHiddenDesc')}
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
              aria-label={t('transactionForm.toggleGiftHidden')}
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
                {t('transactionForm.visibleAfter')}
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
                {t('transactionForm.visibleAfterHint')}
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
          {t('transactionForm.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={type === 'expense' ? 'btn-danger' : 'inline-flex items-center justify-center rounded-lg bg-pulse-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-pulse-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed'}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t('transactionForm.saving')}
            </>
          ) : (
            transaction ? t('transactionForm.saveChanges') : type === 'expense' ? t('transactionForm.addExpense') : t('transactionForm.addIncome')
          )}
        </button>
      </div>
    </form>
  );
}