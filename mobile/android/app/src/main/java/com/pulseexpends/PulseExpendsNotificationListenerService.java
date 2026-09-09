package com.pulseexpends;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * PulseExpends Notification Listener Service
 * 
 * Intercepts notifications from whitelisted financial apps
 * and forwards them to the React Native bridge for edge parsing.
 * 
 * Per spec §5.8.1 rule 6: Raw notification text is NEVER transmitted
 * to the server. All regex matching happens on-device.
 */
public class PulseExpendsNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "PulseExpendsNLS";
    private static PulseExpendsNotificationListenerService instance;

    public static PulseExpendsNotificationListenerService getInstance() {
        return instance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "NotificationListenerService created");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
        Log.d(TAG, "NotificationListenerService destroyed");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        
        // Extract notification text
        android.app.Notification notification = sbn.getNotification();
        if (notification == null) return;

        String notificationText = extractNotificationText(notification);
        if (notificationText == null || notificationText.isEmpty()) return;

        // Send event to React Native bridge
        WritableMap params = Arguments.createMap();
        params.putString("packageName", packageName);
        params.putString("notificationText", notificationText);
        params.putDouble("timestamp", System.currentTimeMillis());

        sendEvent("onNotificationIntercepted", params);
        Log.d(TAG, "Intercepted notification from: " + packageName);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Not used - we only care about new notifications
    }

    /**
     * Extract text content from a notification
     */
    private String extractNotificationText(android.app.Notification notification) {
        StringBuilder text = new StringBuilder();

        try {
            // Try to get text from Notification.BigTextStyle
            if (notification.extras != null) {
                CharSequence title = notification.extras.getCharSequence(
                    android.app.Notification.EXTRA_TITLE);
                CharSequence textContent = notification.extras.getCharSequence(
                    android.app.Notification.EXTRA_TEXT);
                CharSequence bigText = notification.extras.getCharSequence(
                    android.app.Notification.EXTRA_BIG_TEXT);

                if (title != null) {
                    text.append(title);
                }
                if (textContent != null) {
                    if (text.length() > 0) text.append(" ");
                    text.append(textContent);
                }
                if (bigText != null) {
                    if (text.length() > 0) text.append(" ");
                    text.append(bigText);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error extracting notification text", e);
        }

        return text.toString();
    }

    /**
     * Send event to React Native event emitter
     */
    private void sendEvent(String eventName, WritableMap params) {
        try {
            com.facebook.react.bridge.ReactApplicationContext reactContext = 
                NotificationListenerModule.getReactContext();
            
            if (reactContext != null) {
                reactContext.getJSModule(
                    DeviceEventManagerModule.RCTDeviceEventEmitter.class
                ).emit(eventName, params);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending event to React Native", e);
        }
    }

    /**
     * Check if the listener is currently active/connected
     */
    public static boolean isListenerActive() {
        return instance != null;
    }
}