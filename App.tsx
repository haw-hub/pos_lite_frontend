// App.tsx
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
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
import { SignupScreen } from './src/screens/auth/SignupScreen';
import { DashboardScreen } from './src/screens/dashboard/DashboardScreen';
import { POSScreen } from './src/screens/pos/POSScreen';
import { CartScreen } from './src/screens/pos/CartScreen';
import { CheckoutScreen } from './src/screens/pos/CheckoutScreen';
import { InventoryScreen } from './src/screens/inventory/InventoryScreen';
import { SalesHistoryScreen } from './src/screens/reports/SalesHistoryScreen';
import { AddProductScreen } from './src/screens/inventory/AddProductScreen';
import { CreditListScreen } from './src/screens/inventory/CreditListScreen';
import { CustomerDebtDetailScreen } from './src/screens/inventory/CustomerDebtDetailScreen';
import { SettingsScreen } from './src/screens/settings/SettingsScreen';
import { UserManagementScreen } from './src/screens/settings/UserManagementScreen';

// Import stores
import { useAuthStore } from './src/store/authStore';
import { useCartStore } from './src/store/cartStore';

// Import database and sync
import { openDatabase, getDb, resetDatabase, isDatabaseReady } from './src/database/sqlite';
import { syncService } from './src/services/sync/syncService';
import { ProductRepository } from './src/database/repositories/productRepository';
import { inventoryAlertService } from './src/services/alerts/inventoryAlertService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { subscriptionService } from './src/services/subscription/subscriptionService';

// Import theme
import { COLORS, FONTS } from './src/config/theme';

// Create navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Debug functions - can be called from console
declare global {
  interface Window {
    debugDB: () => Promise<void>;
    forceSync: () => Promise<void>;
    clearAllData: () => Promise<void>;
  }
}

// Main Tab Navigator (for authenticated users)
function MainTabs({ navigation }: any) {
  const { itemCount } = useCartStore();
  const { user, logout } = useAuthStore();
  const [profileVisible, setProfileVisible] = useState(false);

  return (
    <>
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
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setProfileVisible(true)}
              style={{ marginRight: 15 }}
            >
              <Ionicons name="person-circle-outline" size={34} color={COLORS.white} />
            </TouchableOpacity>
          ),
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'ပင်မစာမျက်နှာ' }} />
        <Tab.Screen
          name="POS"
          component={POSScreen}
          options={{
            title: 'ရောင်းချရန်',
            tabBarBadge: itemCount > 0 ? itemCount : undefined,
            tabBarBadgeStyle: { backgroundColor: COLORS.danger }
          }}
        />
        <Tab.Screen name="Inventory" component={InventoryScreen} options={{ title: 'ပစ္စည်းစာရင်း' }} />
        <Tab.Screen name="Sales" component={SalesHistoryScreen} options={{ title: 'အစီရင်ခံစာ' }} />
      </Tab.Navigator>

      {/* PROFILE MODAL */}
      <Modal visible={profileVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setProfileVisible(false)}>
          <Pressable style={styles.profileModal}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setProfileVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
            <View style={styles.profileImageContainer}>
              <Ionicons name="person" size={60} color={COLORS.white} />
            </View>
            <Text style={styles.profileName}>{user?.fullName || 'Unknown User'}</Text>
            <View style={{ width: '100%', marginTop: 10 }}>
              <View style={styles.infoRow}>
                <Ionicons name="storefront-outline" size={18} color={COLORS.primary} />
                <Text style={styles.profileInfo}>{user?.shopName || 'Shop'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                <Text style={styles.profileInfo}>{user?.username || 'Unknown'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
                <Text style={styles.profileInfo}>{user?.role || 'Staff'}</Text>
              </View>
            </View>
            {user?.role === 'ADMIN' ? (
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => {
                  setProfileVisible(false);
                  navigation.navigate('UserManagement');
                }}
              >
                <Ionicons name="people-outline" size={20} color={COLORS.white} />
                <Text style={styles.logoutButtonText}>ဝန်ထမ်းများ စီမံရန်</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.settingsButton, { marginTop: 10 }]}
              onPress={() => {
                setProfileVisible(false);
                navigation.navigate('Settings');
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
              <Text style={styles.logoutButtonText}>သတိပေးချက် သတ်မှတ်ရန်</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
              <Text style={styles.logoutButtonText}>ထွက်ရန်</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// Auth Stack Navigator (for unauthenticated users)
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{
          headerShown: true,
          title: 'အကောင့်ဖွင့်ရန်',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontFamily: FONTS.bold }
        }}
      />
    </Stack.Navigator>
  );
}

