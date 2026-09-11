// ============================================================
// PulseExpends - Push Notifications Service
// FCM integration and local notification management
// Per design §2.5.4
// ============================================================

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { ASYNC_STORAGE_KEYS, CARD_DUE_REMINDER_DAYS_BEFORE } from '../constants/config';
import * as regexApi from '../api/regexDictionary';
import * as expensesApi from '../api/expenses';
import * as haptics from './hapticFeedback';
import type { ExtractionResult, CreditCard } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Configure notification handler
// ============================================================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and get device token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Uses default from app.json
    });

    // Store token locally
    await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.DEVICE_TOKEN, token.data);

    // Register with backend
    try {
      await regexApi.registerDeviceToken(token.data);
    } catch {
      // Non-critical - will retry on next launch
    }

    return token.data;
  } catch {
    return null;
  }
}

/**
 * Unregister device token on logout
 */
export async function unregisterForPushNotifications(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.DEVICE_TOKEN);
    if (token) {
      await regexApi.unregisterDeviceToken(token);
      await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.DEVICE_TOKEN);
    }
  } catch {
    // Ignore errors on unregister
  }
}

/**
 * Show local notification for expense confirmation (Mode 1)
 * Per spec §5.8.1 rule 4
 */
export async function showExpenseConfirmationNotification(data: {
  amount: number;
  merchant: string;
  currency: string;
  appName: string;
  extractionResult: ExtractionResult;
}): Promise<void> {
  const currencySymbol = data.currency === 'ARS' ? '$' : data.currency === 'USD' ? 'US$' : '€';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Gasto Detectado',
      body: `${currencySymbol}${data.amount.toFixed(2)} en ${data.merchant} (${data.appName})`,
      data: {
        type: 'expense_confirmation',
        extractionResult: data.extractionResult,
      },
      categoryIdentifier: 'EXPENSE_CONFIRMATION',
    },
    trigger: null, // Show immediately
  });
}

/**
 * Set up notification response listener
 * Handles user taps on notifications and action buttons
 */
export function setupNotificationResponseListener(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      const { notification } = response;
      const { data } = notification.request.content;

      if (data?.type === 'expense_confirmation') {
        const extractionResult = data.extractionResult as ExtractionResult;
        const actionIdentifier = response.actionIdentifier;

        if (actionIdentifier === 'CONFIRM_EXPENSE') {
          // Confirm: POST to backend
          await confirmExpenseFromNotification(extractionResult);
        } else if (actionIdentifier === 'EDIT_EXPENSE') {
          // Edit: Navigate to pre-filled expense form
          // This will be handled by the navigation ref
          // For now, we store the result for the form to pick up
          await AsyncStorage.setItem(
            'pulse_expends_edit_extraction',
            JSON.stringify(extractionResult)
          );
        }
        // Default tap also opens edit form
      } else if (data?.type === 'card_due_reminder') {
        // Navigate to cards screen
        // Handled by navigation
      }
    }
  );

  return () => subscription.remove();
}

/**
 * Set up notification categories with action buttons
 */
export async function setupNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync('EXPENSE_CONFIRMATION', [
    {
      identifier: 'CONFIRM_EXPENSE',
      buttonTitle: 'Confirmar Gasto',
      options: {
        isDestructive: false,
        isAuthenticationRequired: false,
      },
    },
    {
      identifier: 'EDIT_EXPENSE',
      buttonTitle: 'Editar/Descartar',
      options: {
        isDestructive: true,
        isAuthenticationRequired: false,
      },
    },
  ]);
}

/**
 * Confirm expense from notification action
 */
async function confirmExpenseFromNotification(result: ExtractionResult): Promise<void> {
  try {
    const { useTransactionStore } = await import('../store/transactionStore');
    const categories = useTransactionStore.getState().categories;
    const defaultCategory = categories.find((c) => c.is_default) || categories[0];

    if (!defaultCategory) return;

    await expensesApi.createExpense({
      amount: result.amount ?? 0,
      currency: result.currency ?? 'ARS',
      category_id: defaultCategory.id,
      merchant_name: result.merchant,
      transaction_date: new Date().toISOString().split('T')[0],
      source: 'notification_capture',
      confirmation_status: 'confirmed',
    });

    haptics.successNotification();

    // Dismiss the notification
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    haptics.errorNotification();
  }
}

/**
 * Schedule card due date reminders
 * Notifies 3 days before due date and on due date
 */
export async function scheduleCardDueReminders(cards: CreditCard[]): Promise<void> {
  // Cancel all existing card reminders
  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const card of cards) {
    if (!card.due_date) continue;

    const dueDate = new Date(card.due_date);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - CARD_DUE_REMINDER_DAYS_BEFORE);

    const now = new Date();

    // Schedule 3-day reminder if in the future
    if (reminderDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Recordatorio de Pago',
          body: `Tu tarjeta ${card.bank_name} ****${card.last_four_digits} vence en ${CARD_DUE_REMINDER_DAYS_BEFORE} días`,
          data: {
            type: 'card_due_reminder',
            cardId: card.id,
            daysBefore: CARD_DUE_REMINDER_DAYS_BEFORE,
          },
        },
        trigger: {
          type: 'date',
          date: reminderDate,
        } as any,
      });
    }

    // Schedule due date reminder if in the future
    if (dueDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Vencimiento Hoy',
          body: `Tu tarjeta ${card.bank_name} ****${card.last_four_digits} vence hoy`,
          data: {
            type: 'card_due_reminder',
            cardId: card.id,
            daysBefore: 0,
          },
        },
        trigger: {
          type: 'date',
          date: dueDate,
        } as any,
      });
    }
  }
}

/**
 * Initialize push notification system
 */
export async function initializePushNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('expense-confirmations', {
      name: 'Confirmaciones de Gasto',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });

    await Notifications.setNotificationChannelAsync('card-reminders', {
      name: 'Recordatorios de Tarjetas',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F59E0B',
    });
  }

  await setupNotificationCategories();
  await registerForPushNotifications();
  setupNotificationResponseListener();
}