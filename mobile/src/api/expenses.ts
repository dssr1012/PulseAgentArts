// ============================================================
// PulseExpends - Expenses API
// ============================================================

import apiClient from './client';
import type {
  Transaction,
  Currency,
  BalanceResponse,
  PaginatedResponse,
  AnomalyAlert,
} from '../types';

export interface CreateExpenseRequest {
  amount: number;
  currency: Currency;
  category_id: string;
  description?: string;
  merchant_name?: string;
  transaction_date: string;
  is_private?: boolean;
  hidden_until?: string;
  source?: 'manual' | 'notification_capture' | 'mcp';
  confirmation_status?: 'confirmed' | 'pending_confirmation';
}

export interface CreateIncomeRequest {
  amount: number;
  currency: Currency;
  category_id?: string;
  description?: string;
  income_date: string;
}

export interface ExpenseQueryParams {
  page?: number;
  limit?: number;
  currency?: Currency;
  category_id?: string;
  from_date?: string;
  to_date?: string;
}

/**
 * Create a new expense
 */
export async function createExpense(data: CreateExpenseRequest): Promise<Transaction> {
  const response = await apiClient.post<Transaction>('/expenses', data);
  return response.data;
}

/**
 * List expenses with pagination and filters
 */
export async function listExpenses(
  params?: ExpenseQueryParams
): Promise<PaginatedResponse<Transaction>> {
  const response = await apiClient.get<PaginatedResponse<Transaction>>('/expenses', {
    params,
  });
  return response.data;
}

/**
 * Get a single expense by ID
 */
export async function getExpense(expenseId: string): Promise<Transaction> {
  const response = await apiClient.get<Transaction>(`/expenses/${expenseId}`);
  return response.data;
}

/**
 * Update an expense
 */
export async function updateExpense(
  expenseId: string,
  data: Partial<CreateExpenseRequest>
): Promise<Transaction> {
  const response = await apiClient.patch<Transaction>(`/expenses/${expenseId}`, data);
  return response.data;
}

/**
 * Delete an expense
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  await apiClient.delete(`/expenses/${expenseId}`);
}

/**
 * Confirm a pending expense
 */
export async function confirmExpense(expenseId: string): Promise<Transaction> {
  const response = await apiClient.post<Transaction>(`/expenses/${expenseId}/confirm`);
  return response.data;
}

/**
 * Discard a pending expense
 */
export async function discardExpense(expenseId: string): Promise<void> {
  await apiClient.post(`/expenses/${expenseId}/discard`);
}

/**
 * List pending confirmation expenses
 */
export async function listPendingExpenses(): Promise<Transaction[]> {
  const response = await apiClient.get<Transaction[]>('/expenses/pending');
  return response.data;
}

/**
 * Create an income record
 */
export async function createIncome(data: CreateIncomeRequest): Promise<Transaction> {
  const response = await apiClient.post<Transaction>('/incomes', data);
  return response.data;
}

/**
 * Get balance summary for the user's circle
 */
export async function getBalance(circleId: string, consolidated = false): Promise<BalanceResponse> {
  const response = await apiClient.get<BalanceResponse>(`/circles/${circleId}/balance`, {
    params: { consolidated },
  });
  return response.data;
}

/**
 * List irregular expenses (anomaly alerts)
 */
export async function listIrregularExpenses(
  params?: { page?: number; limit?: number; severity?: 'alert' | 'critical' }
): Promise<PaginatedResponse<AnomalyAlert>> {
  const response = await apiClient.get<PaginatedResponse<AnomalyAlert>>(
    '/expenses/irregular',
    { params }
  );
  return response.data;
}

/**
 * Associate an irregular expense with a statement item
 */
export async function associateExpense(
  expenseId: string,
  statementItemId: string
): Promise<{ status: 'resolved' }> {
  const response = await apiClient.post<{ status: 'resolved' }>(
    `/expenses/${expenseId}/associate`,
    { statement_item_id: statementItemId }
  );
  return response.data;
}