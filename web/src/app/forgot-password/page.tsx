'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';
import { apiClient } from '@/lib/api';
import { Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { addToast } = useToast();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      await apiClient.forgotPassword(email);
      setSent(true);
      addToast('success', t('forgotPassword.success'));
    } catch {
      addToast('error', t('forgotPassword.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-pulse-blue-500 flex items-center justify-center shadow-lg mb-4">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('forgotPassword.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('forgotPassword.subtitle')}</p>
        </div>

        <div className="card">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-sm text-gray-700 mb-2">
                {t('forgotPassword.sentMessage1')} <span className="font-semibold">{email}</span>,
                {t('forgotPassword.sentMessage2')}
              </p>
              <p className="text-sm text-gray-500">
                {t('forgotPassword.sentMessage3')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="label-field">{t('forgotPassword.emailAddress')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10"
                    placeholder="you@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('forgotPassword.sending')}</>
                ) : (
                  t('forgotPassword.sendBtn')
                )}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-pulse-blue-500 hover:text-pulse-blue-600">
              <ArrowLeft className="h-3 w-3" /> {t('forgotPassword.backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
