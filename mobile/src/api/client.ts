// ============================================================
// PulseExpends - API Client with JWT Interceptor
// Axios-based client with automatic token injection,
// refresh on 401, and retry with exponential backoff
// ============================================================

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_RETRY_CONFIG } from '../constants/config';
import * as tokenStorage from './tokenStorage';
import type { AuthTokens, ApiError } from '../types';

// ============================================================
// Custom error class for API errors
// ============================================================
export class PulseExpendsApiError extends Error {
  code: string;
  traceId?: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number, traceId?: string) {
    super(message);
    this.name = 'PulseExpendsApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.traceId = traceId;
  }
}

// ============================================================
// Token refresh state (prevent concurrent refreshes)
// ============================================================
let isRefreshing = false;
let refreshPromise: Promise<AuthTokens | null> | null = null;

async function refreshAccessToken(): Promise<AuthTokens | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) return null;

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const tokens: AuthTokens = response.data;
      await tokenStorage.saveTokens(tokens);
      return tokens;
    } catch {
      // Refresh failed - clear tokens, user must re-login
      await tokenStorage.clearAll();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ============================================================
// Retry with exponential backoff
// ============================================================
function calculateDelay(retryCount: number): number {
  const delay = API_RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, retryCount);
  return Math.min(delay, API_RETRY_CONFIG.MAX_DELAY_MS);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Create Axios instance
// ============================================================
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// Request interceptor: Inject JWT Bearer token
// ============================================================
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const accessToken = await tokenStorage.getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add correlation ID for tracing
    const correlationId = `mobile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    config.headers['X-Correlation-ID'] = correlationId;

    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// Response interceptor: Handle 401 with token refresh
// ============================================================
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string; message?: string; trace_id?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _retryCount?: number;
    };

    // Handle 401 - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const newTokens = await refreshAccessToken();

      if (newTokens) {
        originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
        return apiClient(originalRequest);
      }

      // Refresh failed - emit auth event for the app to handle
      return Promise.reject(
        new PulseExpendsApiError('AUTH_SESSION_EXPIRED', 'Sesión expirada. Inicie sesión nuevamente.', 401)
      );
    }

    // Handle server errors with retry for idempotent requests
    if (
      error.response?.status &&
      error.response.status >= 500 &&
      (!originalRequest._retryCount || originalRequest._retryCount < API_RETRY_CONFIG.MAX_RETRIES) &&
      ['get', 'head', 'options'].includes(originalRequest.method?.toLowerCase() || '')
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const delay = calculateDelay(originalRequest._retryCount - 1);
      await sleep(delay);
      return apiClient(originalRequest);
    }

    // Transform error to PulseExpendsApiError
    if (error.response?.data) {
      const { code, message, trace_id } = error.response.data;
      throw new PulseExpendsApiError(
        code || 'UNKNOWN_ERROR',
        message || 'Error desconocido',
        error.response.status,
        trace_id
      );
    }

    // Network error
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      throw new PulseExpendsApiError('NETWORK_ERROR', 'Error de conexión. Verifique su conexión a internet.', 0);
    }

    throw new PulseExpendsApiError('UNKNOWN_ERROR', error.message || 'Error desconocido', 0);
  }
);

export default apiClient;