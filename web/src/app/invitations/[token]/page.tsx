'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import type { InvitationValidation } from '@/types';
import { LoadingPage } from '@/components/ui/Spinner';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function InvitationPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, login } = useAuth();
  const { addToast } = useToast();

  const token = params.token as string;
  const [validation, setValidation] = useState<InvitationValidation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const validateToken = async () => {
      try {
        const data = await apiClient.validateInvitation(token);
        setValidation(data);
      } catch (err: unknown) {
        const apiError = err as { code?: string; message?: string };
        if (apiError.code === 'INVITE_EXPIRED') {
          setError('This invitation has expired. Please request a new one.');
        } else if (apiError.code === 'INVITE_CONSUMED') {
          setError('This invitation has already been used.');
        } else {
          setError('Invalid invitation link.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleAccept = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/invitations/${token}`);
      return;
    }

    setIsAccepting(true);
    try {
      await apiClient.acceptInvitation(token);
      addToast('success', 'You have joined the Family Circle!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const apiError = err as { code?: string };
      if (apiError.code === 'CIRCLE_ALREADY_MEMBER') {
        addToast('warning', 'You already belong to a Family Circle.');
        router.push('/circle');
      } else {
        addToast('error', 'Failed to accept invitation.');
      }
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) return <LoadingPage message="Validating invitation..." />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="card text-center">
          {error ? (
            <>
              <XCircle className="h-12 w-12 text-pulse-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invitation</h2>
              <p className="text-sm text-gray-500">{error}</p>
            </>
          ) : validation ? (
            <>
              <CheckCircle className="h-12 w-12 text-pulse-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Join {validation.circle_name}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {validation.inviter_name} has invited you to join their Family Circle.
              </p>
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="btn-primary w-full"
              >
                {isAccepting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : isAuthenticated ? (
                  'Accept Invitation'
                ) : (
                  'Sign in to Accept'
                )}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}