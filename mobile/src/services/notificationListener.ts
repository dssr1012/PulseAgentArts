// ============================================================
// PulseExpends - Notification Listener Service (Bridge)
// Android NotificationListenerService native module bridge
// Per spec §5.8.1 and design §2.7.1
// ============================================================

import { NativeModules, NativeEventEmitter, Platform, Linking, Alert } from 'react-native';
import { useNotificationStore } from '../store/notificationStore';
import { parseNotification, getCachedDictionary } from './regexEngine';
import { isDuplicate, getHash } from './duplicateDetector';
import * as expensesApi from '../api/expenses';
import * as haptics from './hapticFeedback';
import type { ExtractionResult } from '../types';

const { PulseExpendsNotificationListener } = NativeModules;

// Event emitter for notification interception events
const notificationEmitter = new NativeEventEmitter(
  Platform.OS === 'android' ? PulseExpendsNotificationListener : undefined
);

/**
 * Check if notification listener permission is granted
 */
export async function isNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    return await PulseExpendsNotificationListener.isListenerActive();
  } catch {
    return false;
  }
}

/**
 * Request notification access permission
 * Opens Android notification access settings
 */
export function requestNotificationPermission(): void {
  if (Platform.OS !== 'android') return;

  Alert.alert(
    'Acceso a Notificaciones',
    'PulseExpends necesita acceso a tus notificaciones para detectar gastos automáticamente.\n\nSerás redirigido a la configuración de Android. Busca "PulseExpends" y actívalo.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Ir a Configuración',
        onPress: () => {
          // Open notification listener settings
          Linking.openURL('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS');
        },
      },
    ]
  );
}

/**
 * Start the notification listener service
 */
export async function startListener(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const isActive = await isNotificationPermissionGranted();
    if (isActive) {
      await PulseExpendsNotificationListener.startListening();
      useNotificationStore.getState().setListenerActive(true);
      useNotificationStore.getState().setPermissionGranted(true);
    } else {
      useNotificationStore.getState().setListenerActive(false);
      useNotificationStore.getState().setPermissionGranted(false);
    }
  } catch {
    useNotificationStore.getState().setListenerActive(false);
  }
}

/**
 * Stop the notification listener service
 */
export async function stopListener(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await PulseExpendsNotificationListener.stopListening();
    useNotificationStore.getState().setListenerActive(false);
  } catch {
    // Ignore errors on stop
  }
}

/**
 * Handle intercepted notification
 * This is the main processing pipeline:
 * 1. Check if app is whitelisted
 * 2. Check for duplicates
 * 3. Apply regex patterns (edge parsing)
 * 4. Dispatch based on mode (Mode 1 or Mode 2)
 */
async function handleInterceptedNotification(event: {
  packageName: string;
  notificationText: string;
}): Promise<void> {
  const { packageName, notificationText } = event;
  const store = useNotificationStore.getState();
  const { config } = store;

  // 1. Check if app is whitelisted
  const app = config.whitelisted_apps.find(
    (a) => a.package_name === packageName && a.enabled
  );
  if (!app) return; // App not whitelisted or disabled - ignore

  // 2. Check for duplicates
  const dup = await isDuplicate(packageName, notificationText);
  if (dup) return; // Duplicate - silently discard

  // 3. Apply regex patterns (edge parsing - on device only)
  const dictionary = await getCachedDictionary();
  if (!dictionary) return; // No dictionary available

  const result = parseNotification(notificationText, app.display_name, dictionary.patterns);
  if (!result) return; // No pattern matched - silently discard

  // Set the hash for the extraction result
  result.raw_hash = await getHash(packageName, notificationText);

  // Update last extraction result in store
  store.setLastExtraction(result);

  // 4. Dispatch based on mode
  if (config.mode === 'quick_confirmation') {
    await dispatchMode1(result);
  } else {
    await dispatchMode2(result);
  }
}

/**
 * Mode 1: Quick Confirmation
 * Show local push notification with Confirm/Edit action buttons
 * Per spec §5.8.1 rule 4
 */
async function dispatchMode1(result: ExtractionResult): Promise<void> {
  haptics.lightImpact();

  // Show local notification with action buttons
  // This is handled by the push notification service
  const { showExpenseConfirmationNotification } = await import('./pushNotifications');
  await showExpenseConfirmationNotification({
    amount: result.amount ?? 0,
    merchant: result.merchant ?? 'Comercio desconocido',
    currency: result.currency ?? 'ARS',
    appName: result.app_name,
    extractionResult: result,
  });
}

/**
 * Mode 2: Silent Auto-Registration
 * POST expense to API in background with pending_confirmation status
 * Per spec §5.8.1 rule 5
 */
async function dispatchMode2(result: ExtractionResult): Promise<void> {
  try {
    // Find a default category or use first available
    const { useTransactionStore } = await import('../store/transactionStore');
    const categories = useTransactionStore.getState().categories;
    const defaultCategory = categories.find((c) => c.is_default) || categories[0];

    if (!defaultCategory) return; // No categories available

    await expensesApi.createExpense({
      amount: result.amount ?? 0,
      currency: result.currency ?? 'ARS',
      category_id: defaultCategory.id,
      merchant_name: result.merchant,
      transaction_date: new Date().toISOString().split('T')[0],
      source: 'notification_capture',
      confirmation_status: 'pending_confirmation',
    });

    haptics.lightImpact();

    // Refresh pending list
    await useTransactionStore.getState().loadPendingExpenses();
  } catch {
    // Silently fail - expense will not be created
    // User can add manually if needed
  }
}

/**
 * Subscribe to notification interception events
 * Call this on app startup after authentication
 */
export function subscribeToNotifications(): () => void {
  if (Platform.OS !== 'android') return () => {};

  const subscription = notificationEmitter.addListener(
    'onNotificationIntercepted',
    handleInterceptedNotification
  );

  return () => subscription.remove();
}

/**
 * Initialize the notification listener on app startup
 */
export async function initializeNotificationListener(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Load config
  await useNotificationStore.getState().loadConfig();

  // Check permission
  const isGranted = await isNotificationPermissionGranted();
  await useNotificationStore.getState().setPermissionGranted(isGranted);

  // Start listener if permission granted
  if (isGranted) {
    await startListener();
  }

  // Subscribe to events
  subscribeToNotifications();
}