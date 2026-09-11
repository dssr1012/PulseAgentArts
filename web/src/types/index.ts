// PulseExpends - Core Type Definitions

// ============ Enums ============

export type Currency = 'ARS' | 'USD' | 'EUR';

export type AuthProvider = 'traditional' | 'google_sso' | 'hybrid';

export type TransactionType = 'expense' | 'income';

export type TransactionSource = 'manual' | 'statement' | 'notification_capture' | 'mcp';

export type ConfirmationStatus = 'confirmed' | 'pending_confirmation';

export type CardType = 'Visa' | 'Mastercard';

export type CircleRole = 'admin' | 'member';

export type InvitationStatus = 'pending' | 'sent' | 'accepted' | 'expired' | 'delivery_failed';

export type AnomalySeverity = 'alert' | 'critical';

export type AnomalyType = 'amount_discrepancy' | 'orphaned_duplicate';

export type AnomalyResolution = 'associated' | 'edited' | 'discarded';

export type AnomalyAction = 'associate' | 'edit' | 'discard';

export type AnomalyStatus = 'open' | 'resolved';

// ============ Auth Types ============

export interface User {
  id: string;
  email: string;
  given_name: string;
  picture_url: string | null;
  auth_provider: AuthProvider;
  circle_id: string | null;
  circle_role: CircleRole | null;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  given_name: string;
}

// ============ Circle Types ============

export interface FamilyCircle {
  id: string;
  name: string;
  admin_user_id: string;
  base_currency: Currency;
  created_at: string;
}

export interface CircleMember {
  user_id: string;
  given_name: string;
  email: string;
  picture_url: string | null;
  role: CircleRole;
  joined_at: string;
}

export interface CircleDetail {
  circle: FamilyCircle;
  members: CircleMember[];
}

export interface CreateCircleRequest {
  name: string;
  base_currency: Currency;
}

// ============ Invitation Types ============

export interface Invitation {
  id: string;
  group_id: string;
  email: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface CreateInvitationRequest {
  email: string;
}

export interface InvitationValidation {
  valid: boolean;
  circle_name: string;
  inviter_name: string;
  expires_at: string;
}

// ============ Category Types ============

export interface Category {
  id: string;
  group_id: string;
  name: string;
  icon: string | null;
  is_default: boolean;
  created_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  icon?: string;
}

// ============ Transaction Types ============

export interface Transaction {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  category_id: string;
  category_name: string;
  description: string | null;
  merchant_name: string | null;
  is_private: boolean;
  hidden_until: string | null;
  source: TransactionSource;
  confirmation_status: ConfirmationStatus;
  transaction_date: string;
  created_at: string;
}

export interface CreateExpenseRequest {
  amount: number;
  currency: Currency;
  category_id: string;
  description?: string;
  merchant_name?: string;
  transaction_date: string;
  is_private?: boolean;
  hidden_until?: string;
  source?: TransactionSource;
  confirmation_status?: ConfirmationStatus;
}

export interface CreateIncomeRequest {
  amount: number;
  currency: Currency;
  category_id?: string;
  description?: string;
  income_date: string;
}

export interface TransactionQuery {
  page?: number;
  limit?: number;
  currency?: Currency;
  category_id?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  type?: TransactionType;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ============ Balance Types ============

export interface BalanceResponse {
  total_income: number;
  total_expenses: number;
  net_balance: number;
  base_currency: Currency;
  breakdown_by_currency: Record<string, { income: number; expenses: number }>;
  breakdown_by_category: Record<string, number>;
  consolidated_total?: number;
  rates_stale?: boolean;
  last_rate_fetch?: string;
}

// ============ Card Types ============

export interface CreditCard {
  id: string;
  group_id: string;
  bank_name: string;
  card_type: CardType;
  last_four_digits: string;
  created_at: string;
}

export interface CreateCardRequest {
  bank_name: string;
  card_type: CardType;
  last_4_digits: string;
}

// ============ Statement Types ============

export interface StatementItem {
  date: string;
  description: string;
  amount: number;
  currency: Currency;
}

export interface StatementPreview {
  preview_id: string;
  closing_date: string;
  due_date: string;
  total_amount: number;
  min_payment: number;
  currency: Currency;
  items: StatementItem[];
}

export interface ConfirmStatementRequest {
  items?: StatementItem[];
}

// ============ Anomaly Types ============

export interface AnomalyAlert {
  id: string;
  expense_id: string;
  expense: Transaction;
  severity: AnomalySeverity;
  reason: AnomalyType;
  matched_statement_item_id: string | null;
  available_actions: AnomalyAction[];
  created_at: string;
}

export interface AssociateRequest {
  statement_item_id: string;
}

// ============ Exchange Rate Types ============

export interface ExchangeRateResponse {
  rates: Record<string, Record<string, number>>;
  fetched_at: string;
  is_stale: boolean;
}

// ============ API Error Types ============

export type ErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'AUTH_SSO_TOKEN_INVALID'
  | 'AUTH_EMAIL_EXISTS'
  | 'AUTH_INVALID_INPUT'
  | 'AUTH_REFRESH_INVALID'
  | 'CIRCLE_ALREADY_MEMBER'
  | 'CIRCLE_NOT_FOUND'
  | 'CIRCLE_PERMISSION_DENIED'
  | 'INVITE_EXPIRED'
  | 'INVITE_CONSUMED'
  | 'INVITE_ALREADY_MEMBER'
  | 'TX_CURRENCY_REQUIRED'
  | 'TX_INVALID_CURRENCY'
  | 'TX_NOT_FOUND'
  | 'TX_PERMISSION_DENIED'
  | 'TX_VALIDATION_FAILED'
  | 'CATEGORY_DUPLICATE'
  | 'CATEGORY_IS_DEFAULT'
  | 'CATEGORY_IN_USE'
  | 'CARD_SENSITIVE_DATA_REJECTED'
  | 'STMT_UNSUPPORTED_FORMAT'
  | 'STMT_FILE_TOO_LARGE'
  | 'STMT_PARSE_FAILED'
  | 'STMT_PREVIEW_NOT_FOUND'
  | 'STMT_ALREADY_CONFIRMED'
  | 'PRIVACY_INVALID_DATE';

export interface ApiError {
  code: ErrorCode;
  message: string;
  trace_id: string;
  status: number;
}

// ============ UI State Types ============

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface ModalState {
  isOpen: boolean;
  type: 'add-expense' | 'add-income' | 'add-card' | 'add-category' | 'edit-transaction' | 'confirm-statement' | null;
  data?: unknown;
}