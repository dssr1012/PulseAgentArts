// ============================================================
// PulseExpends Mobile - Type Definitions
// ============================================================

export type Currency = 'ARS' | 'USD' | 'EUR';

export type AuthProvider = 'traditional' | 'google_sso' | 'hybrid';

export type TransactionType = 'expense' | 'income';

export type TransactionSource = 'manual' | 'statement' | 'notification_capture' | 'mcp';

export type ConfirmationStatus = 'confirmed' | 'pending_confirmation';

export type CircleRole = 'admin' | 'member';

export type CardType = 'Visa' | 'Mastercard';

export type AlertSeverity = 'alert' | 'critical';

export type AlertType = 'amount_discrepancy' | 'orphaned_duplicate';

export type AlertStatus = 'open' | 'resolved';

export type ResolutionAction = 'associated' | 'edited' | 'discarded';

export type InvitationStatus = 'pending' | 'sent' | 'accepted' | 'expired' | 'delivery_failed';

export type NotificationMode = 'quick_confirmation' | 'silent_auto_registration';

export interface User {
  id: string;
  email: string;
  given_name: string;
  picture_url?: string;
  auth_provider: AuthProvider;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  circleId: string | null;
  circleRole: CircleRole | null;
}

export interface FamilyGroup {
  id: string;
  name: string;
  admin_user_id: string;
  base_currency: Currency;
  created_at: string;
}

export interface FamilyGroupMember {
  group_id: string;
  user_id: string;
  role: CircleRole;
  joined_at: string;
  user?: User;
}

export interface Invitation {
  id: string;
  group_id: string;
  email: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface Category {
  id: string;
  group_id: string;
  name: string;
  icon?: string;
  is_default: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  group_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  category_id: string;
  category?: Category;
  description?: string;
  merchant_name?: string;
  is_private: boolean;
  hidden_until?: string;
  source: TransactionSource;
  confirmation_status: ConfirmationStatus;
  transaction_date: string;
  created_at: string;
  user?: User;
  is_obfuscated?: boolean;
}

export interface CreditCard {
  id: string;
  group_id: string;
  bank_name: string;
  card_type: CardType;
  last_four_digits: string;
  due_date?: string;
  created_at: string;
}

export interface CardStatement {
  id: string;
  card_id: string;
  close_date: string;
  due_date: string;
  total_amount: number;
  min_payment: number;
  currency: Currency;
  is_confirmed: boolean;
  created_at: string;
}

export interface StatementItem {
  id: string;
  statement_id: string;
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

export interface AnomalyAlert {
  id: string;
  group_id: string;
  transaction_id?: string;
  transaction?: Transaction;
  statement_item_id?: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  resolution_action?: ResolutionAction;
  created_at: string;
}

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

export interface ExchangeRateResponse {
  rates: Record<string, Record<string, number>>;
  fetched_at: string;
  is_stale: boolean;
}

export interface RegexPattern {
  app_name: string;
  pattern: string;
  fields_extracted: string[];
}

export interface RegexDictionary {
  version: number;
  patterns: RegexPattern[];
}

export interface ExtractionResult {
  amount?: number;
  merchant?: string;
  currency?: Currency;
  payment_method?: string;
  app_name: string;
  raw_hash: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  trace_id?: string;
}

export interface WhitelistedApp {
  package_name: string;
  display_name: string;
  enabled: boolean;
}

export interface NotificationConfig {
  mode: NotificationMode;
  whitelisted_apps: WhitelistedApp[];
  is_permission_granted: boolean;
}