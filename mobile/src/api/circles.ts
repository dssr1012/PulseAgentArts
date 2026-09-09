// ============================================================
// PulseExpends - Circles API
// ============================================================

import apiClient from './client';
import type {
  FamilyGroup,
  FamilyGroupMember,
  Category,
  Invitation,
  Currency,
} from '../types';

export interface CreateCircleRequest {
  name: string;
  base_currency?: Currency;
}

export interface CreateInvitationRequest {
  email: string;
}

export interface CircleDetailResponse {
  circle: FamilyGroup;
  members: FamilyGroupMember[];
}

/**
 * Create a new family circle
 */
export async function createCircle(data: CreateCircleRequest): Promise<FamilyGroup> {
  const response = await apiClient.post<FamilyGroup>('/circles', data);
  return response.data;
}

/**
 * Get circle details with member list
 */
export async function getCircle(circleId: string): Promise<CircleDetailResponse> {
  const response = await apiClient.get<CircleDetailResponse>(`/circles/${circleId}`);
  return response.data;
}

/**
 * Send an invitation to join the circle (admin only)
 */
export async function createInvitation(
  circleId: string,
  data: CreateInvitationRequest
): Promise<Invitation> {
  const response = await apiClient.post<Invitation>(
    `/circles/${circleId}/invitations`,
    data
  );
  return response.data;
}

/**
 * Validate an invitation token
 */
export async function validateInvitation(
  token: string
): Promise<{ circle_name: string; inviter_name: string; expires_at: string }> {
  const response = await apiClient.get(`/invitations/${token}`);
  return response.data;
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  token: string
): Promise<FamilyGroupMember> {
  const response = await apiClient.post<FamilyGroupMember>(
    `/invitations/${token}/accept`
  );
  return response.data;
}

/**
 * Remove a member from the circle (admin only)
 */
export async function removeMember(
  circleId: string,
  userId: string
): Promise<void> {
  await apiClient.delete(`/circles/${circleId}/members/${userId}`);
}

/**
 * List categories for the circle
 */
export async function listCategories(circleId: string): Promise<Category[]> {
  const response = await apiClient.get<Category[]>(`/circles/${circleId}/categories`);
  return response.data;
}

/**
 * Create a custom category
 */
export async function createCategory(
  circleId: string,
  data: { name: string; icon?: string }
): Promise<Category> {
  const response = await apiClient.post<Category>(
    `/circles/${circleId}/categories`,
    data
  );
  return response.data;
}

/**
 * Delete a custom category
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  await apiClient.delete(`/categories/${categoryId}`);
}