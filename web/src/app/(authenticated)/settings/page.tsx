'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import {
  Settings,
  User,
  Mail,
  Shield,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      addToast('success', 'Logged out successfully.');
      router.push('/login');
    } catch {
      addToast('error', 'Failed to logout.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile Section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-pulse-blue-500" />
          Profile
        </h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-pulse-blue-100 flex items-center justify-center">
              {user?.picture_url ? (
                <img src={user.picture_url} alt={user.given_name} className="h-16 w-16 rounded-full" />
              ) : (
                <span className="text-pulse-blue-600 font-bold text-xl">
                  {user?.given_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">{user?.given_name || 'User'}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-500">Auth Provider</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{user?.auth_provider || 'traditional'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Circle Role</p>
              <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{user?.circle_role || 'None'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-pulse-blue-500" />
          Security
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
              <p className="text-xs text-gray-500">Add an extra layer of security</p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded-md">
              Coming Soon
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">Change Password</p>
              <p className="text-xs text-gray-500">Update your password</p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded-md">
              Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="card">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-pulse-red-50 text-pulse-red-600 px-4 py-3 text-sm font-semibold hover:bg-pulse-red-100 transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          Sign Out
        </button>
      </div>
    </div>
  );
}