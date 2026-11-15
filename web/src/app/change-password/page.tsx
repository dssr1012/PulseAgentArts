'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';
import { apiClient } from '@/lib/api';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast('warning', t('changePassword.fillAllFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('error', t('changePassword.passwordsDoNotMatch'));
      return;
    }

    if (newPassword.length < 8) {
      addToast('error', t('changePassword.passwordTooShort'));
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      addToast('success', t('changePassword.changedSuccess'));
      await refreshUser();
      router.push('/dashboard');
    } catch (err) {
      const apiError = err as { message?: string };
      addToast('error', apiError.message || t('changePassword.changeFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-pulse-blue-500 flex items-center justify-center shadow-lg mb-4">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('changePassword.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.must_change_password
              ? t('changePassword.mustChange')
              : t('changePassword.updatePassword')}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="label-field">
                {t('changePassword.currentPassword')}
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder={t('changePassword.currentPasswordPlaceholder')}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showCurrent ? t('changePassword.hidePassword') : t('changePassword.showPassword')}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="label-field">
                {t('changePassword.newPassword')}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder={t('changePassword.newPasswordPlaceholder')}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showNew ? t('changePassword.hidePassword') : t('changePassword.showPassword')}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label-field">
                {t('changePassword.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder={t('changePassword.confirmPasswordPlaceholder')}
                required
                autoComplete="new-password"
                disabled={isLoading}
                minLength={8}
              />
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('changePassword.changingPassword')}
                </>
              ) : (
                t('changePassword.changeBtn')
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            <button
              onClick={handleLogout}
              className="font-semibold text-pulse-blue-500 hover:text-pulse-blue-600"
            >
              {t('changePassword.logoutInstead')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
