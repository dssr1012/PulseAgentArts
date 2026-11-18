'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CreditCard as CreditCardIcon,
  Repeat,
  Target,
  Sparkles,
  Lightbulb,
} from 'lucide-react';

interface PlanItem {
  id: string;
  item_type: string;
  card_id: string | null;
  recurring_id: string | null;
  label: string;
  planned_amount: number;
  actual_amount: number | null;
  deviation: number | null;
  deviation_pct: number | null;
  due_date: string | null;
  due_day: number | null;
  is_full_payment: boolean;
  is_paid: boolean;
  paid_at: string | null;
  notes: string | null;
}

interface PaymentPlan {
  id: string;
  month: string;
  scenario: string;
  available_cash: number;
  total_planned: number;
  total_paid: number;
  total_deviation: number;
  paid_item_count: number;
  total_item_count: number;
  completion_pct: number;
  status: string;
  notes: string | null;
  llm_reasoning: string | null;
  deviation_analysis: string | null;
  deviation_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
  items: PlanItem[];
}

export default function PaymentPlanPage() {
  const { activeCircleId } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslation();

  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableCash, setAvailableCash] = useState('');
  const [showProjection, setShowProjection] = useState(false);
  const [projection, setProjection] = useState<any>(null);
  const [loadingProjection, setLoadingProjection] = useState(false);

  // Generate modal — side-by-side options
  const [cashSuggestion, setCashSuggestion] = useState<any>(null);
  const [llmRecommendation, setLlmRecommendation] = useState<any>(null);
  const [strategies, setStrategies] = useState<any>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('llm');
  const [optionsFetchedFor, setOptionsFetchedFor] = useState<string>('');

  // Deviation analysis
  const [deviationAnalysis, setDeviationAnalysis] = useState<string | null>(null);
  const [analyzingDeviation, setAnalyzingDeviation] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Inline edit state
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [savingItem, setSavingItem] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!activeCircleId) return;
    setIsLoading(true);
    try {
      const data = await apiClient.getCurrentPaymentPlan(activeCircleId);
      setPlan(data);
    } catch (err: any) {
      if (err?.status === 404) {
        setPlan(null);
      } else {
        addToast('error', t('paymentPlan.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeCircleId, addToast, t]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Fetch available cash suggestion when modal opens
  useEffect(() => {
    if (showGenerateModal && activeCircleId && !cashSuggestion) {
      apiClient.getAvailableCashSuggestion(activeCircleId).then(setCashSuggestion).catch(() => {});
    }
  }, [showGenerateModal, activeCircleId, cashSuggestion]);

  // Fetch LLM recommendation + strategies when cash changes in modal
  useEffect(() => {
    if (!showGenerateModal || !activeCircleId) return;
    const cash = parseFloat(availableCash);
    if (isNaN(cash) || cash <= 0) {
      setLlmRecommendation(null);
      setStrategies(null);
      setOptionsFetchedFor('');
      return;
    }
    const key = String(cash);
    if (key === optionsFetchedFor) return;
    setLoadingOptions(true);
    Promise.allSettled([
      apiClient.getPaymentRecommendation(activeCircleId, cash),
      apiClient.getPaymentStrategy(activeCircleId, cash),
    ]).then(([rec, strat]) => {
      if (rec.status === 'fulfilled') setLlmRecommendation(rec.value);
      if (strat.status === 'fulfilled') setStrategies(strat.value);
      setOptionsFetchedFor(key);
      setLoadingOptions(false);
    });
  }, [showGenerateModal, activeCircleId, availableCash, optionsFetchedFor]);

  const handleGenerate = async () => {
    if (!activeCircleId) return;
    const cash = parseFloat(availableCash);
    if (isNaN(cash) || cash < 0) {
      addToast('error', t('paymentPlan.invalidCash'));
      return;
    }
    setIsGenerating(true);
    try {
      const data = await apiClient.generatePaymentPlan(activeCircleId, cash, selectedScenario);
      setPlan(data);
      setShowGenerateModal(false);
      setDeviationAnalysis(null);
      setShowAnalysis(false);
      addToast('success', t('paymentPlan.generated'));
    } catch {
      addToast('error', t('paymentPlan.generateFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyzeDeviation = async () => {
    if (!activeCircleId || !plan) return;
    setAnalyzingDeviation(true);
    setShowAnalysis(true);
    try {
      const result = await apiClient.analyzeDeviation(activeCircleId, plan.id);
      setDeviationAnalysis(result.analysis);
    } catch {
      addToast('error', t('paymentPlan.analysisFailed'));
      setShowAnalysis(false);
    } finally {
      setAnalyzingDeviation(false);
    }
  };

  const handleRegenerate = () => {
    if (plan) {
      setAvailableCash(String(plan.available_cash));
    }
    setLlmRecommendation(null);
    setStrategies(null);
    setOptionsFetchedFor('');
    setSelectedScenario('llm');
    setShowGenerateModal(true);
  };

  // Load existing deviation analysis from plan
  useEffect(() => {
    if (plan?.deviation_analysis) {
      setDeviationAnalysis(plan.deviation_analysis);
    } else {
      setDeviationAnalysis(null);
      setShowAnalysis(false);
    }
  }, [plan]);

  const handleMarkPaid = async (itemId: string) => {
    if (!activeCircleId || !plan) return;
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount < 0) {
      addToast('error', t('paymentPlan.invalidAmount'));
      return;
    }
    setSavingItem(itemId);
    try {
      const updated = await apiClient.markPaymentPlanItemPaid(activeCircleId, plan.id, itemId, amount);
      setPlan(updated);
      setEditingItem(null);
      addToast('success', t('paymentPlan.markedPaid'));
    } catch {
      addToast('error', t('paymentPlan.markPaidFailed'));
    } finally {
      setSavingItem(null);
    }
  };

  const handleUnmarkPaid = async (item: PlanItem) => {
    if (!activeCircleId || !plan) return;
    setSavingItem(item.id);
    try {
      const updated = await apiClient.updatePaymentPlanItem(activeCircleId, plan.id, item.id, {
        is_paid: false,
        actual_amount: null,
      });
      setPlan(updated);
      addToast('success', t('paymentPlan.unmarkedPaid'));
    } catch {
      addToast('error', t('paymentPlan.markPaidFailed'));
    } finally {
      setSavingItem(null);
    }
  };

  const handleLoadProjection = async () => {
    if (!activeCircleId || !plan) return;
    setLoadingProjection(true);
    setShowProjection(!showProjection);
    if (!projection) {
      try {
        const data = await apiClient.getProjectionSnapshot(activeCircleId, plan.month);
        setProjection(data);
      } catch {
        addToast('error', t('paymentPlan.projectionLoadFailed'));
      }
    }
    setLoadingProjection(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-blue-500" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('paymentPlan.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('paymentPlan.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {plan && (
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              {t('paymentPlan.regenerate')}
            </button>
          )}
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-pulse-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {plan ? t('paymentPlan.regenerate') : t('paymentPlan.generate')}
          </button>
        </div>
      </div>

      {/* No plan state */}
      {!plan && (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <CalendarClock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('paymentPlan.noPlan')}</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">{t('paymentPlan.noPlanDesc')}</p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-pulse-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-pulse-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('paymentPlan.generate')}
          </button>
        </div>
      )}

      {/* Plan view */}
      {plan && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<Wallet className="h-5 w-5" />}
              label={t('paymentPlan.totalPlanned')}
              value={formatCurrency(plan.total_planned, 'ARS')}
              color="blue"
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label={t('paymentPlan.totalPaid')}
              value={formatCurrency(plan.total_paid, 'ARS')}
              color="green"
            />
            <SummaryCard
              icon={plan.total_deviation >= 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
              label={t('paymentPlan.deviation')}
              value={formatCurrency(plan.total_deviation, 'ARS')}
              color={plan.total_deviation > 0 ? 'red' : plan.total_deviation < 0 ? 'yellow' : 'green'}
              hint={t('paymentPlan.deviationHint')}
            />
            <SummaryCard
              icon={<Target className="h-5 w-5" />}
              label={t('paymentPlan.completion')}
              value={`${plan.completion_pct}%`}
              color="purple"
              hint={`${plan.paid_item_count}/${plan.total_item_count} ${t('paymentPlan.itemsPaid')}`}
            />
          </div>

          {/* Plan meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="blue">{plan.month}</Badge>
            <Badge variant="gray">{t('paymentPlan.scenario')}: {plan.scenario}</Badge>
            <Badge variant="gray">{t('paymentPlan.availableCash')}: {formatCurrency(plan.available_cash, 'ARS')}</Badge>
            <Badge variant={plan.status === 'completed' ? 'green' : 'yellow'}>
              {plan.status === 'completed' ? t('common.confirmed') : t('common.active')}
            </Badge>
          </div>

          {/* LLM reasoning panel */}
          {plan.llm_reasoning && (
            <div className="rounded-xl border border-pulse-blue-200 bg-pulse-blue-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-pulse-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900">{t('paymentPlan.llmReasoningTitle')}</h3>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.llm_reasoning}</p>
            </div>
          )}

          {/* Items table */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">{t('paymentPlan.item')}</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3 hidden sm:table-cell">{t('paymentPlan.due')}</th>
                    <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">{t('paymentPlan.planned')}</th>
                    <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">{t('paymentPlan.actual')}</th>
                    <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3 hidden md:table-cell">{t('paymentPlan.deviation')}</th>
                    <th className="text-center text-xs font-semibold text-gray-600 uppercase px-4 py-3">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {plan.items.map((item) => {
                    const isEditing = editingItem === item.id;
                    return (
                      <tr key={item.id} className={cn('hover:bg-gray-50', item.is_paid && 'bg-green-50/50')}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {item.item_type === 'card_payment' ? (
                              <CreditCardIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            ) : (
                              <Repeat className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                              {item.is_full_payment && (
                                <span className="text-xs text-green-600">{t('paymentPlan.fullPayment')}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {item.due_date ? (
                            <span className="text-sm text-gray-600">{formatDate(item.due_date)}</span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(item.planned_amount, 'ARS')}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="w-28 rounded-md border border-pulse-blue-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-pulse-blue-200"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleMarkPaid(item.id);
                                if (e.key === 'Escape') setEditingItem(null);
                              }}
                            />
                          ) : item.actual_amount !== null ? (
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(item.actual_amount, 'ARS')}</span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          {item.deviation !== null ? (
                            <span className={cn(
                              'text-sm font-medium',
                              item.deviation > 0 ? 'text-red-600' : item.deviation < 0 ? 'text-yellow-600' : 'text-green-600'
                            )}>
                              {formatCurrency(item.deviation, 'ARS')}
                              {item.deviation_pct !== null && (
                                <span className="text-xs text-gray-400 ml-1">({item.deviation_pct > 0 ? '+' : ''}{item.deviation_pct.toFixed(1)}%)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {savingItem === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            ) : isEditing ? (
                              <>
                                <button
                                  onClick={() => handleMarkPaid(item.id)}
                                  className="rounded p-1.5 text-green-600 hover:bg-green-50"
                                  title={t('paymentPlan.confirmPaid')}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
                                >
                                  <Circle className="h-4 w-4" />
                                </button>
                              </>
                            ) : item.is_paid ? (
                              <button
                                onClick={() => handleUnmarkPaid(item)}
                                className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
                                title={t('paymentPlan.unmarkPaid')}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingItem(item.id);
                                  setEditAmount(String(item.planned_amount));
                                }}
                                className="rounded p-1.5 text-pulse-blue-600 hover:bg-pulse-blue-50"
                                title={t('paymentPlan.enterPaid')}
                              >
                                <Circle className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deviation alert */}
          {plan.total_deviation > 0 && plan.paid_item_count > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">
                  {t('paymentPlan.underpaidAlert')}
                </p>
                <p className="text-sm text-red-700 mt-1">
                  {t('paymentPlan.underpaidDesc').replace('{amount}', formatCurrency(plan.total_deviation, 'ARS'))}
                </p>
              </div>
            </div>
          )}

          {/* Deviation analysis */}
          {plan.paid_item_count > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-700">{t('paymentPlan.deviationAnalysis')}</span>
                </div>
                <button
                  onClick={handleAnalyzeDeviation}
                  disabled={analyzingDeviation}
                  className="flex items-center gap-2 rounded-lg bg-pulse-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-pulse-blue-600 disabled:opacity-50"
                >
                  {analyzingDeviation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {deviationAnalysis ? t('paymentPlan.reanalyze') : t('paymentPlan.analyzeDeviations')}
                </button>
              </div>
              {showAnalysis && (
                <div className="p-4">
                  {analyzingDeviation ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-pulse-blue-500" />
                      <span className="ml-2 text-sm text-gray-500">{t('paymentPlan.analyzing')}</span>
                    </div>
                  ) : deviationAnalysis ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{deviationAnalysis}</p>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Projection snapshot */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={handleLoadProjection}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <TrendingUp className="h-4 w-4" />
                {t('paymentPlan.projectionSnapshot')}
              </span>
              {showProjection ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            </button>
            {showProjection && (
              <div className="p-4">
                {loadingProjection ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : projection ? (
                  <ProjectionView projection={projection} t={t} />
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">{t('paymentPlan.noProjection')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title={t('paymentPlan.generateTitle')}
        size="lg"
      >
        <div className="space-y-4">
          {/* Available cash input with suggestion hint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('paymentPlan.availableCashLabel')}
            </label>
            <input
              type="number"
              value={availableCash}
              onChange={(e) => setAvailableCash(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pulse-blue-200 focus:border-pulse-blue-300"
              autoFocus
            />
            {cashSuggestion && (
              <p className="text-xs text-gray-500 mt-1">
                {t('paymentPlan.suggestionHint')
                  .replace('{income}', formatCurrency(cashSuggestion.income, 'ARS'))
                  .replace('{expenses}', formatCurrency(cashSuggestion.fixedExpenses, 'ARS'))
                  .replace('{buffer}', formatCurrency(cashSuggestion.buffer_amount, 'ARS'))
                  .replace('{suggested}', formatCurrency(cashSuggestion.suggested_available, 'ARS'))}
                <button
                  onClick={() => setAvailableCash(String(cashSuggestion.suggested_available))}
                  className="ml-1 text-pulse-blue-600 hover:underline font-medium"
                >
                  {t('paymentPlan.useSuggestion')}
                </button>
              </p>
            )}
            {!cashSuggestion && <p className="text-xs text-gray-500 mt-1">{t('paymentPlan.availableCashHint')}</p>}
          </div>

          {/* Side-by-side options */}
          {parseFloat(availableCash) > 0 && (
            <>
              {loadingOptions && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-pulse-blue-500" />
                  <span className="ml-2 text-sm text-gray-500">{t('paymentPlan.loadingOptions')}</span>
                </div>
              )}

              {!loadingOptions && (llmRecommendation || strategies) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* LLM Recommendation */}
                  {llmRecommendation && (
                    <button
                      onClick={() => setSelectedScenario('llm')}
                      className={cn(
                        'text-left rounded-xl border-2 p-4 transition-colors',
                        selectedScenario === 'llm'
                          ? 'border-pulse-blue-500 bg-pulse-blue-50/50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-5 w-5 text-pulse-blue-500" />
                        <span className="text-sm font-semibold text-gray-900">{t('paymentPlan.llmOption')}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{llmRecommendation.summary}</p>
                      <div className="space-y-1 mb-2">
                        {llmRecommendation.payments.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-gray-600">{p.bankName} ****{p.lastFourDigits}</span>
                            <span className="font-medium text-gray-900">{formatCurrency(p.amount, 'ARS')}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        {t('paymentPlan.totalRecommended')}: {formatCurrency(llmRecommendation.totalRecommended, 'ARS')}
                      </p>
                    </button>
                  )}

                  {/* Mechanical strategies */}
                  {strategies && (
                    <div
                      className={cn(
                        'rounded-xl border-2 p-4 transition-colors',
                        selectedScenario !== 'llm' ? 'border-pulse-blue-500 bg-pulse-blue-50/50' : 'border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-5 w-5 text-gray-500" />
                        <span className="text-sm font-semibold text-gray-900">{t('paymentPlan.strategiesOption')}</span>
                      </div>
                      <div className="space-y-2">
                        {strategies.scenarios.map((s: any) => (
                          <button
                            key={s.name}
                            onClick={() => setSelectedScenario(s.name)}
                            className={cn(
                              'w-full text-left rounded-lg px-3 py-2 text-xs transition-colors',
                              selectedScenario === s.name
                                ? 'bg-pulse-blue-100 text-pulse-blue-900 font-medium'
                                : 'hover:bg-gray-50 text-gray-600'
                            )}
                          >
                            <div className="flex justify-between">
                              <span>{s.name}</span>
                              <span className="font-medium">{formatCurrency(s.totalPaid, 'ARS')}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {t('paymentPlan.interest')}: {formatCurrency(s.totalInterest, 'ARS')} · {t('paymentPlan.monthsToDebtFree')}: {s.monthsToDebtFree}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* LLM reasoning detail */}
              {selectedScenario === 'llm' && llmRecommendation?.reasoning && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{llmRecommendation.reasoning}</p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowGenerateModal(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !availableCash}
              className="flex items-center gap-2 rounded-lg bg-pulse-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-blue-600 disabled:opacity-50"
            >
              {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isGenerating ? t('common.loading') : t('paymentPlan.generate')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryCard({ icon, label, value, color, hint }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  hint?: string;
}) {
  const colorMap = {
    blue: 'bg-pulse-blue-50 text-pulse-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={cn('rounded-lg p-2', colorMap[color])}>{icon}</span>
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function ProjectionView({ projection, t }: { projection: any; t: (key: string) => string }) {
  const months = projection.months || [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200">
          <tr>
            <th className="text-left font-medium text-gray-600 px-2 py-2">{t('paymentPlan.month')}</th>
            <th className="text-right font-medium text-gray-600 px-2 py-2">{t('paymentPlan.income')}</th>
            <th className="text-right font-medium text-gray-600 px-2 py-2">{t('paymentPlan.expenses')}</th>
            <th className="text-right font-medium text-gray-600 px-2 py-2">{t('paymentPlan.cardPayments')}</th>
            <th className="text-right font-medium text-gray-600 px-2 py-2">{t('paymentPlan.netFlow')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {months.map((m: any, i: number) => (
            <tr key={i} className={i === 0 ? 'bg-blue-50/30' : ''}>
              <td className="px-2 py-2 font-medium text-gray-900">{m.label}</td>
              <td className="px-2 py-2 text-right text-green-600">{formatCurrency(m.income, 'ARS')}</td>
              <td className="px-2 py-2 text-right text-red-600">{formatCurrency(m.expenses, 'ARS')}</td>
              <td className="px-2 py-2 text-right text-orange-600">{formatCurrency(m.card_payments, 'ARS')}</td>
              <td className={cn('px-2 py-2 text-right font-medium', m.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600')}>
                {formatCurrency(m.net_cash_flow, 'ARS')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
