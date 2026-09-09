'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import { formatDate, getTimeUntilExpiry, cn, CURRENCIES } from '@/lib/utils';
import type { FamilyCircle, CircleDetail, CircleMember, Invitation, Currency } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { LoadingOverlay, EmptyState } from '@/components/ui/Spinner';
import {
  Users,
  Plus,
  Send,
  Trash2,
  Crown,
  UserMinus,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Globe,
} from 'lucide-react';

export default function CirclePage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [circleDetail, setCircleDetail] = useState<CircleDetail | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Create circle form
  const [circleName, setCircleName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<Currency>('ARS');
  const [isCreating, setIsCreating] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const fetchCircle = useCallback(async () => {
    setIsLoading(true);
    try {
      if (user?.circle_id) {
        const [circleData, inviteData] = await Promise.allSettled([
          apiClient.getCircle(user.circle_id),
          apiClient.getInvitations(user.circle_id),
        ]);
        if (circleData.status === 'fulfilled') setCircleDetail(circleData.value);
        if (inviteData.status === 'fulfilled') setInvitations(inviteData.value);
      }
    } catch {
      addToast('error', 'Failed to load circle data.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.circle_id, addToast]);

  useEffect(() => { fetchCircle(); }, [fetchCircle]);

  const handleCreateCircle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await apiClient.createCircle({ name: circleName, base_currency: baseCurrency });
      addToast('success', 'Family Circle created! You are now the administrator.');
      setShowCreateModal(false);
      fetchCircle();
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'CIRCLE_ALREADY_MEMBER') {
        addToast('warning', 'You already belong to a Family Circle.');
      } else {
        addToast('error', 'Failed to create circle.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.circle_id) return;
    setIsInviting(true);
    try {
      await apiClient.sendInvitation(user.circle_id, inviteEmail);
      addToast('success', `Invitation sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail('');
      fetchCircle();
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'INVITE_ALREADY_MEMBER') {
        addToast('warning', 'This email is already a member of the circle.');
      } else {
        addToast('error', 'Failed to send invitation.');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!user?.circle_id || !confirm('Remove this member from the circle?')) return;
    try {
      await apiClient.removeMember(user.circle_id, userId);
      addToast('success', 'Member removed.');
      fetchCircle();
    } catch {
      addToast('error', 'Failed to remove member.');
    }
  };

  const handleChangeCurrency = async (newCurrency: Currency) => {
    if (!user?.circle_id) return;
    try {
      await apiClient.updateCircleCurrency(user.circle_id, newCurrency);
      addToast('success', 'Base currency updated.');
      fetchCircle();
    } catch {
      addToast('error', 'Failed to update currency.');
    }
  };

  if (isLoading) return <LoadingOverlay />;

  const isAdmin = user?.circle_role === 'admin';

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {!circleDetail ? (
        /* No circle yet - show create form */
        <div className="max-w-lg mx-auto">
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="No Family Circle yet"
            description="Create a Family Circle to start sharing expenses with your family members."
            action={{ label: 'Create Circle', onClick: () => setShowCreateModal(true) }}
          />
        </div>
      ) : (
        <>
          {/* Circle Info */}
          <div className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-pulse-blue-500 flex items-center justify-center shadow-sm">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{circleDetail.circle.name}</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    {circleDetail.members.length} member{circleDetail.members.length !== 1 ? 's' : ''} •
                    Created {formatDate(circleDetail.circle.created_at)}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <button onClick={() => setShowInviteModal(true)} className="btn-primary flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Invite</span>
                </button>
              )}
            </div>

            {/* Base Currency Selector */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Base Currency:</span>
                {isAdmin ? (
                  <select
                    value={circleDetail.circle.base_currency}
                    onChange={(e) => handleChangeCurrency(e.target.value as Currency)}
                    className="select-field w-auto"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="info">{circleDetail.circle.base_currency}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Members */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Members</h2>
            <div className="space-y-3">
              {circleDetail.members.map((member) => (
                <div key={member.user_id} className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-pulse-blue-100 flex items-center justify-center">
                      <span className="text-pulse-blue-600 font-semibold text-sm">
                        {member.given_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{member.given_name}</p>
                        {member.role === 'admin' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-pulse-yellow-600 bg-pulse-yellow-100 px-2 py-0.5 rounded-full">
                            <Crown className="h-3 w-3" /> Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{member.email} • Joined {formatDate(member.joined_at)}</p>
                    </div>
                  </div>
                  {isAdmin && member.role !== 'admin' && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-pulse-red-500 hover:bg-pulse-red-50 transition-colors"
                      aria-label={`Remove ${member.given_name}`}
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Invitations (admin only) */}
          {isAdmin && invitations.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Pending Invitations</h2>
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <div key={inv.id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {inv.status === 'pending' && (
                            <span className="flex items-center gap-1 text-xs text-pulse-yellow-600">
                              <Clock className="h-3 w-3" /> Pending • Expires in {getTimeUntilExpiry(inv.expires_at)}
                            </span>
                          )}
                          {inv.status === 'sent' && (
                            <span className="flex items-center gap-1 text-xs text-pulse-blue-600">
                              <Send className="h-3 w-3" /> Sent
                            </span>
                          )}
                          {inv.status === 'accepted' && (
                            <span className="flex items-center gap-1 text-xs text-pulse-emerald-600">
                              <CheckCircle className="h-3 w-3" /> Accepted
                            </span>
                          )}
                          {inv.status === 'expired' && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <XCircle className="h-3 w-3" /> Expired
                            </span>
                          )}
                          {inv.status === 'delivery_failed' && (
                            <span className="flex items-center gap-1 text-xs text-pulse-red-600">
                              <AlertCircle className="h-3 w-3" /> Delivery Failed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Circle Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Family Circle" size="sm">
        <form onSubmit={handleCreateCircle} className="space-y-4">
          <div>
            <label htmlFor="circleName" className="label-field">Circle Name</label>
            <input
              id="circleName"
              type="text"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
              className="input-field"
              placeholder="e.g., Mi Familia"
              maxLength={100}
              required
            />
          </div>
          <div>
            <label htmlFor="baseCurrency" className="label-field">Base Currency</label>
            <select
              id="baseCurrency"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value as Currency)}
              className="select-field"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c} ({c === 'ARS' ? 'Argentine Peso' : c === 'USD' ? 'US Dollar' : 'Euro'})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isCreating} className="btn-primary">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Circle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invite Modal */}
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Send Invitation" size="sm">
        <form onSubmit={handleSendInvitation} className="space-y-4">
          <div>
            <label htmlFor="inviteEmail" className="label-field">Email Address</label>
            <input
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="input-field"
              placeholder="family@example.com"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The invitation will expire after 72 hours.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowInviteModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isInviting} className="btn-primary flex items-center gap-2">
              {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}