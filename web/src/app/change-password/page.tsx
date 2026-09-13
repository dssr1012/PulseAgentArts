'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast('warning', 'Please fill in all fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('error', 'New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      addToast('error', 'New password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      addToast('success', 'Password changed successfully!');
      await refreshUser();
      router.push('/dashboard');
    } catch (err) {
      const apiError = err as { message?: string };
      addToast('error', apiError.message || 'Failed to change password. Please try again.');
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
          <h1 className="text-2xl font-bold text-gray-900">Change Password</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.must_change_password
              ? 'You must change your password before continuing.'
              : 'Update your password'}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="label-field">
                Current password
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Enter current password"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="label-field">
                New password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Enter new password"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label-field">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Re-enter new password"
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
                  Changing password...
                </>
              ) : (
                'Change password'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            <button
              onClick={handleLogout}
              className="font-semibold text-pulse-blue-500 hover:text-pulse-blue-600"
            >
              Log out instead
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
