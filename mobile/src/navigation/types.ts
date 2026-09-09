// ============================================================
// PulseExpends - Navigation Type Definitions
// ============================================================

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// ============================================================
// Auth Stack Param List
// ============================================================
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;

// ============================================================
// Main Tab Param List
// ============================================================
export type MainTabParamList = {
  Dashboard: undefined;
  Add: undefined;
  Transactions: undefined;
  Cards: undefined;
  Profile: undefined;
};

export type DashboardScreenProps = BottomTabScreenProps<MainTabParamList, 'Dashboard'>;
export type AddScreenProps = BottomTabScreenProps<MainTabParamList, 'Add'>;
export type TransactionsScreenProps = BottomTabScreenProps<MainTabParamList, 'Transactions'>;
export type CardsScreenProps = BottomTabScreenProps<MainTabParamList, 'Cards'>;
export type ProfileScreenProps = BottomTabScreenProps<MainTabParamList, 'Profile'>;

// ============================================================
// Root Stack Param List (includes tabs and modal screens)
// ============================================================
export type RootStackParamList = {
  AuthStack: undefined;
  MainTabs: undefined;
  QuickEntry: undefined;
  TransactionDetail: { transactionId: string };
  NotificationSettings: undefined;
  PendingList: undefined;
  StatementUpload: { cardId: string };
  StatementPreview: { previewId: string; cardId: string };
  Circle: undefined;
};

export type TransactionDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'TransactionDetail'
>;
export type QuickEntryScreenProps = NativeStackScreenProps<RootStackParamList, 'QuickEntry'>;
export type NotificationSettingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'NotificationSettings'
>;
export type PendingListScreenProps = NativeStackScreenProps<RootStackParamList, 'PendingList'>;
export type StatementUploadScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'StatementUpload'
>;
export type StatementPreviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'StatementPreview'
>;