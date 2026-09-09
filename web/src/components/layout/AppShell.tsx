'use client';

import React from 'react';
import { Sidebar, BottomNav, MobileHeader } from '@/components/layout/Navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <MobileHeader />

        {/* Page content */}
        <main className="pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}