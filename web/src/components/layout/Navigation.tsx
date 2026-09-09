'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  CreditCard,
  Users,
  Tag,
  AlertTriangle,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { addToast } = useToast();

  const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/transactions', label: 'Transactions', icon: <Receipt className="h-5 w-5" /> },
    { href: '/incomes', label: 'Incomes', icon: <TrendingUp className="h-5 w-5" /> },
    { href: '/cards', label: 'Cards', icon: <CreditCard className="h-5 w-5" /> },
    { href: '/circle', label: 'Family Circle', icon: <Users className="h-5 w-5" /> },
    { href: '/categories', label: 'Categories', icon: <Tag className="h-5 w-5" /> },
    { href: '/anomalies', label: 'Anomalies', icon: <AlertTriangle className="h-5 w-5" />, badge: 0 },
    { href: '/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      addToast('success', 'Logged out successfully');
    } catch {
      addToast('error', 'Failed to logout');
    }
  };

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-gray-50 border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
        <div className="h-9 w-9 rounded-xl bg-pulse-blue-500 flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">PulseExpends</h1>
          <p className="text-xs text-gray-500">Family Expenses</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-pulse-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={cn(isActive && 'text-white')}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-pulse-yellow-400 text-gray-900'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-pulse-blue-100 flex items-center justify-center">
            <span className="text-pulse-blue-600 font-semibold text-sm">
              {user?.given_name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.given_name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-pulse-red-50 hover:text-pulse-red-600 transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Home', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/transactions', label: 'Expenses', icon: <Receipt className="h-5 w-5" /> },
    { href: '/cards', label: 'Cards', icon: <CreditCard className="h-5 w-5" /> },
    { href: '/circle', label: 'Circle', icon: <Users className="h-5 w-5" /> },
    { href: '/anomalies', label: 'Alerts', icon: <AlertTriangle className="h-5 w-5" /> },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-inset-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors min-w-[56px]',
                isActive
                  ? 'text-pulse-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={cn(isActive && 'text-pulse-blue-500')}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-pulse-yellow-400 text-gray-900 h-4 w-4 text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileHeader() {
  const pathname = usePathname();
  const { user } = useAuth();

  const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/transactions': 'Transactions',
    '/incomes': 'Incomes',
    '/cards': 'Cards & Statements',
    '/circle': 'Family Circle',
    '/categories': 'Categories',
    '/anomalies': 'Anomaly Alerts',
    '/settings': 'Settings',
  };

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-pulse-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <h1 className="text-base font-semibold text-gray-900">
            {pageTitles[pathname] || 'PulseExpends'}
          </h1>
        </div>
        <div className="h-8 w-8 rounded-full bg-pulse-blue-100 flex items-center justify-center">
          <span className="text-pulse-blue-600 font-semibold text-xs">
            {user?.given_name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        </div>
      </div>
    </header>
  );
}