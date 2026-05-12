// App.tsx
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Import fonts
import { useFonts } from 'expo-font';
import {
  NotoSansMyanmar_400Regular,
  NotoSansMyanmar_500Medium,
  NotoSansMyanmar_600SemiBold,
  NotoSansMyanmar_700Bold,
} from '@expo-google-fonts/noto-sans-myanmar';

// Import your screens
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { DashboardScreen } from './src/screens/dashboard/DashboardScreen';
import { POSScreen } from './src/screens/pos/POSScreen';
import { CartScreen } from './src/screens/pos/CartScreen';
import { CheckoutScreen } from './src/screens/pos/CheckoutScreen';
import { InventoryScreen } from './src/screens/inventory/InventoryScreen';
import { SalesHistoryScreen } from './src/screens/reports/SalesHistoryScreen';
import { SettingsScreen } from './src/screens/settings/SettingsScreen';
import { AddProductScreen } from './src/screens/inventory/AddProductScreen';

// Import stores
import { useAuthStore } from './src/store/authStore';
import { useCartStore } from './src/store/cartStore';
import { useProductStore } from './src/store/productStore';

// Import database and sync
import { openDatabase } from './src/database/sqlite';
import { syncService } from './src/services/sync/syncService';

// Import theme
import { COLORS, FONTS } from './src/config/theme';

// Create navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main Tab Navigator (for authenticated users)
function MainTabs() {
  const { itemCount, total } = useCartStore();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          
          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'POS') {
            iconName = focused ? 'cart' : 'cart-outline';
          } else if (route.name === 'Inventory') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Sales') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: FONTS.regular,
        },
        headerStyle: {
          backgroundColor: COLORS.primary,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontFamily: FONTS.bold,
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{ title: 'ပင်မစာမျက်နှာ' }}
      />
      <Tab.Screen 
        name="POS" 
        component={POSScreen} 
        options={{ 
          title: 'ရောင်းချရန်',
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.danger }
        }}
      />
      <Tab.Screen 
        name="Inventory" 
        component={InventoryScreen} 
        options={{ title: 'ပစ္စည်းစာရင်း' }}
      />
      <Tab.Screen 
        name="Sales" 
        component={SalesHistoryScreen} 
        options={{ title: 'အရောင်းမှတ်တမ်း' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: 'ပြင်ဆင်ချက်များ' }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator (handles auth flow)
function RootNavigator() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setIsInitializing(false);
    };
    initAuth();
  }, []);

  if (isInitializing || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>စတင်နေပါသည်...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen 
            name="Cart" 
            component={CartScreen} 
            options={{ 
              headerShown: true, 
              title: 'ဈေးခြင်း',
              headerStyle: { backgroundColor: COLORS.primary },
              headerTintColor: COLORS.white,
              headerTitleStyle: { fontFamily: FONTS.bold }
            }}
          />
          <Stack.Screen 
            name="Checkout" 
            component={CheckoutScreen} 
            options={{ 
              headerShown: true, 
              title: 'ငွေရှင်းမည်',
              headerStyle: { backgroundColor: COLORS.primary },
              headerTintColor: COLORS.white,
              headerTitleStyle: { fontFamily: FONTS.bold }
            }}
          />

          <Stack.Screen 
  name="AddProduct" 
  component={AddProductScreen} 
  options={{ 
    headerShown: true, 
    title: 'ပစ္စည်းအသစ်ထည့်ရန်',
    headerStyle: { backgroundColor: COLORS.primary },
    headerTintColor: COLORS.white,
    headerTitleStyle: { fontFamily: FONTS.bold }
  }}
/>
        </>
      )}
    </Stack.Navigator>
  );
}

// Main App Component
export default function App() {
  const [fontsLoaded] = useFonts({
    NotoSansMyanmar_400Regular,
    NotoSansMyanmar_500Medium,
    NotoSansMyanmar_600SemiBold,
    NotoSansMyanmar_700Bold,
  });

  const [dbInitialized, setDbInitialized] = useState(false);
  const [syncInitialized, setSyncInitialized] = useState(false);

  // Initialize database and sync service
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize database
        await openDatabase();
        console.log('✅ Database initialized');
        setDbInitialized(true);

        // Initialize sync service
        await syncService.init();
        console.log('✅ Sync service initialized');
        setSyncInitialized(true);

        // Initial sync
        await syncService.syncAll();
        console.log('✅ Initial sync completed');
      } catch (error) {
        console.error('❌ App initialization error:', error);
        setDbInitialized(true); // Set to true even on error to show app
        setSyncInitialized(true);
      }
    };

    initializeApp();
  }, []);

  // Show loading screen while fonts or database are loading
  if (!fontsLoaded || !dbInitialized || !syncInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          {!fontsLoaded && 'ဖောင့်များ တင်နေပါသည်...'}
          {fontsLoaded && !dbInitialized && 'ဒေတာဘေ့စ် စတင်နေပါသည်...'}
          {fontsLoaded && dbInitialized && !syncInitialized && 'ဒေတာများ ထပ်တူကျနေပါသည်...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.dark,
  },
});