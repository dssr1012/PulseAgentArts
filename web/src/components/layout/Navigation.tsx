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
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/i18n';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  badge?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    { href: '/dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/transactions', labelKey: 'nav.transactions', icon: <Receipt className="h-5 w-5" /> },
    { href: '/incomes', labelKey: 'nav.incomes', icon: <TrendingUp className="h-5 w-5" /> },
    { href: '/cards', labelKey: 'nav.cards', icon: <CreditCard className="h-5 w-5" /> },
    { href: '/recurring', labelKey: 'nav.recurring', icon: <RefreshCw className="h-5 w-5" /> },
    { href: '/circle', labelKey: 'nav.familyCircle', icon: <Users className="h-5 w-5" /> },
    { href: '/categories', labelKey: 'nav.categories', icon: <Tag className="h-5 w-5" /> },
    { href: '/anomalies', labelKey: 'nav.anomalies', icon: <AlertTriangle className="h-5 w-5" />, badge: 0 },
    { href: '/settings', labelKey: 'nav.settings', icon: <Settings className="h-5 w-5" /> },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      addToast('success', t('settings.loggedOut'));
    } catch {
      addToast('error', t('settings.logoutFailed'));
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
          <p className="text-xs text-gray-500">{t('nav.familyExpenses')}</p>
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
              <span className="flex-1">{t(item.labelKey)}</span>
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-pulse-red-50 hover:text-pulse-red-600 transition-colors flex-1"
          >
            <LogOut className="h-5 w-5" />
            <span>{t('common.logout')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    { href: '/dashboard', labelKey: 'nav.home', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/transactions', labelKey: 'nav.expenses', icon: <Receipt className="h-5 w-5" /> },
    { href: '/cards', labelKey: 'nav.cards', icon: <CreditCard className="h-5 w-5" /> },
    { href: '/circle', labelKey: 'nav.circle', icon: <Users className="h-5 w-5" /> },
    { href: '/anomalies', labelKey: 'nav.alerts', icon: <AlertTriangle className="h-5 w-5" /> },
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
              <span>{t(item.labelKey)}</span>
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
  const { t } = useTranslation();

  const pageTitleMap: Record<string, string> = {
    '/dashboard': 'nav.dashboard',
    '/transactions': 'nav.transactions',
    '/incomes': 'nav.incomes',
    '/cards': 'nav.cardsStatements',
    '/circle': 'nav.familyCircle',
    '/categories': 'nav.categories',
    '/anomalies': 'nav.anomalyAlerts',
    '/settings': 'nav.settings',
  };

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-pulse-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <h1 className="text-base font-semibold text-gray-900">
            {pageTitleMap[pathname] ? t(pageTitleMap[pathname]) : 'PulseExpends'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-pulse-blue-100 flex items-center justify-center">
            <span className="text-pulse-blue-600 font-semibold text-xs">
              {user?.given_name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
