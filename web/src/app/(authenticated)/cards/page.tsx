'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import type { CreditCard, StatementPreview, CardType } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner';
import { StatementUploader } from '@/components/cards/StatementUploader';
import { StatementPreviewComponent } from '@/components/cards/StatementPreview';
import {
  Plus,
  CreditCard,
  Trash2,
  Loader2,
  Upload,
  Visa,
  Mastercard,
} from 'lucide-react';

export default function CardsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null);
  const [statementPreview, setStatementPreview] = useState<StatementPreview | null>(null);

  // Add card form state
  const [bankName, setBankName] = useState('');
  const [cardType, setCardType] = useState<CardType>('Visa');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getCards();
      setCards(data);
    } catch {
      addToast('error', 'Failed to load cards.');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(lastFourDigits)) {
      addToast('warning', 'Please enter exactly 4 digits.');
      return;
    }
    setIsCreating(true);
    try {
      await apiClient.createCard({ bank_name: bankName, card_type: cardType, last_4_digits: lastFourDigits });
      addToast('success', 'Card registered successfully.');
      setShowAddModal(false);
      setBankName('');
      setLastFourDigits('');
      fetchCards();
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'CARD_SENSITIVE_DATA_REJECTED') {
        addToast('error', 'Sensitive card data detected. Only last 4 digits are allowed.');
      } else {
        addToast('error', 'Failed to register card.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadClick = (card: CreditCard) => {
    setSelectedCard(card);
    setShowUploadModal(true);
    setStatementPreview(null);
  };

  const handleStatementParsed = (preview: StatementPreview) => {
    setStatementPreview(preview);
  };

  const handleStatementConfirmed = async () => {
    if (!statementPreview) return;
    try {
      await apiClient.confirmStatement(statementPreview.preview_id);
      addToast('success', 'Statement confirmed and expenses created.');
      setShowUploadModal(false);
      setStatementPreview(null);
      setSelectedCard(null);
    } catch {
      addToast('error', 'Failed to confirm statement.');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cards & Statements</h1>
          <p className="text-sm text-gray-500 mt-1">Manage credit cards and upload statements</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Card
        </button>
      </div>

      {/* PAN/CVV Notice */}
      <div className="alert-yellow flex items-center gap-3" role="alert">
        <CreditCard className="h-5 w-5 text-pulse-yellow-500 shrink-0" />
        <p className="text-sm text-pulse-yellow-800">
          For your security, we never store full card numbers or CVV codes. Only the last 4 digits are saved.
        </p>
      </div>

      {isLoading ? (
        <LoadingOverlay />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title="No cards registered"
          description="Add a credit card to start uploading statements."
          action={{ label: 'Add Card', onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.id} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pulse-blue-500 to-pulse-blue-700 flex items-center justify-center shadow-sm">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                  {card.card_type}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{card.bank_name}</p>
              <p className="text-lg font-mono text-gray-600 mt-1">•••• •••• •••• {card.last_four_digits}</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleUploadClick(card)}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Statement
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Card Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Register Credit Card" size="sm">
        <form onSubmit={handleCreateCard} className="space-y-4">
          <div>
            <label htmlFor="bankName" className="label-field">Bank Name</label>
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
            <label htmlFor="cardType" className="label-field">Card Type</label>
            <select
              id="cardType"
              value={cardType}
              onChange={(e) => setCardType(e.target.value as CardType)}
              className="select-field"
            >
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
            </select>
          </div>
          <div>
            <label htmlFor="lastFour" className="label-field">Last 4 Digits</label>
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
              Only the last 4 digits. We never store full card numbers.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isCreating} className="btn-primary">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register Card'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Statement Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => { setShowUploadModal(false); setStatementPreview(null); }}
        title={statementPreview ? 'Statement Preview' : 'Upload Statement'}
        size="xl"
      >
        {selectedCard && !statementPreview && (
          <StatementUploader
            cardId={selectedCard.id}
            onParsed={handleStatementParsed}
            onCancel={() => setShowUploadModal(false)}
          />
        )}
        {statementPreview && (
          <StatementPreviewComponent
            preview={statementPreview}
            onConfirm={handleStatementConfirmed}
            onReject={() => { setStatementPreview(null); }}
          />
        )}
      </Modal>
    </div>
  );
}