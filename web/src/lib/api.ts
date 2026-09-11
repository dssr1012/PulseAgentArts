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
    // Request interceptor: inject JWT Bearer token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Add correlation ID
        config.headers['X-Correlation-ID'] = this.generateCorrelationId();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: handle 401 with token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
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
        this.setAccessToken(response.data.accessToken);
        return response.data.accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private normalizeError(error: AxiosError<ApiError>): ApiError {
    if (error.response?.data) {
      return error.response.data;
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
    return response.data;
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

  async getExpenses(params?: Record<string, unknown>) {
    const response = await this.client.get('/expenses', { params });
    return response.data;
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

  async getCategories(circleId: string) {
    const response = await this.client.get(`/circles/${circleId}/categories`);
    return response.data;
  }

  async createCategory(circleId: string, data: { name: string; icon?: string }) {
    const response = await this.client.post(`/circles/${circleId}/categories`, data);
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
    return response.data;
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