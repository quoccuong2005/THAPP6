// src/navigation/AppNavigator.js
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';

import { useApp } from '../context/AppContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ContactsScreen from '../screens/ContactsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabBarIcon({ routeName, focused, color }) {
  let iconName;
  if (routeName === 'Home') {
    iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
  } else if (routeName === 'Contacts') {
    iconName = focused ? 'people' : 'people-outline';
  } else if (routeName === 'Notifications') {
    iconName = focused ? 'notifications' : 'notifications-outline';
  } else if (routeName === 'Settings') {
    iconName = focused ? 'settings' : 'settings-outline';
  }
  return <Ionicons name={iconName} size={22} color={color} />;
}

const getScreenOptions = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor: '#4F46E5',
  tabBarInactiveTintColor: '#9CA3AF',
  tabBarStyle: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E7EB',
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabBarIcon: ({ focused, color }) => (
    <TabBarIcon routeName={route.name} focused={focused} color={color} />
  ),
});

// Bottom Tabs Navigator (Home, Danh bạ, Thông báo, Cài đặt)
function MainTabNavigator() {
  const { totalUnreadMessages, totalUnreadNotifications } = useApp();

  return (
    <Tab.Navigator screenOptions={getScreenOptions}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Đoạn chat',
          tabBarBadge: totalUnreadMessages > 0 ? (totalUnreadMessages > 99 ? '99+' : totalUnreadMessages) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#4F46E5',
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarLabel: 'Danh bạ',
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Thông báo',
          tabBarBadge: totalUnreadNotifications > 0 ? totalUnreadNotifications : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Cài đặt',
        }}
      />
    </Tab.Navigator>
  );
}

// Root Stack Navigator
export default function AppNavigator() {
  const { user, authLoading, syncError } = useApp();
  if (authLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text>Đang khôi phục đăng nhập…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {user && syncError ? <Text accessibilityRole="alert" style={styles.error}>{syncError}</Text> : null}
      <NavigationContainer>
        <Stack.Navigator
          key={user ? user.id : 'guest'}
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          {user ? (
            <>
              <Stack.Screen name="Main" component={MainTabNavigator} />
              <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
              <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  error: { color: '#B91C1C', backgroundColor: '#FEF2F2', padding: 12 },
});
