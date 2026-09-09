'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      // User denied access or error occurred
      window.opener?.postMessage(
        { type: 'google-auth-callback', error },
        window.location.origin
      );
      window.close();
      return;
    }

    if (code) {
      // Send the authorization code back to the opener window
      window.opener?.postMessage(
        { type: 'google-auth-callback', code, state },
        window.location.origin
      );
      window.close();
    } else {
      // No code - redirect to login
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="h-12 w-12 rounded-xl bg-pulse-blue-500 flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <p className="text-sm text-gray-500">Completing Google sign-in...</p>
      </div>
    </div>
  );
}