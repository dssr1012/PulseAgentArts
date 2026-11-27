"use client";

import React from "react";
import type { BalanceResponse } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { Wallet, CreditCard, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

interface CashFlowCardsProps {
  balance: BalanceResponse | null;
}

export function CashFlowCards({ balance }: CashFlowCardsProps) {
  const { t } = useTranslation();

  if (!balance?.cash_flow) return null;

  const cf = balance.cash_flow;
  const cards = [
    {
      title: t("cardPayments.cashExpenses"),
      amount: cf.cash_expenses,
      icon: <Wallet className="h-5 w-5 text-white" />,
      bgClass: "balance-card-blue",
    },
    {
      title: t("cardPayments.cardPayments"),
      amount: cf.card_payments,
      icon: <CreditCard className="h-5 w-5 text-white" />,
      bgClass: "balance-card-emerald",
    },
    {
      title: t("cardPayments.totalOutflow"),
      amount: cf.total_outflow,
      icon: <TrendingDown className="h-5 w-5 text-white" />,
      bgClass: "balance-card-red",
    },
  ];

  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-gray-500 mb-3">{t("cardPayments.cashFlow")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={card.bgClass}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white/80">{card.title}</p>
              <div className="rounded-lg bg-white/20 p-2">{card.icon}</div>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(card.amount, balance.base_currency)}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
