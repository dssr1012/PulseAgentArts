'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';
import { apiClient } from '@/lib/api';
import { WidgetRenderer } from './WidgetRenderer';
import type { Widget } from './ai-dashboard-types';
import { Send, MessageCircle, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  widgets?: Widget[];
}

const SUGGESTED_QUESTIONS = [
  '¿Cómo está mi flujo de caja este mes?',
  '¿Qué estrategia de pago me recomendás?',
  '¿Cuánto superávit voy a tener?',
  '¿Análisis de mis tarjetas de crédito',
];

export function CopilotChat() {
  const { activeCircleId } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || !activeCircleId || isLoading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { job_id } = await apiClient.askCopilot(activeCircleId, q);

      const maxPolls = 90;
      const pollInterval = 2000;
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        const result = await apiClient.getCopilotResult(activeCircleId, job_id);
        if (result.status === 'done') {
          const assistantMsg: Message = {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: result.text || '',
            widgets: result.widgets,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          break;
        }
        if (result.status === 'error' || result.status === 'not_found') {
          const errorMsg: Message = {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text: t('copilot.errorResponse'),
          };
          setMessages((prev) => [...prev, errorMsg]);
          break;
        }
      }
    } catch {
      addToast('error', t('copilot.error'));
      const errorMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: t('copilot.errorResponse'),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-pulse-blue-500 px-5 py-3 text-white shadow-lg hover:bg-pulse-blue-600 transition-colors lg:bottom-6 lg:right-6"
        aria-label={t('copilot.open')}
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium">{t('copilot.askCopilot')}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-0 z-50 flex h-[600px] w-full max-w-md flex-col rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 lg:bottom-6 lg:right-6 lg:rounded-2xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-pulse-blue-500" />
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('copilot.title')}</h3>
            <p className="text-xs text-gray-500">{t('copilot.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          aria-label={t('copilot.close')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="rounded-xl bg-pulse-blue-50 dark:bg-pulse-blue-900/20 p-4 text-sm text-pulse-blue-700 dark:text-pulse-blue-300">
              {t('copilot.welcome')}
            </div>
            <p className="text-xs font-medium text-gray-500">{t('copilot.suggestions')}</p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-pulse-blue-300 hover:bg-pulse-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-pulse-blue-900/20"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex flex-col gap-2',
              msg.role === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'rounded-2xl px-4 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-pulse-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              )}
            >
              {msg.text.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-1' : ''}>
                  {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                </p>
              ))}
            </div>
            {msg.widgets && msg.widgets.length > 0 && (
              <div className="w-full space-y-3">
                {msg.widgets.map((w) => (
                  <WidgetRenderer key={w.id} widget={w} />
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Sparkles className="h-4 w-4 animate-pulse text-pulse-blue-500" />
            {t('copilot.thinking')}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            id="copilot-input"
            name="copilot-question"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('copilot.placeholder')}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-pulse-blue-500 focus:outline-none focus:ring-1 focus:ring-pulse-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            autoComplete="off"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-pulse-blue-500 p-2.5 text-white hover:bg-pulse-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('copilot.send')}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
