'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setTempPassword(null);
    try {
      const result = await apiClient.forgotPassword(email);
      addToast('success', 'If the email exists, a temporary password has been sent.');
      if (result.temp_password) {
        setTempPassword(result.temp_password);
      }
    } catch {
      addToast('error', 'Failed to request password reset. Please try again.');
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
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your email to receive a temporary password</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label-field">Email address</label>
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
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
              ) : (
                'Send temporary password'
              )}
            </button>
          </form>

          {tempPassword && (
            <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-1">Your temporary password:</p>
              <p className="text-sm text-blue-800 font-mono select-all">{tempPassword}</p>
              <p className="text-xs text-blue-600 mt-2">
                Use this to log in. You will be asked to change it immediately.
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-pulse-blue-500 hover:text-pulse-blue-600">
              <ArrowLeft className="h-3 w-3" /> Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
