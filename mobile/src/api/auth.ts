// ============================================================
// PulseExpends - Auth API
// ============================================================

import apiClient from './client';
import type { User, AuthTokens } from '../types';

export interface RegisterRequest {
  email: string;
  password: string;
  given_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface GoogleSignInRequest {
  id_token: string;
}

/**
 * Register a new user with email and password
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', data);
  return response.data;
}

/**
 * Login with email and password
 */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', data);
  return response.data;
}

/**
 * Refresh authentication tokens
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const response = await apiClient.post<AuthTokens>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return response.data;
}

/**
 * Authenticate with Google ID token
 */
export async function googleSignIn(idToken: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/google/callback', {
    id_token: idToken,
  });
  return response.data;
}

/**
 * Logout (client-side token clearing; server-side refresh token revocation)
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Ignore errors on logout - we clear tokens locally regardless
  }
}