// Main App Stack (for authenticated users)
function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
      <Stack.Screen
        name="CreditList"
        component={CreditListScreen}
        options={{
          headerShown: true,
          title: 'အကြွေးစာရင်း',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontFamily: FONTS.bold },
        }}
      />

      <Stack.Screen
        name="CustomerDebtDetail"
        component={CustomerDebtDetailScreen}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          title: 'သတိပေးချက် သတ်မှတ်ရန်',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontFamily: FONTS.bold },
        }}
      />
      <Stack.Screen
        name="UserManagement"
        component={UserManagementScreen}
        options={{
          headerShown: true,
          title: 'ဝန်ထမ်း Account များ',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontFamily: FONTS.bold },
        }}
      />
    </Stack.Navigator>
  );
}

// Root Navigator (handles auth flow)
function RootNavigator() {
  const { isAuthenticated, isLoading, checkAuth, subscriptionRequired, subscriptionState, verifySubscription, logout } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setIsInitializing(false);
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const refreshOfflineAccess = async () => {
      const network = await NetInfo.fetch();
      if (network.isConnected) return;
      const state = await subscriptionService.evaluateOffline();
      useAuthStore.setState({
        subscriptionState: state,
        subscriptionRequired: !state.canUseApp,
      });
    };
    refreshOfflineAccess();
    const interval = setInterval(refreshOfflineAccess, 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (isInitializing || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>စတင်နေပါသည်...</Text>
      </View>
    );
  }

  if (isAuthenticated && subscriptionRequired) {
    return (
      <View style={styles.subscriptionContainer}>
        <View style={styles.subscriptionIcon}>
          <Ionicons name="calendar-outline" size={34} color={COLORS.secondary} />
        </View>
        <Text style={styles.subscriptionTitle}>အသုံးပြုခွင့် သက်တမ်းကုန်သွားပါပြီ</Text>
        <Text style={styles.subscriptionText}>
          ဆိုင်၏ subscription ကို သက်တမ်းတိုးပြီးမှ POS ကို ဆက်လက်အသုံးပြုနိုင်ပါမည်။
        </Text>
        <Text style={styles.subscriptionDateText}>
          နောက်ဆုံးစစ်ဆေးချိန်: {subscriptionState?.lastVerifiedAt
            ? new Date(subscriptionState.lastVerifiedAt).toLocaleString()
            : 'မရှိသေးပါ'}
        </Text>
        <TouchableOpacity
          style={styles.subscriptionPrimaryButton}
          onPress={verifySubscription}
        >
          <Ionicons name="refresh" size={19} color={COLORS.white} />
          <Text style={styles.subscriptionPrimaryText}>သက်တမ်းတိုးပြီး ပြန်စမ်းမည်</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.subscriptionSecondaryButton} onPress={logout}>
          <Text style={styles.subscriptionSecondaryText}>Account မှ ထွက်မည်</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : (
        <Stack.Screen name="App" component={AppStack} />
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

  const [appReady, setAppReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize database and sync service
  useEffect(() => {
    let disposed = false;

    const initializeApp = async () => {
      try {
        console.log('🚀 Starting app initialization...');
        
        // Initialize database FIRST and wait for completion
        console.log('📁 Opening database...');
        const storedUser = await AsyncStorage.getItem('user_data');
        const startupUser = storedUser ? JSON.parse(storedUser) : null;
        await openDatabase(startupUser?.shopId, startupUser?.username);
        console.log('✅ Database opened successfully');
        
        // Wait a moment for database to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify database connection
        if (isDatabaseReady()) {
          console.log('✅ Database connection verified');
          
          // Check existing products count
          const productCount = await ProductRepository.getAll();
          console.log(`📊 Existing products in DB: ${productCount.length}`);
          
          if (productCount.length > 0) {
            console.log('📊 Sample products in DB:');
            productCount.slice(0, 3).forEach(p => {
              console.log(`   - ID:${p.id}, Name:${p.name}, Price:${p.price}, Stock:${p.stock}`);
            });
          }
        }
        
        // Initialize sync service
        console.log('🔄 Initializing sync service...');
        await syncService.init();
        await inventoryAlertService.initialize();
        if (disposed) {
          syncService.destroy();
          return;
        }
        console.log('✅ Sync service initialized');
        
        // Setup debug functions for console
        if (typeof window !== 'undefined') {
          window.debugDB = async () => {
            console.log('\n========== DB DEBUG INFO ==========');
            try {
              const db = getDb();
              
              // Get all products count
              const allProducts = await ProductRepository.getAll();
              const deletedProducts = await ProductRepository.getDeletedProducts();
              
              console.log(`📊 Active products: ${allProducts.length}`);
              console.log(`🗑️ Deleted products: ${deletedProducts.length}`);
              
              console.log('\n📦 Active products:');
              allProducts.forEach(p => {
                console.log(`   ID:${p.id} | ${p.name} | Price:${p.price} | Stock:${p.stock} | Sync:${p.syncStatus}`);
              });
              
              if (deletedProducts.length > 0) {
                console.log('\n🗑️ Deleted products:');
                deletedProducts.forEach(p => {
                  console.log(`   ID:${p.id} | ${p.name} | Price:${p.price} | Deleted:${p.deleted}`);
                });
              }
              
              // Check sync queue
              const syncQueue = await db.getAllAsync('SELECT * FROM sync_queue WHERE status != "completed"');
              console.log(`\n📤 Pending sync items: ${syncQueue.length}`);
              
              console.log('========== DB DEBUG END ==========\n');
            } catch (error) {
              console.error('Debug error:', error);
            }
          };
          
          window.forceSync = async () => {
            console.log('💪 Manual force sync triggered');
            await syncService.forceSync();
          };
          
          window.clearAllData = async () => {
            console.log('🗑️ Clearing all data...');
            const { clearAllData } = await import('./src/database/sqlite');
            await clearAllData();
            console.log('✅ All data cleared');
            await window.debugDB();
          };
          
          console.log('✅ Debug functions available:');
          console.log('   - debugDB() - Show database contents');
          console.log('   - forceSync() - Trigger manual sync');
          console.log('   - clearAllData() - Clear all local data');
        }
        
        // Run initial sync after a delay (don't block startup)
        setTimeout(() => {
          console.log('🔄 Running initial background sync...');
          syncService.syncAll().catch((err: Error) => {
            console.log('Background sync error (non-critical):', err.message);
          });
        }, 5000);
        
        setAppReady(true);
        console.log('🎉 App initialization complete!');
      } catch (error: any) {
        console.error('❌ App initialization error:', error);
        console.error('Error details:', error.message);
        setInitError(error.message);
        setAppReady(true);
      }
    };

    initializeApp();

    return () => {
      disposed = true;
      syncService.destroy();
    };
  }, []);

  // Show loading screen while fonts or app are loading
  if (!fontsLoaded || !appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          {!fontsLoaded && 'ဖောင့်များ တင်နေပါသည်...'}
          {fontsLoaded && !appReady && 'အက်ပ်အား စတင်နေပါသည်...'}
        </Text>
      </View>
    );
  }

  // Show error screen if initialization failed
  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={COLORS.danger} />
        <Text style={styles.errorTitle}>စတင်ရာတွင် အမှားရှိပါသည်</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
        
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setInitError(null);
            setAppReady(false);
            const retryInit = async () => {
              try {
                await resetDatabase();
                setAppReady(true);
              } catch (e) {
                setInitError(String(e));
                setAppReady(true);
              }
            };
            retryInit();
          }}
        >
          <Text style={styles.retryButtonText}>ပြန်စမ်းရန်</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: COLORS.danger, marginTop: 10 }]}
          onPress={() => {
            setInitError(null);
            setAppReady(false);
            const resetAndRetry = async () => {
              try {
                await resetDatabase();
                setAppReady(true);
              } catch (e) {
                setInitError(String(e));
                setAppReady(true);
              }
            };
            resetAndRetry();
          }}
        >
          <Text style={styles.retryButtonText}>ဒေတာဘေ့စ်ပြန်လည်စတင်ရန်</Text>
        </TouchableOpacity>
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
  loadingSubText: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 20,
  },
  errorTitle: {
    marginTop: 20,
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.danger,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.dark,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorHint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModal: {
    width: '70%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  profileName: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.dark,
    marginBottom: 15,
  },
  profileInfo: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: COLORS.dark,
    marginLeft: 10,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 25,
    width: '100%',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 18,
    width: '100%',
  },
  logoutButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    marginLeft: 10,
    fontSize: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  subscriptionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: COLORS.light,
  },
  subscriptionIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    backgroundColor: '#FFF0E4',
  },
  subscriptionTitle: {
    fontSize: 22,
    lineHeight: 34,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    textAlign: 'center',
  },
  subscriptionText: {
    maxWidth: 360,
    marginTop: 10,
    fontSize: 14,
    lineHeight: 25,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
  },
  subscriptionDateText: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 20,
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
  },
  subscriptionPrimaryButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 52,
    marginTop: 28,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.primary,
  },
  subscriptionPrimaryText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  subscriptionSecondaryButton: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  subscriptionSecondaryText: {
    color: COLORS.danger,
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
});
