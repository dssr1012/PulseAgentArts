'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';
import { apiClient } from '@/lib/api';
import type { CreditCard, StatementPreview, CardType, CardMode } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/Tabs';
import { StatementUploader } from '@/components/cards/StatementUploader';
import { StatementReconciliation } from '@/components/cards/StatementReconciliation';
import {
  Plus,
  CreditCard as CreditCardIcon,
  Trash2,
  Edit2,
  AlertCircle,
  Loader2,
  Upload,
  FileText,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export default function CardsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const router = useRouter();

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null);
  const [reconciliationPreviewId, setReconciliationPreviewId] = useState<string | null>(null);
  const [showStatementsModal, setShowStatementsModal] = useState(false);
  const [cardStatements, setCardStatements] = useState<any[]>([]);
  const [isLoadingStatements, setIsLoadingStatements] = useState(false);

  // Add card form state
  const [bankName, setBankName] = useState('');
  const [cardType, setCardType] = useState<CardType>('Visa');
  const [cardMode, setCardMode] = useState<CardMode>('debit');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [tag, setTag] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit card state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete card state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCard, setDeletingCard] = useState<CreditCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getCards();
      setCards(data);
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'CIRCLE_NOT_FOUND') {
        router.replace('/circle');
      } else {
        addToast('error', t('cards.loadFailed'));
      }
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  }, [addToast, router]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(lastFourDigits)) {
      addToast('warning', t('cards.invalidDigits'));
      return;
    }
    setIsCreating(true);
    try {
      await apiClient.createCard({ bank_name: bankName, card_type: cardType, card_mode: cardMode, last_4_digits: lastFourDigits, tag: tag || undefined });
      addToast('success', t('cards.registered'));
      setShowAddModal(false);
      setBankName('');
      setLastFourDigits('');
      setTag('');
      setCardMode('debit');
      fetchCards();
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'CARD_SENSITIVE_DATA_REJECTED') {
        addToast('error', t('cards.sensitiveData'));
      } else {
        addToast('error', t('cards.registerFailed'));
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadClick = (card: CreditCard) => {
    setSelectedCard(card);
    setShowUploadModal(true);
    setReconciliationPreviewId(null);
  };

  const handleEditClick = (card: CreditCard) => {
    setEditingCard(card);
    setBankName(card.bank_name);
    setCardType(card.card_type);
    setCardMode(card.card_mode);
    setLastFourDigits(card.last_four_digits);
    setTag(card.tag || '');
    setShowEditModal(true);
  };

  const handleEditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    if (!/^\d{4}$/.test(lastFourDigits)) {
      addToast('warning', t('cards.invalidDigits'));
      return;
    }
    setIsUpdating(true);
    try {
      await apiClient.updateCard(editingCard.id, {
        bank_name: bankName,
        card_type: cardType,
        card_mode: cardMode,
        last_4_digits: lastFourDigits,
        tag: tag || undefined,
      });
      addToast('success', t('cards.updated'));
      setShowEditModal(false);
      setEditingCard(null);
      fetchCards();
    } catch {
      addToast('error', t('cards.updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteClick = (card: CreditCard) => {
    setDeletingCard(card);
    setShowDeleteModal(true);
  };

  const handleDeleteCard = async () => {
    if (!deletingCard) return;
    setIsDeleting(true);
    try {
      const result = await apiClient.deleteCard(deletingCard.id);
      const affected = result?.affected_expenses ?? result?.affectedExpenses ?? 0;
      if (affected > 0) {
        addToast('warning', `${t('cards.deletedWithExpenses')} ${affected} ${t('cards.deletedWithExpenses2')}`);
      } else {
        addToast('success', t('cards.deletedSuccess'));
      }
      setShowDeleteModal(false);
      setDeletingCard(null);
      fetchCards();
    } catch {
      addToast('error', t('cards.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewStatements = async (card: CreditCard) => {
    setSelectedCard(card);
    setShowStatementsModal(true);
    setIsLoadingStatements(true);
    try {
      const data = await apiClient.listStatements(card.id);
      setCardStatements(data);
    } catch {
      addToast('error', t('cards.statementsLoadFailed'));
    } finally {
      setIsLoadingStatements(false);
    }
  };

  const handleDeleteStatement = async (cardId: string, statementId: string) => {
    if (!confirm(t('cards.confirmDeleteStatement'))) return;
    try {
      await apiClient.deleteStatement(cardId, statementId);
      setCardStatements(prev => prev.filter(s => s.id !== statementId));
      addToast('success', t('cards.statementDeleted'));
    } catch {
      addToast('error', t('cards.statementDeleteFailed'));
    }
  };

  const handleStatementParsed = (preview: StatementPreview) => {
    setReconciliationPreviewId(preview.preview_id);
  };

  const handleResumeReconciliation = (stmtId: string) => {
    setShowStatementsModal(false);
    setCardStatements([]);
    setReconciliationPreviewId(stmtId);
    setShowUploadModal(true);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('cards.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('cards.subtitle')}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> {t('cards.addCard')}
        </button>
      </div>

      {/* PAN/CVV Notice */}
      <div className="alert-yellow flex items-center gap-3" role="alert">
        <CreditCardIcon className="h-5 w-5 text-pulse-yellow-500 shrink-0" />
        <p className="text-sm text-pulse-yellow-800">
          {t('cards.securityNotice')}
        </p>
      </div>

      {isLoading ? (
        <LoadingOverlay />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon className="h-12 w-12" />}
          title={t('cards.noCards')}
          description={t('cards.noCardsDesc')}
          action={{ label: t('cards.addCard'), onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.id} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pulse-blue-500 to-pulse-blue-700 flex items-center justify-center shadow-sm">
                  <CreditCardIcon className="h-6 w-6 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                    {card.card_type}
                  </span>
                  <button
                    onClick={() => handleEditClick(card)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-pulse-blue-600 hover:bg-pulse-blue-50 transition-colors"
                    title={t('cards.editCardTitle')}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(card)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-pulse-red-600 hover:bg-pulse-red-50 transition-colors"
                    title={t('cards.deleteCardTitle')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900">{card.bank_name}</p>
              <p className="text-lg font-mono text-gray-600 mt-1">•••• •••• •••• {card.last_four_digits}</p>
              {card.tag && (
                <span className="inline-block text-xs font-medium text-pulse-blue-700 bg-pulse-blue-50 px-2 py-1 rounded-md mt-1">
                  {card.tag}
                </span>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <button
                  onClick={() => handleUploadClick(card)}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {t('cards.uploadStatement')}
                </button>
                <button
                  onClick={() => handleViewStatements(card)}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {t('cards.viewStatements')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Card Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={t('cards.registerCard')} size="sm">
        <form onSubmit={handleCreateCard} className="space-y-4">
          <div>
            <label htmlFor="bankName" className="label-field">{t('cards.bankName')}</label>
            <input
              id="bankName"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="input-field"
              placeholder="e.g., Santander, Galicia"
              maxLength={100}
              required
            />
          </div>
          <div>
            <label htmlFor="cardType" className="label-field">{t('cards.cardType')}</label>
            <select
              id="cardType"
              value={cardType}
              onChange={(e) => setCardType(e.target.value as CardType)}
              className="select-field"
            >
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
              <option value="AmericanExpress">American Express</option>
            </select>
          </div>
          <div>
            <label htmlFor="cardMode" className="label-field">{t('cards.cardMode')}</label>
            <select
              id="cardMode"
              value={cardMode}
              onChange={(e) => setCardMode(e.target.value as CardMode)}
              className="select-field"
            >
              <option value="debit">{t('common.debit')}</option>
              <option value="credit">{t('common.credit')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="lastFour" className="label-field">{t('cards.last4Digits')}</label>
            <input
              id="lastFour"
              type="text"
              value={lastFourDigits}
              onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input-field font-mono text-center text-lg tracking-widest"
              placeholder="••••"
              maxLength={4}
              required
              pattern="\d{4}"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('cards.last4Hint')}
            </p>
          </div>
          <div>
            <label htmlFor="cardTag" className="label-field">{t('cards.tagOptional')}</label>
            <input
              id="cardTag"
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="input-field"
              placeholder="e.g., Daily purchases, Travel"
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('cards.tagHint')}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={isCreating} className="btn-primary">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('cards.registerCardBtn')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Card Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingCard(null); }} title={t('cards.editCard')} size="sm">
        <form onSubmit={handleEditCard} className="space-y-4">
          <div>
            <label htmlFor="editBankName" className="label-field">{t('cards.bankName')}</label>
            <input
              id="editBankName"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="input-field"
              placeholder="e.g., Santander, Galicia"
              maxLength={100}
              required
            />
          </div>
          <div>
            <label htmlFor="editCardType" className="label-field">{t('cards.cardType')}</label>
            <select
              id="editCardType"
              value={cardType}
              onChange={(e) => setCardType(e.target.value as CardType)}
              className="select-field"
            >
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
              <option value="AmericanExpress">American Express</option>
            </select>
          </div>
          <div>
            <label htmlFor="editCardMode" className="label-field">{t('cards.cardMode')}</label>
            <select
              id="editCardMode"
              value={cardMode}
              onChange={(e) => setCardMode(e.target.value as CardMode)}
              className="select-field"
            >
              <option value="debit">{t('common.debit')}</option>
              <option value="credit">{t('common.credit')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="editLastFour" className="label-field">{t('cards.last4Digits')}</label>
            <input
              id="editLastFour"
              type="text"
              value={lastFourDigits}
              onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input-field font-mono text-center text-lg tracking-widest"
              placeholder="••••"
              maxLength={4}
              required
              pattern="\d{4}"
            />
          </div>
          <div>
            <label htmlFor="editCardTag" className="label-field">{t('cards.tagOptional')}</label>
            <input
              id="editCardTag"
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="input-field"
              placeholder="e.g., Daily purchases, Travel"
              maxLength={50}
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={() => { setShowEditModal(false); setEditingCard(null); }} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={isUpdating} className="btn-primary">
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Card Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeletingCard(null); }} title={t('cards.deleteCard')} size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-pulse-red-50 border border-pulse-red-100">
            <AlertCircle className="h-5 w-5 text-pulse-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-pulse-red-800">
              <p className="font-semibold mb-1">{t('common.thisActionCannotBeUndone')}</p>
              <p>
                {t('cards.deleteCardWarning')} <strong>{deletingCard?.bank_name}</strong> (•••• {deletingCard?.last_four_digits}) {t('cards.deleteCardWarning2')} <strong>{t('cards.deleteCardWarning3')}</strong> {t('cards.deleteCardWarning4')} <strong>{t('cards.deleteCardWarning5')}</strong> {t('cards.deleteCardWarning6')}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowDeleteModal(false); setDeletingCard(null); }}
              className="btn-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDeleteCard}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pulse-red-600 text-white font-medium hover:bg-pulse-red-700 transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('cards.deleteCardBtn')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Statement Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => { setShowUploadModal(false); setReconciliationPreviewId(null); }}
        title={reconciliationPreviewId ? t('cards.statementReconciliation') : t('cards.uploadStatement')}
        size="xl"
      >
        {selectedCard && !reconciliationPreviewId && (
          <StatementUploader
            cardId={selectedCard.id}
            onParsed={handleStatementParsed}
            onCancel={() => setShowUploadModal(false)}
          />
        )}
        {reconciliationPreviewId && (
          <StatementReconciliation
            previewId={reconciliationPreviewId}
            onComplete={() => fetchCards()}
            onClose={() => { setShowUploadModal(false); setReconciliationPreviewId(null); setSelectedCard(null); }}
          />
        )}
      </Modal>

      {/* Statements List Modal */}
      <Modal
        isOpen={showStatementsModal}
        onClose={() => { setShowStatementsModal(false); setCardStatements([]); }}
        title={selectedCard ? `${t('cards.statements')} — ${selectedCard.bank_name} •••• ${selectedCard.last_four_digits}` : t('cards.statements')}
        size="xl"
      >
        {isLoadingStatements ? (
          <LoadingOverlay />
        ) : cardStatements.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title={t('cards.noStatements')}
            description={t('cards.noStatementsDesc')}
          />
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {cardStatements.map((stmt: any) => (
              <div key={stmt.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {t('cards.close')} {new Date(stmt.close_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {t('cards.due')} {new Date(stmt.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {stmt.is_confirmed ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md">
                        <CheckCircle className="h-3 w-3" /> {t('common.confirmed')}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        {t('common.pending')}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteStatement(selectedCard!.id, stmt.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={t('cards.deleteStatement')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-red-600">{t('cards.totalAmount')}</p>
                    <p className="text-lg font-bold text-red-700">
                      ${Number(stmt.total_amount).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-xs text-yellow-600">{t('cards.minimumPayment')}</p>
                    <p className="text-lg font-bold text-yellow-700">
                      ${Number(stmt.min_payment).toFixed(2)}
                    </p>
                  </div>
                </div>
                {stmt.items && stmt.items.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      {t('cards.charges')} ({stmt.items.length})
                    </p>
                    <div className="space-y-1">
                      {stmt.items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-xs">
                              {new Date(item.date).toLocaleDateString()}
                            </span>
                            <span className="text-gray-700">{item.description}</span>
                          </div>
                          <span className="font-medium text-gray-900">
                            ${Number(item.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!stmt.is_confirmed && (
                  <button
                    onClick={() => handleResumeReconciliation(stmt.id)}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {t('cards.resumeReconciliation')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}