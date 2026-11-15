'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate, cn, CURRENCIES } from '@/lib/utils';
import type { RecurringTransaction, Category, CreditCard, Currency, RecurringFrequency } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Pause,
  Play,
  Loader2,
  Calendar,
  CreditCard as CreditCardIcon,
  AlertCircle,
} from 'lucide-react';

export default function RecurringPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<RecurringTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [mode, setMode] = useState<'recurring' | 'installments'>('recurring');
  const [description, setDescription] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cardId, setCardId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [interval, setInterval] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [totalInstallments, setTotalInstallments] = useState(12);
  const [originalAmount, setOriginalAmount] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recurringData, catData, cardData] = await Promise.all([
        apiClient.getRecurringTransactions(),
        apiClient.getCategories(),
        apiClient.getCards(),
      ]);
      setRecurring(recurringData);
      setCategories(catData);
      setCards(cardData);
      if (catData.length > 0 && !categoryId) setCategoryId(catData[0].id);
    } catch {
      addToast('error', t('recurring.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [addToast, categoryId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setMode('recurring');
    setDescription('');
    setMerchantName('');
    setAmount('');
    setCurrency('ARS');
    setPaymentMethod('cash');
    setCardId('');
    setFrequency('monthly');
    setInterval(1);
    setDayOfMonth(1);
    setStartDate(new Date().toISOString().slice(0, 10));
    setTotalInstallments(12);
    setOriginalAmount('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      addToast('warning', t('recurring.invalidAmount'));
      return;
    }
    if (!categoryId) {
      addToast('warning', t('recurring.selectCategory'));
      return;
    }
    if (paymentMethod === 'card' && !cardId) {
      addToast('warning', t('recurring.selectCard'));
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.createRecurringTransaction({
        description,
        merchant_name: merchantName || undefined,
        amount: parsedAmount,
        currency,
        category_id: categoryId,
        type: 'expense',
        payment_method: paymentMethod,
        card_id: paymentMethod === 'card' ? cardId : undefined,
        frequency,
        interval,
        day_of_month: frequency !== 'weekly' ? dayOfMonth : undefined,
        start_date: new Date(startDate + 'T00:00:00').toISOString(),
        total_installments: mode === 'installments' ? totalInstallments : undefined,
        original_amount: mode === 'installments' && originalAmount ? parseFloat(originalAmount) : undefined,
      });
      addToast('success', t('recurring.created'));
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch {
      addToast('error', t('recurring.createFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item: RecurringTransaction) => {
    setEditingItem(item);
    setDescription(item.description || '');
    setMerchantName(item.merchant_name || '');
    setAmount(String(item.amount));
    setCurrency(item.currency);
    setCategoryId(item.category_id);
    setPaymentMethod(item.payment_method);
    setCardId(item.card_id || '');
    setFrequency(item.frequency);
    setInterval(item.interval);
    setDayOfMonth(item.day_of_month || 1);
    setStartDate(item.start_date.slice(0, 10));
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSaving(true);
    try {
      await apiClient.updateRecurringTransaction(editingItem.id, {
        description,
        merchant_name: merchantName || undefined,
        amount: parseFloat(amount),
        currency,
        category_id: categoryId,
        payment_method: paymentMethod,
        card_id: paymentMethod === 'card' ? cardId : undefined,
        frequency,
        interval,
        day_of_month: frequency !== 'weekly' ? dayOfMonth : undefined,
      });
      addToast('success', t('recurring.updated'));
      setShowEditModal(false);
      setEditingItem(null);
      fetchData();
    } catch {
      addToast('error', t('recurring.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePauseResume = async (item: RecurringTransaction) => {
    try {
      if (item.is_active) {
        await apiClient.pauseRecurringTransaction(item.id);
        addToast('info', t('recurring.paused'));
      } else {
        await apiClient.resumeRecurringTransaction(item.id);
        addToast('success', t('recurring.resumed'));
      }
      fetchData();
    } catch {
      addToast('error', t('recurring.statusUpdateFailed'));
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteRecurringTransaction(deletingItem.id);
      addToast('success', t('recurring.deleted'));
      setShowDeleteModal(false);
      setDeletingItem(null);
      fetchData();
    } catch {
      addToast('error', t('recurring.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const isInstallment = (item: RecurringTransaction) => item.total_installments !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('recurring.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('recurring.subtitle')}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('recurring.addRecurring')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-pulse-blue-500" />
        </div>
      ) : recurring.length === 0 ? (
        <div className="card p-8 text-center">
          <RefreshCw className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('recurring.noRecurring')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('recurring.noRecurringDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recurring.map((item) => (
            <div key={item.id} className={cn('card p-5', !item.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-10 w-10 rounded-xl flex items-center justify-center',
                    isInstallment(item) ? 'bg-purple-100' : 'bg-pulse-blue-100'
                  )}>
                    {isInstallment(item) ? <CreditCardIcon className="h-5 w-5 text-purple-600" /> : <RefreshCw className="h-5 w-5 text-pulse-blue-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{item.description || t('common.untitled')}</p>
                    <p className="text-xs text-gray-500">
                      {isInstallment(item) ? t('recurring.installments') : t('recurring.recurring')} · {item.frequency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {item.is_active ? (
                    <button onClick={() => handlePauseResume(item)} className="p-1.5 rounded-md text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors" title={t('recurring.pause')}>
                      <Pause className="h-4 w-4" />
                    </button>
                  ) : (
                    <button onClick={() => handlePauseResume(item)} className="p-1.5 rounded-md text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title={t('recurring.resume')}>
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => handleEdit(item)} className="p-1.5 rounded-md text-gray-400 hover:text-pulse-blue-500 hover:bg-pulse-blue-50 transition-colors" title={t('common.edit')}>
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setDeletingItem(item); setShowDeleteModal(true); }} className="p-1.5 rounded-md text-gray-400 hover:text-pulse-red-500 hover:bg-pulse-red-50 transition-colors" title={t('common.delete')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{t('common.amount')}</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(item.amount, item.currency)}</span>
                </div>
                {isInstallment(item) && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">{t('recurring.progress')}</span>
                    <span className="font-medium text-purple-600">
                      {item.current_installment || 0}/{item.total_installments} {t('recurring.installmentsUnit')}
                      {item.original_amount && ` · ${t('recurring.total')} ${formatCurrency(item.original_amount, item.currency)}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{t('recurring.nextExecution')}</span>
                  <span className="text-gray-900 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {item.is_active && item.next_execution_date ? formatDate(item.next_execution_date) : '—'}
                  </span>
                </div>
                {item.payment_method === 'card' && item.card && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">{t('recurring.card')}</span>
                    <span className="text-gray-900">{item.card.bank_name} •••• {item.card.last_four_digits}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{t('common.status')}</span>
                  {item.is_active ? <Badge variant="success">{t('common.active')}</Badge> : <Badge variant="default">{t('common.paused')}</Badge>}
                </div>
              </div>

              {isInstallment(item) && item.total_installments && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${((item.current_installment || 0) / item.total_installments) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('recurring.addRecurringTransaction')} size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button type="button" onClick={() => setMode('recurring')} className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-colors', mode === 'recurring' ? 'bg-white text-pulse-blue-600 shadow-sm' : 'text-gray-500')}>
              {t('recurring.recurringIndefinite')}
            </button>
            <button type="button" onClick={() => setMode('installments')} className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-colors', mode === 'installments' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500')}>
              {t('recurring.installmentsCuotas')}
            </button>
          </div>

          <div>
            <label className="label-field">{t('common.description')}</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="e.g., Netflix, Gym, TV in 12 cuotas" required maxLength={200} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">{t('common.amount')} {mode === 'installments' ? t('recurring.amountPerInstallment') : ''}</label>
              <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="input-field" placeholder="0.00" required />
            </div>
            <div>
              <label className="label-field">{t('common.currency')}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="select-field">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {mode === 'installments' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">{t('recurring.totalInstallments')}</label>
                <input type="number" value={totalInstallments} onChange={(e) => setTotalInstallments(parseInt(e.target.value) || 1)} className="input-field" min={1} max={360} required />
              </div>
              <div>
                <label className="label-field">{t('recurring.totalPurchaseOptional')}</label>
                <input type="text" inputMode="decimal" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="input-field" placeholder="e.g., 1200" />
              </div>
            </div>
          )}

          <div>
            <label className="label-field">{t('common.category')}</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="select-field" required>
              <option value="">{t('common.select')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">{t('recurring.frequency')}</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)} className="select-field">
                <option value="weekly">{t('recurring.weekly')}</option>
                <option value="monthly">{t('recurring.monthly')}</option>
                <option value="yearly">{t('recurring.yearly')}</option>
              </select>
            </div>
            <div>
              <label className="label-field">{t('recurring.interval')}</label>
              <input type="number" value={interval} onChange={(e) => setInterval(parseInt(e.target.value) || 1)} className="input-field" min={1} max={12} />
            </div>
          </div>

          {frequency !== 'weekly' && (
            <div>
              <label className="label-field">{t('recurring.dayOfMonth')}</label>
              <input type="number" value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)} className="input-field" min={1} max={31} />
            </div>
          )}

          <div>
            <label className="label-field">{t('recurring.startDate')}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">{t('recurring.paymentMethod')}</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card')} className="select-field">
                <option value="cash">{t('common.cash')}</option>
                <option value="card">{t('common.card')}</option>
              </select>
            </div>
            {paymentMethod === 'card' && (
              <div>
                <label className="label-field">{t('recurring.card')}</label>
                <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="select-field" required>
                  <option value="">{t('common.select')}</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.bank_name} •••• {c.last_four_digits}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingItem(null); }} title={t('recurring.editRecurringTransaction')} size="md">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="label-field">{t('common.description')}</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" required maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">{t('common.amount')}</label>
              <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="input-field" required />
            </div>
            <div>
              <label className="label-field">{t('common.currency')}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="select-field">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-field">{t('common.category')}</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="select-field" required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">{t('recurring.frequency')}</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)} className="select-field">
                <option value="weekly">{t('recurring.weekly')}</option>
                <option value="monthly">{t('recurring.monthly')}</option>
                <option value="yearly">{t('recurring.yearly')}</option>
              </select>
            </div>
            <div>
              <label className="label-field">{t('recurring.interval')}</label>
              <input type="number" value={interval} onChange={(e) => setInterval(parseInt(e.target.value) || 1)} className="input-field" min={1} max={12} />
            </div>
          </div>
          {frequency !== 'weekly' && (
            <div>
              <label className="label-field">{t('recurring.dayOfMonth')}</label>
              <input type="number" value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)} className="input-field" min={1} max={31} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">{t('recurring.paymentMethod')}</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card')} className="select-field">
                <option value="cash">{t('common.cash')}</option>
                <option value="card">{t('common.card')}</option>
              </select>
            </div>
            {paymentMethod === 'card' && (
              <div>
                <label className="label-field">{t('recurring.card')}</label>
                <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="select-field" required>
                  <option value="">{t('common.select')}</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.bank_name} •••• {c.last_four_digits}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={() => { setShowEditModal(false); setEditingItem(null); }} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeletingItem(null); }} title={t('recurring.deleteRecurringTransaction')} size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-pulse-red-50 border border-pulse-red-100">
            <AlertCircle className="h-5 w-5 text-pulse-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-pulse-red-800">
              <p className="font-semibold mb-1">{t('recurring.deleteWarning')}</p>
              <p>{t('recurring.deleteWarning2')} <strong>{deletingItem?.description}</strong> {t('recurring.deleteWarning3')}</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => { setShowDeleteModal(false); setDeletingItem(null); }} className="btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleDelete} disabled={isDeleting} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pulse-red-600 text-white font-medium hover:bg-pulse-red-700 transition-colors disabled:opacity-50">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('common.delete')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
