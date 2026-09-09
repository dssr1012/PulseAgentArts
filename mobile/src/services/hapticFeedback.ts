// ============================================================
// PulseExpends - Haptic Feedback Service
// ============================================================

import * as Haptics from 'expo-haptics';

/**
 * Trigger light impact feedback (e.g., button press)
 */
export function lightImpact(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Trigger medium impact feedback (e.g., successful action)
 */
export function mediumImpact(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * Trigger heavy impact feedback (e.g., important confirmation)
 */
export function heavyImpact(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/**
 * Trigger success notification feedback
 */
export function successNotification(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Trigger warning notification feedback
 */
export function warningNotification(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/**
 * Trigger error notification feedback
 */
export function errorNotification(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/**
 * Trigger selection feedback (e.g., picker change)
 */
export function selectionFeedback(): void {
  Haptics.selectionAsync();
}