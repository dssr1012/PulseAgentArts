"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useTranslation } from "@/i18n";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { CardPayment, CreditCard, Currency } from "@/types";
import { CreditCardIcon, Plus, Trash2, ArrowDownCircle } from "lucide-react";

interface CardPaymentsProps {
  card: CreditCard;
  onPaymentRecorded?: () => void;
}

export function CardPaymentsModal({ card, onPaymentRecorded }: CardPaymentsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    setLoading(true);
    try {
      await apiClient.createCardPayment(card.id, {
        amount: amt,
        currency,
        payment_date: paymentDate,
        description: description || undefined,
      });
      addToast("success", t("cardPayments.paymentRecorded"));
      setIsOpen(false);
      setAmount("");
      setDescription("");
      onPaymentRecorded?.();
    } catch (err: any) {
      addToast("error", err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary w-full flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        {t("cardPayments.recordPayment")}
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`${t("cardPayments.recordPayment")} — ${card.bank_name} •••• ${card.last_four_digits}`} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">{t("cardPayments.amount")}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field"
              placeholder="50000"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">{t("common.card")}</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="select-field"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="label-field">{t("cardPayments.paymentDate")}</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>
          <div>
            <label className="label-field">{t("cardPayments.description")}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder={t("cardPayments.description")}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <Spinner size="sm" /> : t("cardPayments.recordPayment")}
            </button>
            <button type="button" onClick={() => setIsOpen(false)} className="btn-secondary">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

interface CardPaymentsListProps {
  card: CreditCard;
  isOpen: boolean;
  onClose: () => void;
}

export function CardPaymentsList({ card, isOpen, onClose }: CardPaymentsListProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [payments, setPayments] = useState<CardPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    apiClient
      .getCardPayments(card.id)
      .then((data) => setPayments(data))
      .catch(() => addToast("error", "Error"))
      .finally(() => setLoading(false));
  }, [isOpen, card.id]);

  const handleDelete = async (paymentId: string) => {
    if (!confirm(t("cardPayments.confirmDelete"))) return;
    try {
      await apiClient.deleteCardPayment(card.id, paymentId);
      setPayments(payments.filter((p) => p.id !== paymentId));
      addToast("success", t("cardPayments.paymentDeleted"));
    } catch (err: any) {
      addToast("error", err.message || "Error");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t("cardPayments.paymentHistory")} — ${card.bank_name} •••• ${card.last_four_digits}`} size="lg">
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <ArrowDownCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t("cardPayments.noPayments")}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {payments.map((payment) => (
            <div key={payment.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                  <ArrowDownCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium">{formatCurrency(payment.amount, payment.currency)}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(payment.payment_date)}
                    {payment.description ? ` — ${payment.description}` : ""}
                  </p>
                  {payment.source === "whatsapp" && <Badge variant="info" className="mt-1">WhatsApp</Badge>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(payment.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
