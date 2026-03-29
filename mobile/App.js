import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import LoginScreen from './src/screens/LoginScreen';
import SwipeScreen from './src/screens/SwipeScreen';
import PlaylistScreen from './src/screens/PlaylistScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Discover') {
            iconName = focused ? 'musical-notes' : 'musical-notes-outline';
          } else if (route.name === 'Playlist') {
            iconName = focused ? 'heart' : 'heart-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#ff6b6b',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Discover" component={SwipeScreen} />
      <Tab.Screen name="Playlist" component={PlaylistScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading, refreshKey, loginWithToken } = useAuth();

  useEffect(() => {
    const handleUrl = async ({ url }) => {
      if (!url) return;
      
      try {
        const parsed = Linking.parse(url);
        
        if (parsed.queryParams?.loggedin === 'true' && parsed.queryParams?.token) {
          const userId = parsed.queryParams.userId;
          const username = parsed.queryParams.username;
          const token = parsed.queryParams.token;
          
          if (userId && token) {
            await loginWithToken({ id: userId, username: username || '' }, token);
          }
        }
      } catch (e) {
        console.log('URL parse error:', e);
      }
    };

    Linking.addEventListener('url', handleUrl);
    
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });
  }, [loginWithToken]);

  if (loading) {
    return null;
  }

  return user ? <MainTabs key={`tabs-${refreshKey}`} /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: '#ff6b6b',
            background: '#0a0a0a',
            card: '#151515',
            text: '#ffffff',
            border: 'rgba(255,255,255,0.08)',
            notification: '#ff6b6b',
          },
        }}
      >
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
