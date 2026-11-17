'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';
import { apiClient } from '@/lib/api';
import type { DashboardSpec, Widget } from './ai-dashboard-types';
import { WidgetRenderer } from './WidgetRenderer';
import { RefreshCw, Sparkles, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AiDashboard() {
  const { activeCircleId } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslation();

  const [spec, setSpec] = useState<DashboardSpec | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (refresh = false) => {
    if (!activeCircleId) return;
    try {
      const data = await apiClient.getAiDashboard(activeCircleId, refresh);
      setSpec(data);
    } catch {
      addToast('error', t('aiDashboard.loadFailed'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeCircleId, addToast, t]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboard(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-pulse-blue-500 animate-pulse" />
          <span className="text-sm text-gray-500">{t('aiDashboard.generating')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }

  if (!spec) return null;

  const fullWidgets = spec.widgets.filter((w) => w.span === 'full');
  const halfWidgets = spec.widgets.filter((w) => w.span === 'half');
  const thirdWidgets = spec.widgets.filter((w) => w.span === 'third');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-pulse-blue-500" />
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{spec.title}</h2>
            <p className="text-sm text-gray-500">{spec.subtitle}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          {t('aiDashboard.refresh')}
        </button>
      </div>

      {spec.insights && spec.insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {spec.insights.map((insight, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full bg-pulse-blue-50 dark:bg-pulse-blue-900/20 px-3 py-1.5 text-xs text-pulse-blue-700 dark:text-pulse-blue-300"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {insight}
            </div>
          ))}
        </div>
      )}

      {fullWidgets.map((w) => (
        <WidgetRenderer key={w.id} widget={w} />
      ))}

      {halfWidgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {halfWidgets.map((w) => (
            <WidgetRenderer key={w.id} widget={w} />
          ))}
        </div>
      )}

      {thirdWidgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {thirdWidgets.map((w) => (
            <WidgetRenderer key={w.id} widget={w} />
          ))}
        </div>
      )}
    </div>
  );
}
