'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingPage } from '@/components/ui/Spinner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.must_change_password) {
      router.push('/change-password');
    }
  }, [isLoading, isAuthenticated, user?.must_change_password, router]);

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (user?.must_change_password) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}