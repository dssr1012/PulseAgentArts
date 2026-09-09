// ============================================================
// PulseExpends - Main Tab Navigator
// Dashboard, Add (Quick Entry), Transactions, Cards, Profile
// ============================================================

import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { QuickEntryScreen } from '../screens/main/QuickEntryScreen';
import { TransactionListScreen } from '../screens/main/TransactionListScreen';
import { CardsScreen } from '../screens/main/CardsScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { Colors } from '../constants/colors';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    home: '🏠',
    plus: '➕',
    list: '📋',
    card: '💳',
    user: '👤',
  };
  return <Text style={{ fontSize: 20 }}>{icons[name] || '•'}</Text>;
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: () => <TabIcon name="home" />,
        }}
      />
      <Tab.Screen
        name="Add"
        component={QuickEntryScreen}
        options={{
          tabBarLabel: 'Agregar',
          tabBarIcon: () => <TabIcon name="plus" />,
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionListScreen}
        options={{
          tabBarLabel: 'Gastos',
          tabBarIcon: () => <TabIcon name="list" />,
        }}
      />
      <Tab.Screen
        name="Cards"
        component={CardsScreen}
        options={{
          tabBarLabel: 'Tarjetas',
          tabBarIcon: () => <TabIcon name="card" />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: () => <TabIcon name="user" />,
        }}
      />
    </Tab.Navigator>
  );
}
