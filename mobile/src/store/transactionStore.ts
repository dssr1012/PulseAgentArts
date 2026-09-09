// ============================================================
// PulseExpends - Transaction Store (Zustand)
// Manages transaction state, categories, and balance
// ============================================================

import { create } from 'zustand';
import type { Transaction, Category, BalanceResponse, Currency } from '../types';
import * as expensesApi from '../api/expenses';
import * as circlesApi from '../api/circles';

interface TransactionStoreState {
  // Data
  transactions: Transaction[];
  categories: Category[];
  balance: BalanceResponse | null;
  pendingExpenses: Transaction[];

  // Pagination
  currentPage: number;
  hasMore: boolean;
  isLoadingTransactions: boolean;
  isLoadingBalance: boolean;
  isRefreshing: boolean;

  // Actions
  loadTransactions: (circleId?: string, reset?: boolean) => Promise<void>;
  loadMoreTransactions: (circleId?: string) => Promise<void>;
  refreshTransactions: (circleId?: string) => Promise<void>;
  loadCategories: (circleId: string) => Promise<void>;
  loadBalance: (circleId: string) => Promise<void>;
  loadPendingExpenses: () => Promise<void>;
  addExpense: (data: expensesApi.CreateExpenseRequest) => Promise<Transaction>;
  confirmPendingExpense: (expenseId: string) => Promise<void>;
  discardPendingExpense: (expenseId: string) => Promise<void>;
  reset: () => void;
}

export const useTransactionStore = create<TransactionStoreState>((set, get) => ({
  transactions: [],
  categories: [],
  balance: null,
  pendingExpenses: [],
  currentPage: 1,
  hasMore: true,
  isLoadingTransactions: false,
  isLoadingBalance: false,
  isRefreshing: false,

  loadTransactions: async (circleId?: string, reset?: boolean) => {
    const state = get();
    if (state.isLoadingTransactions) return;

    set({ isLoadingTransactions: true });
    try {
      const page = reset ? 1 : state.currentPage;
      const response = await expensesApi.listExpenses({
        page,
        limit: 20,
      });

      set({
        transactions: reset ? response.data : [...state.transactions, ...response.data],
        currentPage: page + 1,
        hasMore: response.has_more,
        isLoadingTransactions: false,
      });
    } catch {
      set({ isLoadingTransactions: false });
    }
  },

  loadMoreTransactions: async (circleId?: string) => {
    const state = get();
    if (!state.hasMore || state.isLoadingTransactions) return;
    await state.loadTransactions(circleId, false);
  },

  refreshTransactions: async (circleId?: string) => {
    set({ isRefreshing: true });
    try {
      const response = await expensesApi.listExpenses({ page: 1, limit: 20 });
      set({
        transactions: response.data,
        currentPage: 2,
        hasMore: response.has_more,
        isRefreshing: false,
      });
    } catch {
      set({ isRefreshing: false });
    }
  },

  loadCategories: async (circleId: string) => {
    try {
      const categories = await circlesApi.listCategories(circleId);
      set({ categories });
    } catch {
      // Categories will remain empty
    }
  },

  loadBalance: async (circleId: string) => {
    set({ isLoadingBalance: true });
    try {
      const balance = await expensesApi.getBalance(circleId, true);
      set({ balance, isLoadingBalance: false });
    } catch {
      set({ isLoadingBalance: false });
    }
  },

  loadPendingExpenses: async () => {
    try {
      const pendingExpenses = await expensesApi.listPendingExpenses();
      set({ pendingExpenses });
    } catch {
      // Pending expenses will remain empty
    }
  },

  addExpense: async (data: expensesApi.CreateExpenseRequest) => {
    const transaction = await expensesApi.createExpense(data);
    // Add to local state
    set((state) => ({
      transactions: [transaction, ...state.transactions],
    }));
    return transaction;
  },

  confirmPendingExpense: async (expenseId: string) => {
    await expensesApi.confirmExpense(expenseId);
    set((state) => ({
      pendingExpenses: state.pendingExpenses.filter((e) => e.id !== expenseId),
    }));
  },

  discardPendingExpense: async (expenseId: string) => {
    await expensesApi.discardExpense(expenseId);
    set((state) => ({
      pendingExpenses: state.pendingExpenses.filter((e) => e.id !== expenseId),
    }));
  },

  reset: () => {
    set({
      transactions: [],
      categories: [],
      balance: null,
      pendingExpenses: [],
      currentPage: 1,
      hasMore: true,
    });
  },
}));