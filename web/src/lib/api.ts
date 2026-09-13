import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { AuthTokens, ApiError } from '@/types';

// Relative by default so the browser calls same-origin /api/v1 through the
// nginx reverse proxy (works for every visitor without CORS or localhost issues).
// Override with NEXT_PUBLIC_API_URL (must be set at BUILD time for Next.js).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// In-memory access token storage (XSS-safe, not accessible from localStorage)
let _accessToken: string | null = null;

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Send HttpOnly cookies (refresh_token) with requests
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor: inject JWT Bearer token + convert body to camelCase
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Add correlation ID
        config.headers['X-Correlation-ID'] = this.generateCorrelationId();
        // Frontend uses snake_case; backend expects camelCase — convert JSON bodies
        if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
          config.data = this.snakeToCamel(config.data);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: unwrap backend envelope + handle 401 with token refresh
    this.client.interceptors.response.use(
      (response) => {
        // Backend wraps all responses in { success, data, timestamp } — unwrap
        // so callers get the inner data directly via response.data.
        const body = response.data;
        if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
          // Backend uses camelCase; frontend types use snake_case — convert
          response.data = this.camelToSnake(body.data);
        }
        return response;
      },
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Don't attempt token refresh for auth endpoints — a 401 here means
        // invalid credentials, not an expired token. Let it fall through to
        // normalizeError so the UI can display the message.
        const isAuthEndpoint =
          originalRequest.url?.startsWith('/auth/login') ||
          originalRequest.url?.startsWith('/auth/register') ||
          originalRequest.url?.startsWith('/auth/refresh');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.refreshTokens();
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.clearTokens();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  getAccessToken(): string | null {
    return _accessToken;
  }

  setAccessToken(token: string): void {
    _accessToken = token;
  }

  clearTokens(): void {
    _accessToken = null;
  }

  private async refreshTokens(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        // Refresh token is sent automatically via HttpOnly cookie (withCredentials)
        const response = await axios.post<{ accessToken: string }>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        // Raw axios bypasses the interceptor — unwrap envelope manually
        const body = response.data as unknown as { success?: boolean; data?: { accessToken: string }; accessToken?: string };
        const accessToken = body.data?.accessToken ?? body.accessToken ?? '';
        this.setAccessToken(accessToken);
        return accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private camelToSnake(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.camelToSnake(item));
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        result[snakeKey] = this.camelToSnake(value);
      }
      return result;
    }
    return obj;
  }

  private snakeToCamel(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.snakeToCamel(item));
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const camelKey = key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
        result[camelKey] = this.snakeToCamel(value);
      }
      return result;
    }
    return obj;
  }

  private normalizeError(error: AxiosError<ApiError>): ApiError {
    if (error.response?.data) {
      const data = error.response.data as unknown as Record<string, unknown>;
      // NestJS can return message as string[] (validation) or string;
      // flatten to a single string so the UI can render it directly.
      const rawMessage = data.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : (rawMessage as string) || 'An unexpected error occurred';
      return {
        code: ((data.errorCode as string) || (data.code as string) || 'AUTH_INVALID_CREDENTIALS') as ApiError['code'],
        message,
        trace_id: (data.traceId as string) || (data.trace_id as string) || '',
        status: error.response.status,
      };
    }
    return {
      code: 'AUTH_INVALID_CREDENTIALS' as const,
      message: error.message || 'An unexpected error occurred',
      trace_id: '',
      status: error.response?.status || 500,
    };
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  // ============ Auth API ============

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async register(email: string, password: string, given_name: string) {
    const response = await this.client.post('/auth/register', { email, password, given_name });
    return response.data;
  }

  async exchangeAuthCode(code: string) {
    const response = await this.client.post('/auth/exchange', { code });
    return response.data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearTokens();
    }
  }

  // ============ Circle API ============

  async getCircle(circleId: string) {
    const response = await this.client.get(`/circles/${circleId}`);
    // Backend returns flat { id, name, members, ... } but frontend expects
    // { circle: { id, name, ... }, members: [...] }
    const data = response.data as Record<string, unknown>;
    if (data && !data.circle && data.id) {
      const { members, ...circle } = data;
      return { circle, members: members || [] } as any;
    }
    return data;
  }

  async createCircle(data: { name: string; base_currency: string }) {
    const response = await this.client.post('/circles', data);
    return response.data;
  }

  async updateCircleCurrency(circleId: string, base_currency: string) {
    const response = await this.client.patch(`/circles/${circleId}`, { base_currency });
    return response.data;
  }

  async sendInvitation(circleId: string, email: string) {
    const response = await this.client.post(`/circles/${circleId}/invitations`, { email });
    return response.data;
  }

  async getInvitations(circleId: string) {
    const response = await this.client.get(`/circles/${circleId}/invitations`);
    return response.data;
  }

  async validateInvitation(token: string) {
    const response = await this.client.get(`/invitations/${token}`);
    return response.data;
  }

  async acceptInvitation(token: string) {
    const response = await this.client.post(`/invitations/${token}/accept`);
    return response.data;
  }

  async removeMember(circleId: string, userId: string) {
    const response = await this.client.delete(`/circles/${circleId}/members/${userId}`);
    return response.data;
  }

  // ============ Transaction API ============

  private flattenTransaction(item: Record<string, unknown>): Record<string, unknown> {
    const flat = { ...item };
    if (item.user && typeof item.user === 'object') {
      const u = item.user as Record<string, unknown>;
      if (u.id && !flat.user_id) flat.user_id = u.id;
      if (u.given_name && !flat.user_name) flat.user_name = u.given_name;
    }
    if (item.category && typeof item.category === 'object') {
      const c = item.category as Record<string, unknown>;
      if (c.id && !flat.category_id) flat.category_id = c.id;
      if (c.name && !flat.category_name) flat.category_name = c.name;
      if (c.group_id && !flat.group_id) flat.group_id = c.group_id;
    }
    return flat;
  }

  async getExpenses(params?: Record<string, unknown>) {
    const response = await this.client.get('/expenses', { params });
    const data = response.data as { data?: unknown[]; total?: number; total_pages?: number; page?: number; limit?: number };
    if (data && Array.isArray(data.data)) {
      data.data = data.data.map((item) => this.flattenTransaction(item as Record<string, unknown>));
    }
    return data as any;
  }

  async createExpense(data: Record<string, unknown>) {
    const response = await this.client.post('/expenses', data);
    return response.data;
  }

  async updateExpense(expenseId: string, data: Record<string, unknown>) {
    const response = await this.client.patch(`/expenses/${expenseId}`, data);
    return response.data;
  }

  async deleteExpense(expenseId: string) {
    const response = await this.client.delete(`/expenses/${expenseId}`);
    return response.data;
  }

  async createIncome(data: Record<string, unknown>) {
    const response = await this.client.post('/incomes', data);
    return response.data;
  }

  async getBalance(circleId: string, consolidated = false) {
    const response = await this.client.get(`/circles/${circleId}/balance`, {
      params: { consolidated },
    });
    return response.data;
  }

  // ============ Category API ============
  // Backend gets circleId from JWT, not from URL

  async getCategories(_circleId?: string) {
    const response = await this.client.get('/categories');
    return response.data;
  }

  async createCategory(_circleId: string, data: { name: string; icon?: string }) {
    const response = await this.client.post('/categories', data);
    return response.data;
  }

  async deleteCategory(categoryId: string) {
    const response = await this.client.delete(`/categories/${categoryId}`);
    return response.data;
  }

  // ============ Card API ============

  async getCards() {
    const response = await this.client.get('/cards');
    return response.data;
  }

  async createCard(data: { bank_name: string; card_type: string; last_4_digits: string }) {
    const response = await this.client.post('/cards', data);
    return response.data;
  }

  // ============ Statement API ============

  async uploadStatement(cardId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post(`/cards/${cardId}/statements`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async confirmStatement(previewId: string, data?: { items?: unknown[] }) {
    const response = await this.client.post(`/statements/${previewId}/confirm`, data);
    return response.data;
  }

  // ============ Anomaly API ============

  async getIrregularExpenses(params?: Record<string, unknown>) {
    const response = await this.client.get('/expenses/irregular', { params });
    const data = response.data as { data?: unknown[]; total?: number; total_pages?: number };
    if (data && Array.isArray(data.data)) {
      data.data = data.data.map((item) => {
        const flat = this.flattenTransaction(item as Record<string, unknown>);
        if (!flat.available_actions) flat.available_actions = [];
        return flat;
      });
    }
    return data as any;
  }

  async associateExpense(expenseId: string, statementItemId: string) {
    const response = await this.client.post(`/expenses/${expenseId}/associate`, {
      statement_item_id: statementItemId,
    });
    return response.data;
  }

  async discardExpense(expenseId: string) {
    const response = await this.client.post(`/expenses/${expenseId}/discard`);
    return response.data;
  }

  // ============ Exchange Rate API ============

  async getExchangeRates() {
    const response = await this.client.get('/exchange-rates');
    return response.data;
  }
}

export const apiClient = new ApiClient();