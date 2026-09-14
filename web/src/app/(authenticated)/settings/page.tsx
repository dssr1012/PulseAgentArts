'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  MessageCircle,
  QrCode,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [waQrCode, setWaQrCode] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWaStatus = useCallback(async () => {
    try {
      const data = await apiClient.getWhatsappStatus();
      setWaStatus(data.status);
      setWaQrCode(data.qr_code);
      setWaPhone(data.phone);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchWaStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchWaStatus]);

  const handleConnect = async () => {
    setWaLoading(true);
    try {
      const data = await apiClient.connectWhatsapp();
      setWaStatus(data.status);
      setWaQrCode(data.qr_code);
      if (data.status === 'connecting') {
        pollRef.current = setInterval(fetchWaStatus, 2000);
      }
    } catch {
      addToast('error', 'Failed to start WhatsApp connection.');
    } finally {
      setWaLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setWaLoading(true);
    try {
      await apiClient.disconnectWhatsapp();
      setWaStatus('disconnected');
      setWaQrCode(null);
      setWaPhone(null);
      if (pollRef.current) clearInterval(pollRef.current);
      addToast('success', 'WhatsApp disconnected.');
    } catch {
      addToast('error', 'Failed to disconnect WhatsApp.');
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    if (waStatus === 'connected' && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (waStatus === 'connecting' && !pollRef.current) {
      pollRef.current = setInterval(fetchWaStatus, 2000);
    }
  }, [waStatus, fetchWaStatus]);

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

      {/* WhatsApp Section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-500" />
          WhatsApp Integration
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">Status</p>
              <p className="text-xs text-gray-500">
                {waStatus === 'connected' && waPhone
                  ? `Connected: ${waPhone}`
                  : waStatus === 'connecting'
                    ? 'Waiting for QR scan...'
                    : 'Not connected'}
              </p>
            </div>
            {waStatus === 'connected' ? (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-md">
                <CheckCircle className="h-3 w-3" /> Connected
              </span>
            ) : waStatus === 'connecting' ? (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-md">
                <Loader2 className="h-3 w-3 animate-spin" /> Connecting
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded-md">
                <XCircle className="h-3 w-3" /> Disconnected
              </span>
            )}
          </div>

          {waStatus === 'connecting' && waQrCode && (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Scan this QR code with your WhatsApp:</p>
              <img src={waQrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
              <p className="text-xs text-gray-400">WhatsApp → Settings → Linked Devices → Link a Device</p>
            </div>
          )}

          {waStatus === 'connected' && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-800 mb-2">
                Send messages to yourself in WhatsApp to load expenses. Examples:
              </p>
              <ul className="text-xs text-green-700 space-y-1">
                <li><code>gaste 1500 en super</code></li>
                <li><code>2500 nafta</code></li>
                <li><code>pagué 800 farmacia</code></li>
                <li><code>spent 100 on coffee</code></li>
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            {waStatus !== 'connected' ? (
              <button
                onClick={handleConnect}
                disabled={waLoading || waStatus === 'connecting'}
                className="btn-primary flex items-center gap-2"
              >
                {waLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                {waStatus === 'connecting' ? 'Waiting for scan...' : 'Connect WhatsApp'}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                disabled={waLoading}
                className="flex items-center gap-2 rounded-lg bg-red-50 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-100"
              >
                {waLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Disconnect
              </button>
            )}
            {waStatus === 'connecting' && (
              <button
                onClick={fetchWaStatus}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            )}
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