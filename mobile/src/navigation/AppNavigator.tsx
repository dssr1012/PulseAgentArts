// ============================================================
// PulseExpends - App Navigator
// Conditional rendering: auth stack when unauthenticated,
// main tabs when authenticated
// ============================================================

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { QuickEntryScreen } from '../screens/main/QuickEntryScreen';
import { TransactionDetailScreen } from '../screens/main/TransactionDetailScreen';
import { NotificationSettingsScreen } from '../screens/notifications/NotificationSettingsScreen';
import { PendingListScreen } from '../screens/notifications/PendingListScreen';
import { StatementUploadScreen } from '../screens/cards/StatementUploadScreen';
import { StatementPreviewScreen } from '../screens/cards/StatementPreviewScreen';
import { CircleScreen } from '../screens/circle/CircleScreen';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { initializePushNotifications } from '../services/pushNotifications';
import { initializeNotificationListener } from '../services/notificationListener';
import { updateRegexDictionary } from '../services/regexEngine';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // Initialize services when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const init = async () => {
        // Download latest regex dictionary
        await updateRegexDictionary();

        // Initialize push notifications
        await initializePushNotifications();

        // Initialize notification listener (Android only)
        await initializeNotificationListener();
      };
      init();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Cargando..." />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <RootStack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <RootStack.Screen name="MainTabs" component={MainTabs} />
          <RootStack.Screen
            name="QuickEntry"
            component={QuickEntryScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Agregar Gasto',
            }}
          />
          <RootStack.Screen
            name="TransactionDetail"
            component={TransactionDetailScreen}
            options={{
              headerShown: true,
              headerTitle: 'Detalle del Gasto',
            }}
          />
          <RootStack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{
              headerShown: true,
              headerTitle: 'Notificaciones',
            }}
          />
          <RootStack.Screen
            name="PendingList"
            component={PendingListScreen}
            options={{
              headerShown: true,
              headerTitle: 'Gastos por Confirmar',
            }}
          />
          <RootStack.Screen
            name="StatementUpload"
            component={StatementUploadScreen}
            options={{
              headerShown: true,
              headerTitle: 'Subir Resumen',
            }}
          />
          <RootStack.Screen
            name="StatementPreview"
            component={StatementPreviewScreen}
            options={{
              headerShown: true,
              headerTitle: 'Vista Previa',
            }}
          />
          <RootStack.Screen
            name="Circle"
            component={CircleScreen}
            options={{
              headerShown: true,
              headerTitle: 'Círculo Familiar',
            }}
          />
        </RootStack.Navigator>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}