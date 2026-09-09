package com.pulseexpends;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

/**
 * React Native Native Module for Notification Listener Service
 * 
 * Provides bridge methods to:
 * - Check if notification access permission is granted
 * - Start/stop the notification listener service
 * - Query listener active state
 */
public class NotificationListenerModule extends ReactContextBaseJavaModule {

    private static final String TAG = "NotificationListener";
    private static ReactApplicationContext reactContext;

    public NotificationListenerModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "PulseExpendsNotificationListener";
    }

    public static ReactApplicationContext getReactContext() {
        return reactContext;
    }

    /**
     * Check if notification listener permission is granted
     */
    @ReactMethod
    public void isListenerActive(Promise promise) {
        try {
            boolean isActive = isNotificationAccessEnabled();
            promise.resolve(isActive);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to check listener status: " + e.getMessage());
        }
    }

    /**
     * Start listening for notifications
     */
    @ReactMethod
    public void startListening(Promise promise) {
        try {
            if (!isNotificationAccessEnabled()) {
                promise.reject("NO_PERMISSION", "Notification access permission not granted");
                return;
            }

            // The service auto-starts when permission is granted
            // We just verify it's running
            boolean isActive = PulseExpendsNotificationListenerService.isListenerActive();
            promise.resolve(isActive);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to start listening: " + e.getMessage());
        }
    }

    /**
     * Stop listening for notifications
     */
    @ReactMethod
    public void stopListening(Promise promise) {
        try {
            // Request system to disable the listener
            ComponentName cn = new ComponentName(
                getReactApplicationContext(),
                PulseExpendsNotificationListenerService.class
            );
            // Note: Cannot programmatically disable NotificationListenerService
            // User must do it from system settings
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to stop listening: " + e.getMessage());
        }
    }

    /**
     * Open notification access settings
     */
    @ReactMethod
    public void openNotificationSettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to open settings: " + e.getMessage());
        }
    }

    /**
     * Check if notification access is enabled for this app
     */
    private boolean isNotificationAccessEnabled() {
        try {
            ComponentName cn = new ComponentName(
                getReactApplicationContext(),
                PulseExpendsNotificationListenerService.class
            );
            String flat = Settings.Secure.getString(
                getReactApplicationContext().getContentResolver(),
                "enabled_notification_listeners"
            );
            return !TextUtils.isEmpty(flat) && flat.contains(cn.flattenToString());
        } catch (Exception e) {
            Log.e(TAG, "Error checking notification access", e);
            return false;
        }
    }
}