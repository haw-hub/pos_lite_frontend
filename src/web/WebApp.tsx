import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { COLORS, FONTS } from '../config/theme';
import { ENV } from '../config/env';
import { Product } from '../types';
import { formatCurrency } from '../utils/currency';

type WebSection = 'dashboard' | 'pos' | 'inventory' | 'reports' | 'stockIn' | 'users' | 'settings';
type PaymentMethod = 'CASH' | 'TRANSFER' | 'CREDIT';
type EmployeeRole = 'MANAGER' | 'CASHIER';

interface CartLine {
  product: Product;
  quantity: number;
  unitPrice: number;
  label: string;
}

interface WebUser {
  token: string;
  userId: number;
  username: string;
  role: string;
  fullName: string;
  shopId: number;
  shopName: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
}

interface OrderResponse {
  id: number;
  orderNumber: string;
  totalAmount: number;
  totalProfit?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items?: {
    id: number;
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
}

interface PaymentBreakdown {
  paymentMethod: string;
  orderCount: number;
  totalAmount: number;
}

interface ProductPerformance {
  productId: number;
  productName: string;
  quantity: number;
  sales: number;
  profit: number;
}

interface CashierPerformance {
  userId: number;
  fullName: string;
  username: string;
  orderCount: number;
  sales: number;
  profit: number;
}

interface ReportSummary {
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  totalOrders: number;
  itemsSold: number;
  refundAmount: number;
  refundProfitAdjustment: number;
  purchaseCost: number;
  refundCount: number;
  purchaseCount: number;
  payments: PaymentBreakdown[];
  topProducts: ProductPerformance[];
  cashiers: CashierPerformance[];
}

interface ShopUser {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: 'ADMIN' | EmployeeRole;
  active: boolean;
}

interface DailyClosing {
  id: number;
  businessDate: string;
  closedAt: string;
  closedByName: string;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  cashExpected?: number;
  cashInHand?: number;
  cashDifference?: number;
  digitalPayTotal?: number;
  creditTotal?: number;
  refundAmount?: number;
  totalOrders: number;
  itemsSold: number;
  note?: string;
}

interface PurchaseResponse {
  id: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  createdAt: string;
  product?: {
    id: number;
    name: string;
  };
  supplier?: {
    id: number;
    name: string;
    phone?: string;
  };
}

interface AlertSettings {
  enabled: boolean;
  expiryDays: number;
  lowStockCount: number;
}

const webClient = axios.create({
  baseURL: ENV.API_URL,
  timeout: ENV.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

webClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

webClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['auth_token', 'user_data']);
    }
    return Promise.reject(error);
  }
);

const emptySummary: ReportSummary = {
  totalSales: 0,
  totalCost: 0,
  totalProfit: 0,
  profitMargin: 0,
  totalOrders: 0,
  itemsSold: 0,
  refundAmount: 0,
  refundProfitAdjustment: 0,
  purchaseCost: 0,
  refundCount: 0,
  purchaseCount: 0,
  payments: [],
  topProducts: [],
  cashiers: [],
};

const todayValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const paymentMethods: PaymentMethod[] = ['CASH', 'TRANSFER', 'CREDIT'];

const paymentLabel = (method: PaymentMethod | string) => {
  const labels: Record<string, string> = {
    CASH: 'Cash',
    TRANSFER: 'Digital Pay',
    CREDIT: 'အကြွေး',
  };
  return labels[method] || method;
};

const roleCanManage = (role?: string) => role === 'ADMIN' || role === 'MANAGER';
const roleCanSeeProfit = roleCanManage;

export const WebApp = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 720 && width < 1024;
  const isCompact = width < 720;
  const productColumns = isDesktop ? 4 : isTablet ? 3 : 2;
  const inventoryColumns = isDesktop ? 3 : isTablet ? 2 : 1;

  const [user, setUser] = useState<WebUser | null>(null);
  const [section, setSection] = useState<WebSection>('dashboard');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [users, setUsers] = useState<ShopUser[]>([]);
  const [purchases, setPurchases] = useState<PurchaseResponse[]>([]);
  const [summary, setSummary] = useState<ReportSummary>(emptySummary);
  const [closing, setClosing] = useState<DailyClosing | null>(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('CASH');
  const [startDate, setStartDate] = useState(todayValue());
  const [endDate, setEndDate] = useState(todayValue());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);
  const [refundItemId, setRefundItemId] = useState('');
  const [refundQty, setRefundQty] = useState('1');
  const [refundReason, setRefundReason] = useState('');
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'CASHIER' as EmployeeRole,
  });
  const [stockInForm, setStockInForm] = useState({
    productId: '',
    supplierName: '',
    supplierPhone: '',
    quantity: '',
    unitCost: '',
    note: '',
  });
  const [settings, setSettings] = useState<AlertSettings>({
    enabled: true,
    expiryDays: 3,
    lowStockCount: 10,
  });
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    costPrice: '',
    stock: '',
    barcode: '',
    wholesalePrice: '',
    vipPrice: '',
    unitName: 'ခု',
    packUnitName: '',
    packSize: '',
    expiryDate: '',
  });

  const canManage = roleCanManage(user?.role);
  const canSeeProfit = roleCanSeeProfit(user?.role);
  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      String(product.barcode || '').toLowerCase().includes(term)
    );
  }, [products, query]);

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lowStock = products.filter(product => product.stock <= settings.lowStockCount);
  const expiring = products.filter(product => {
    if (!product.expiryDate) return false;
    const days = Math.ceil((new Date(`${product.expiryDate}T00:00:00`).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= settings.expiryDays;
  });

  const loadData = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const requests: Promise<any>[] = [
        webClient.get('/products'),
        webClient.get('/orders'),
        webClient.get('/purchases'),
      ];
      if (canManage) {
        requests.push(webClient.get('/users'));
      }
      const [productResponse, orderResponse, purchaseResponse, userResponse] = await Promise.all(requests);
      const productList = Array.isArray(productResponse.data) ? productResponse.data : [];
      const orderList = Array.isArray(orderResponse.data) ? orderResponse.data : [];
      setProducts(productList);
      setOrders(orderList.sort((a: OrderResponse, b: OrderResponse) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      setPurchases(Array.isArray(purchaseResponse.data) ? purchaseResponse.data : []);
      if (userResponse) {
        setUsers(Array.isArray(userResponse.data) ? userResponse.data : []);
      }
      if (canSeeProfit) {
        const reportResponse = await webClient.get('/reports/summary', {
          params: { start: startDate, end: endDate },
        });
        setSummary(reportResponse.data);
        const closingResponse = await webClient.get(`/reports/closings/${endDate}`, {
          validateStatus: status => (status >= 200 && status < 300) || status === 204,
        });
        setClosing(closingResponse.status === 204 ? null : closingResponse.data);
      } else {
        const filteredOrders = orderList.filter((order: OrderResponse) => {
          const created = String(order.createdAt).slice(0, 10);
          return created >= startDate && created <= endDate;
        });
        setSummary({
          ...emptySummary,
          totalSales: filteredOrders.reduce((sum: number, order: OrderResponse) => sum + Number(order.totalAmount || 0), 0),
          totalOrders: filteredOrders.length,
          itemsSold: filteredOrders.reduce(
            (sum: number, order: OrderResponse) =>
              sum + (order.items || []).reduce((s: number, item) => s + item.quantity, 0),
            0
          ),
        });
      }
    } catch (error: any) {
      Alert.alert('Data မရပါ', error?.response?.data?.message || error?.message || 'Backend နှင့်ချိတ်ဆက်မရပါ');
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }, [user, canManage, canSeeProfit, startDate, endDate]);

  useEffect(() => {
    const restore = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user_data');
        const token = await AsyncStorage.getItem('auth_token');
        if (storedUser && token) {
          setUser(JSON.parse(storedUser));
        }
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const login = async () => {
    if (!username.trim() || !password) {
      Alert.alert('လိုအပ်သည်', 'Username နှင့် password ထည့်ပါ');
      return;
    }
    setBusy(true);
    try {
      const response = await webClient.post('/auth/login', { username: username.trim(), password });
      const auth = response.data;
      await AsyncStorage.setItem('auth_token', auth.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(auth));
      setUser(auth);
      setSection('dashboard');
    } catch (error: any) {
      Alert.alert('Login မအောင်မြင်ပါ', error?.response?.data?.message || error?.message || 'ပြန်စမ်းပါ');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['auth_token', 'user_data']);
    setUser(null);
    setProducts([]);
    setOrders([]);
    setCart([]);
  };

  const addToCart = (product: Product, unitPrice = product.price, label = product.unitName || 'ခု') => {
    if (product.stock <= 0) {
      Alert.alert('Stock မရှိပါ', `${product.name} ကုန်နေပါသည်`);
      return;
    }
    setCart(current => {
      const found = current.find(item => item.product.id === product.id && item.unitPrice === unitPrice && item.label === label);
      if (found) {
        if (found.quantity + 1 > product.stock) {
          Alert.alert('Stock မလုံလောက်ပါ', `${product.stock} ${product.unitName || 'ခု'} သာကျန်ပါသည်`);
          return current;
        }
        return current.map(item => item === found ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { product, quantity: 1, unitPrice, label }];
    });
  };

  const changeQty = (line: CartLine, delta: number) => {
    setCart(current => current
      .map(item => {
        if (item !== line) return item;
        const next = item.quantity + delta;
        if (next > item.product.stock) {
          Alert.alert('Stock မလုံလောက်ပါ', `${item.product.stock} ${item.product.unitName || 'ခု'} သာကျန်ပါသည်`);
          return item;
        }
        return { ...item, quantity: next };
      })
      .filter(item => item.quantity > 0));
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      await webClient.post('/orders', {
        paymentMethod: payment,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
      setCart([]);
      await loadData();
      Alert.alert('အောင်မြင်သည်', 'Order သိမ်းပြီးပါပြီ');
    } catch (error: any) {
      Alert.alert('Order မသိမ်းနိုင်ပါ', error?.response?.data?.message || error?.message || 'ပြန်စမ်းပါ');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const restoreSettings = async () => {
      const stored = await AsyncStorage.getItem('web_alert_settings');
      if (stored) {
        setSettings(current => ({ ...current, ...JSON.parse(stored) }));
      }
    };
    restoreSettings();
  }, []);

  const resetProductForm = () => {
    setProductForm({
      name: '',
      price: '',
      costPrice: '',
      stock: '',
      barcode: '',
      wholesalePrice: '',
      vipPrice: '',
      unitName: 'ခု',
      packUnitName: '',
      packSize: '',
      expiryDate: '',
    });
  };

  const openProductForm = (product?: Product) => {
    if (product) {
      setEditingProductId(product.id);
      setProductForm({
        name: product.name || '',
        price: String(product.price || ''),
        costPrice: String(product.costPrice || ''),
        stock: String(product.stock || ''),
        barcode: product.barcode || '',
        wholesalePrice: String(product.wholesalePrice || ''),
        vipPrice: String(product.vipPrice || ''),
        unitName: product.unitName || 'ခု',
        packUnitName: product.packUnitName || '',
        packSize: String(product.packSize || ''),
        expiryDate: product.expiryDate || '',
      });
    } else {
      setEditingProductId(null);
      resetProductForm();
    }
    setProductModalVisible(true);
  };

  const saveProduct = async () => {
    const payload = {
      name: productForm.name.trim(),
      description: '',
      price: Number(productForm.price || 0),
      wholesalePrice: Number(productForm.wholesalePrice || 0) || undefined,
      vipPrice: Number(productForm.vipPrice || 0) || undefined,
      costPrice: Number(productForm.costPrice || 0),
      stock: Number(productForm.stock || 0),
      barcode: productForm.barcode.trim(),
      unitName: productForm.unitName.trim() || 'ခု',
      packUnitName: productForm.packUnitName.trim(),
      packSize: Number(productForm.packSize || 1),
      expiryDate: productForm.expiryDate || undefined,
    };
    if (!payload.name || payload.price <= 0 || payload.costPrice <= 0) {
      Alert.alert('အချက်အလက်လိုအပ်သည်', 'အမည်၊ ရောင်းစျေး၊ အရင်းစျေး ထည့်ပါ');
      return;
    }
    setBusy(true);
    try {
      if (editingProductId) {
        await webClient.put(`/products/${editingProductId}`, payload);
      } else {
        await webClient.post('/products', payload);
      }
      setProductModalVisible(false);
      setEditingProductId(null);
      resetProductForm();
      await loadData();
    } catch (error: any) {
      Alert.alert('Product မသိမ်းနိုင်ပါ', error?.response?.data?.message || error?.message || 'ပြန်ကြိုးစားပါ');
    } finally {
      setBusy(false);
    }
  };

  const deleteProduct = (product: Product) => {
    Alert.alert('Product ဖျက်မည်', `${product.name} ကိုဖျက်မည်လား`, [
      { text: 'မလုပ်တော့ပါ', style: 'cancel' },
      {
        text: 'ဖျက်မည်',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await webClient.delete(`/products/${product.id}`);
            await loadData();
          } catch (error: any) {
            Alert.alert('မအောင်မြင်ပါ', error?.response?.data?.message || error?.message || 'ပြန်ကြိုးစားပါ');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const stockIn = async () => {
    const productId = Number(stockInForm.productId);
    const quantity = Number(stockInForm.quantity);
    const unitCost = Number(stockInForm.unitCost);
    if (!productId || quantity <= 0 || unitCost <= 0) {
      Alert.alert('အချက်အလက်လိုအပ်သည်', 'Product, quantity, unit cost ထည့်ပါ');
      return;
    }
    setBusy(true);
    try {
      await webClient.post('/purchases', {
        productId,
        supplierName: stockInForm.supplierName.trim() || undefined,
        supplierPhone: stockInForm.supplierPhone.trim() || undefined,
        quantity,
        unitCost,
        note: stockInForm.note.trim() || undefined,
      });
      setStockInForm({ productId: '', supplierName: '', supplierPhone: '', quantity: '', unitCost: '', note: '' });
      await loadData();
      Alert.alert('အောင်မြင်ပါသည်', 'Stock In သိမ်းပြီးပါပြီ');
    } catch (error: any) {
      Alert.alert('Stock In မသိမ်းနိုင်ပါ', error?.response?.data?.message || error?.message || 'ပြန်ကြိုးစားပါ');
    } finally {
      setBusy(false);
    }
  };

  const createEmployee = async () => {
    if (!employeeForm.fullName.trim() || !employeeForm.username.trim() || employeeForm.password.length < 6) {
      Alert.alert('အချက်အလက်လိုအပ်သည်', 'အမည်၊ username နှင့် password အနည်းဆုံး ၆ လုံး ထည့်ပါ');
      return;
    }
    setBusy(true);
    try {
      await webClient.post('/users', {
        ...employeeForm,
        username: employeeForm.username.trim().toLowerCase(),
      });
      setEmployeeForm({ username: '', password: '', fullName: '', role: 'CASHIER' });
      setUserModalVisible(false);
      await loadData();
    } catch (error: any) {
      Alert.alert('Account မဖန်တီးနိုင်ပါ', error?.response?.data?.message || error?.message || 'ပြန်ကြိုးစားပါ');
    } finally {
      setBusy(false);
    }
  };

  const toggleUser = async (shopUser: ShopUser) => {
    setBusy(true);
    try {
      await webClient.put(`/users/${shopUser.id}/active`, null, { params: { value: !shopUser.active } });
      await loadData();
    } catch (error: any) {
      Alert.alert('မအောင်မြင်ပါ', error?.response?.data?.message || error?.message || 'ပြန်ကြိုးစားပါ');
    } finally {
      setBusy(false);
    }
  };

  const closeDay = async () => {
    const enteredCash =
      typeof window !== 'undefined'
        ? window.prompt('လက်ထဲရှိငွေသား ထည့်ပါ', '0')
        : '0';
    if (enteredCash === null) return;
    const cashInHand = Number(enteredCash || 0);
    if (!Number.isFinite(cashInHand) || cashInHand < 0) {
      Alert.alert('သတိပေးချက်', 'လက်ထဲရှိငွေသားကိုမှန်ကန်စွာထည့်ပါ');
      return;
    }
    setBusy(true);
    try {
      const response = await webClient.post(`/reports/closings/${endDate}`, {
        cashInHand,
      });
      setClosing(response.data);
      await loadData();
      Alert.alert('နေ့ပိတ်ပြီးပါပြီ', `${endDate} report ကို snapshot သိမ်းပြီးပါပြီ`);
    } catch (error: any) {
      Alert.alert('နေ့ပိတ်မအောင်မြင်ပါ', error?.response?.data?.message || error?.message || 'ပြန်ကြိုးစားပါ');
    } finally {
      setBusy(false);
    }
  };

  const submitRefund = async () => {
    if (!selectedOrder || !refundItemId) return;
    setBusy(true);
    try {
      await webClient.post(`/orders/${selectedOrder.id}/refunds`, {
        orderItemId: Number(refundItemId),
        quantity: Number(refundQty || 1),
        reason: refundReason.trim() || undefined,
      });
      setSelectedOrder(null);
      setRefundItemId('');
      setRefundQty('1');
      setRefundReason('');
      await loadData();
      Alert.alert('Refund ပြီးပါပြီ', 'Stock ပြန်တိုးပြီး report ထဲတွင် refund ခွဲပြထားပါမည်');
    } catch (error: any) {
      Alert.alert('Refund မအောင်မြင်ပါ', error?.response?.data?.message || error?.message || 'ပြန်ကြိုးစားပါ');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    await AsyncStorage.setItem('web_alert_settings', JSON.stringify(settings));
    Alert.alert('သိမ်းပြီးပါပြီ', 'Web alert settings သိမ်းပြီးပါပြီ');
  };

  const downloadReport = (type: 'pdf' | 'excel') => {
    const rows = [
      ['Start', startDate],
      ['End', endDate],
      ['Sales', String(summary.totalSales)],
      ['Profit', String(summary.totalProfit)],
      ['Orders', String(summary.totalOrders)],
      ['Items', String(summary.itemsSold)],
    ];
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: type === 'excel' ? 'text/csv' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pos-report-${startDate}-${endDate}.${type === 'excel' ? 'csv' : 'txt'}`;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (loading) {
    return <LoadingScreen text="စတင်နေပါသည်..." />;
  }

  if (!user) {
    return (
      <View style={styles.loginShell}>
        <View style={[styles.loginPanel, isCompact && styles.loginPanelCompact]}>
          <View style={styles.brandMark}>
            <Ionicons name="storefront-outline" size={34} color={COLORS.white} />
          </View>
          <Text style={styles.loginTitle}>POS Myanmar Web</Text>
          <Text style={styles.loginSub}>Online only dashboard for desktop, tablet and mobile browser</Text>
          <TextInput style={styles.loginInput} placeholder="Username" value={username} onChangeText={setUsername} />
          <TextInput style={styles.loginInput} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={styles.primaryButton} onPress={login} disabled={busy}>
            {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Login</Text>}
          </TouchableOpacity>
          <Text style={styles.loginHint}>Web version သည် internet/backend online ဖြစ်မှသာအသုံးပြုနိုင်ပါသည်။</Text>
        </View>
      </View>
    );
  }

  const nav = (
    <View style={[styles.nav, isCompact && styles.navCompact]}>
      <View style={styles.navBrand}>
        <View style={styles.navLogo}><Ionicons name="storefront" size={20} color={COLORS.white} /></View>
        {!isCompact && (
          <View>
            <Text style={styles.navTitle}>POS Myanmar</Text>
            <Text style={styles.navShop}>{user.shopName || 'Shop'}</Text>
          </View>
        )}
      </View>
      <NavButton label="Dashboard" mm="ပင်မ" icon="grid-outline" active={section === 'dashboard'} compact={isCompact} onPress={() => setSection('dashboard')} />
      <NavButton label="POS" mm="ရောင်းချ" icon="cart-outline" active={section === 'pos'} compact={isCompact} onPress={() => setSection('pos')} />
      <NavButton label="Inventory" mm="ပစ္စည်း" icon="cube-outline" active={section === 'inventory'} compact={isCompact} onPress={() => setSection('inventory')} />
      <NavButton label="Reports" mm="Report" icon="stats-chart-outline" active={section === 'reports'} compact={isCompact} onPress={() => setSection('reports')} />
      {!isCompact && canManage && <NavButton label="Stock In" mm="Stock" icon="download-outline" active={section === 'stockIn'} compact={isCompact} onPress={() => setSection('stockIn')} />}
      {!isCompact && canManage && <NavButton label="Users" mm="Users" icon="people-outline" active={section === 'users'} compact={isCompact} onPress={() => setSection('users')} />}
      {!isCompact && <NavButton label="Settings" mm="Setting" icon="settings-outline" active={section === 'settings'} compact={isCompact} onPress={() => setSection('settings')} />}
      {!isCompact && <View style={styles.navSpacer} />}
      {!isCompact && <Text style={styles.navUser}>{user.fullName}</Text>}
      {!isCompact && <TouchableOpacity style={styles.logout} onPress={logout}><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>}
    </View>
  );

  return (
    <View style={styles.shell}>
      {!isCompact && nav}
      <View style={styles.main}>
        <View style={[styles.topbar, isCompact && styles.topbarCompact]}>
          <View>
            <Text style={styles.pageTitle}>{sectionTitle(section)}</Text>
            <Text style={styles.pageSub}>{user.shopName} • Online only</Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.refreshButton} onPress={loadData} disabled={busy}>
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
              {!isCompact && <Text style={styles.refreshText}>Refresh</Text>}
            </TouchableOpacity>
            {isCompact && <TouchableOpacity style={styles.refreshButton} onPress={logout}><Ionicons name="log-out-outline" size={18} color={COLORS.danger} /></TouchableOpacity>}
          </View>
        </View>

        {section === 'dashboard' && (
          <DashboardView
            summary={summary}
            orders={orders}
            products={products}
            lowStock={lowStock}
            expiring={expiring}
            canSeeProfit={canSeeProfit}
            isDesktop={isDesktop}
          />
        )}

        {section === 'pos' && (
          <View style={[styles.posLayout, isDesktop && styles.posLayoutDesktop]}>
            <View style={styles.posProducts}>
              <TextInput style={styles.search} placeholder="Product / barcode ရှာရန်" value={query} onChangeText={setQuery} />
              <FlatList
                key={`pos-${productColumns}`}
                data={filteredProducts}
                keyExtractor={item => String(item.id)}
                numColumns={productColumns}
                columnWrapperStyle={productColumns > 1 ? styles.gridRow : undefined}
                renderItem={({ item }) => (
                  <ProductTile product={item} onAdd={() => addToCart(item)} />
                )}
              />
            </View>
            <CartPanel
              cart={cart}
              total={cartTotal}
              payment={payment}
              setPayment={setPayment}
              changeQty={changeQty}
              checkout={checkout}
              busy={busy}
            />
          </View>
        )}

        {section === 'inventory' && (
          <View style={styles.content}>
            <View style={styles.sectionToolbar}>
              <TextInput style={[styles.search, styles.toolbarSearch]} placeholder="ပစ္စည်းရှာရန်" value={query} onChangeText={setQuery} />
              {canManage && (
                <TouchableOpacity style={styles.primaryButtonSmall} onPress={() => openProductForm()}>
                  <Ionicons name="add" size={18} color={COLORS.white} />
                  <Text style={styles.primaryButtonSmallText}>Product ထည့်</Text>
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              key={`inventory-${inventoryColumns}`}
              data={filteredProducts}
              keyExtractor={item => String(item.id)}
              numColumns={inventoryColumns}
              columnWrapperStyle={inventoryColumns > 1 ? styles.gridRow : undefined}
              renderItem={({ item }) => (
                <InventoryCard
                  product={item}
                  canManage={canManage}
                  onEdit={() => openProductForm(item)}
                  onDelete={() => deleteProduct(item)}
                />
              )}
            />
          </View>
        )}

        {section === 'reports' && (
          <ReportsView
            summary={summary}
            orders={orders}
            canSeeProfit={canSeeProfit}
            isDesktop={isDesktop}
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            closing={closing}
            closeDay={closeDay}
            onOrderPress={setSelectedOrder}
            downloadReport={downloadReport}
          />
        )}

        {section === 'stockIn' && canManage && (
          <StockInView
            products={products}
            purchases={purchases}
            form={stockInForm}
            setForm={setStockInForm}
            onSubmit={stockIn}
            busy={busy}
          />
        )}

        {section === 'users' && canManage && (
          <UsersView
            users={users}
            currentUserId={user.userId}
            onAdd={() => setUserModalVisible(true)}
            onToggle={toggleUser}
          />
        )}

        {section === 'settings' && (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            saveSettings={saveSettings}
            user={user}
            lowStock={lowStock.length}
            expiring={expiring.length}
          />
        )}
      </View>
      {isCompact && nav}

      <Modal visible={productModalVisible} transparent animationType="fade" onRequestClose={() => setProductModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setProductModalVisible(false)}>
          <Pressable style={[styles.productModal, isCompact && styles.productModalCompact]}>
            <Text style={styles.modalTitle}>{editingProductId ? 'Product ပြင်ရန်' : 'Product အသစ်ထည့်ရန်'}</Text>
            <TextInput style={styles.formInput} placeholder="Name" value={productForm.name} onChangeText={value => setProductForm({ ...productForm, name: value })} />
            <View style={styles.formRow}>
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Selling price" value={productForm.price} onChangeText={value => setProductForm({ ...productForm, price: value })} keyboardType="numeric" />
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Cost price" value={productForm.costPrice} onChangeText={value => setProductForm({ ...productForm, costPrice: value })} keyboardType="numeric" />
            </View>
            <View style={styles.formRow}>
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Wholesale price" value={productForm.wholesalePrice} onChangeText={value => setProductForm({ ...productForm, wholesalePrice: value })} keyboardType="numeric" />
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="VIP price" value={productForm.vipPrice} onChangeText={value => setProductForm({ ...productForm, vipPrice: value })} keyboardType="numeric" />
            </View>
            <View style={styles.formRow}>
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Stock" value={productForm.stock} onChangeText={value => setProductForm({ ...productForm, stock: value })} keyboardType="numeric" />
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Unit" value={productForm.unitName} onChangeText={value => setProductForm({ ...productForm, unitName: value })} />
            </View>
            <View style={styles.formRow}>
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Pack unit" value={productForm.packUnitName} onChangeText={value => setProductForm({ ...productForm, packUnitName: value })} />
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Pack size" value={productForm.packSize} onChangeText={value => setProductForm({ ...productForm, packSize: value })} keyboardType="numeric" />
            </View>
            <TextInput style={styles.formInput} placeholder="Barcode" value={productForm.barcode} onChangeText={value => setProductForm({ ...productForm, barcode: value })} />
            <TextInput style={styles.formInput} placeholder="Expiry date YYYY-MM-DD" value={productForm.expiryDate} onChangeText={value => setProductForm({ ...productForm, expiryDate: value })} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setProductModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButtonSmall} onPress={saveProduct} disabled={busy}>
                <Text style={styles.primaryButtonSmallText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={userModalVisible} transparent animationType="fade" onRequestClose={() => setUserModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setUserModalVisible(false)}>
          <Pressable style={[styles.productModal, isCompact && styles.productModalCompact]}>
            <Text style={styles.modalTitle}>ဝန်ထမ်း Account အသစ်</Text>
            <TextInput style={styles.formInput} placeholder="Full name" value={employeeForm.fullName} onChangeText={value => setEmployeeForm({ ...employeeForm, fullName: value })} />
            <TextInput style={styles.formInput} placeholder="Username" value={employeeForm.username} onChangeText={value => setEmployeeForm({ ...employeeForm, username: value })} autoCapitalize="none" />
            <TextInput style={styles.formInput} placeholder="Password" value={employeeForm.password} onChangeText={value => setEmployeeForm({ ...employeeForm, password: value })} secureTextEntry />
            <View style={styles.paymentRow}>
              {(['CASHIER', 'MANAGER'] as EmployeeRole[]).map(role => (
                <TouchableOpacity key={role} style={[styles.paymentChip, employeeForm.role === role && styles.paymentChipActive]} onPress={() => setEmployeeForm({ ...employeeForm, role })}>
                  <Text style={[styles.paymentText, employeeForm.role === role && styles.paymentTextActive]}>{role}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setUserModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButtonSmall} onPress={createEmployee} disabled={busy}>
                <Text style={styles.primaryButtonSmallText}>Create</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={selectedOrder !== null} transparent animationType="fade" onRequestClose={() => setSelectedOrder(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedOrder(null)}>
          <Pressable style={[styles.productModal, isCompact && styles.productModalCompact]}>
            <Text style={styles.modalTitle}>Order Detail / Refund</Text>
            <Text style={styles.productMeta}>{selectedOrder?.orderNumber}</Text>
            {(selectedOrder?.items || []).map(item => (
              <TouchableOpacity key={item.id} style={[styles.cartLine, refundItemId === String(item.id) && styles.selectedLine]} onPress={() => setRefundItemId(String(item.id))}>
                <View style={styles.cartLineInfo}>
                  <Text style={styles.cartLineName}>{item.productName}</Text>
                  <Text style={styles.productMeta}>{item.quantity} x {formatCurrency(item.unitPrice)} = {formatCurrency(item.totalPrice)}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <View style={styles.formRow}>
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Refund qty" value={refundQty} onChangeText={setRefundQty} keyboardType="numeric" />
              <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Reason" value={refundReason} onChangeText={setRefundReason} />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setSelectedOrder(null)}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerButton} onPress={submitRefund} disabled={busy || !refundItemId}>
                <Text style={styles.primaryButtonSmallText}>Refund</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const LoadingScreen = ({ text }: { text: string }) => (
  <View style={styles.loadingScreen}>
    <ActivityIndicator color={COLORS.primary} size="large" />
    <Text style={styles.loadingText}>{text}</Text>
  </View>
);

const NavButton = ({ label, mm, icon, active, compact, onPress }: {
  label: string;
  mm: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  compact: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={[styles.navButton, active && styles.navButtonActive, compact && styles.navButtonCompact]} onPress={onPress}>
    <Ionicons name={icon} size={20} color={active ? COLORS.white : COLORS.gray} />
    <Text style={[styles.navButtonText, active && styles.navButtonTextActive]}>{compact ? mm : label}</Text>
  </TouchableOpacity>
);

const sectionTitle = (section: WebSection) => ({
  dashboard: 'Dashboard',
  pos: 'ရောင်းချရန်',
  inventory: 'ပစ္စည်းစာရင်း',
  reports: 'အစီရင်ခံစာ',
  stockIn: 'Stock In',
  users: 'Users',
  settings: 'Settings',
}[section]);

const DashboardView = ({ summary, orders, products, lowStock, expiring, canSeeProfit, isDesktop }: {
  summary: ReportSummary;
  orders: OrderResponse[];
  products: Product[];
  lowStock: Product[];
  expiring: Product[];
  canSeeProfit: boolean;
  isDesktop: boolean;
}) => (
  <ScrollView style={styles.content}>
    <View style={[styles.metricGrid, isDesktop && styles.metricGridDesktop]}>
      <Metric title="ယနေ့ရောင်းရငွေ" value={formatCurrency(summary.totalSales)} icon="cash-outline" tone="#FFF3E6" />
      <Metric title="Orders" value={String(summary.totalOrders)} icon="receipt-outline" tone="#EAF3FF" />
      <Metric title="Items sold" value={String(summary.itemsSold)} icon="cube-outline" tone="#EAF8F1" />
      {canSeeProfit && <Metric title="ယနေ့အမြတ်" value={formatCurrency(summary.totalProfit)} icon="trending-up-outline" tone="#FFF0F0" />}
    </View>
    <View style={[styles.twoColumn, isDesktop && styles.twoColumnDesktop]}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Alerts</Text>
        <AlertRow icon="warning-outline" title="Low stock" value={`${lowStock.length} items`} color={COLORS.secondary} />
        <AlertRow icon="time-outline" title="Expire soon" value={`${expiring.length} items`} color={COLORS.danger} />
        <AlertRow icon="cube-outline" title="Total products" value={`${products.length} items`} color={COLORS.info} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Recent sells</Text>
        {orders.slice(0, 6).map(order => <OrderRow key={order.id} order={order} />)}
      </View>
    </View>
  </ScrollView>
);

const ReportsView = ({
  summary,
  orders,
  canSeeProfit,
  isDesktop,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  closing,
  closeDay,
  onOrderPress,
  downloadReport,
}: {
  summary: ReportSummary;
  orders: OrderResponse[];
  canSeeProfit: boolean;
  isDesktop: boolean;
  startDate: string;
  endDate: string;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  closing: DailyClosing | null;
  closeDay: () => void;
  onOrderPress: (order: OrderResponse) => void;
  downloadReport: (type: 'pdf' | 'excel') => void;
}) => (
  <ScrollView style={styles.content}>
    <View style={styles.sectionToolbar}>
      <TextInput style={[styles.formInput, styles.dateInput]} value={startDate} onChangeText={setStartDate} placeholder="Start YYYY-MM-DD" />
      <TextInput style={[styles.formInput, styles.dateInput]} value={endDate} onChangeText={setEndDate} placeholder="End YYYY-MM-DD" />
      <TouchableOpacity style={styles.secondaryButton} onPress={() => downloadReport('pdf')}><Text style={styles.secondaryButtonText}>PDF</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => downloadReport('excel')}><Text style={styles.secondaryButtonText}>Excel</Text></TouchableOpacity>
    </View>
    <View style={[styles.metricGrid, isDesktop && styles.metricGridDesktop]}>
      <Metric title="စုစုပေါင်းရောင်းရငွေ" value={formatCurrency(summary.totalSales)} icon="bar-chart-outline" tone="#EAF3FF" />
      <Metric title="Refund" value={formatCurrency(summary.refundAmount)} icon="return-up-back-outline" tone="#FFF0F0" />
      <Metric title="Orders" value={String(summary.totalOrders)} icon="receipt-outline" tone="#EAF8F1" />
      {canSeeProfit && <Metric title="အမြတ်" value={formatCurrency(summary.totalProfit)} icon="trending-up-outline" tone="#FFF3E6" />}
    </View>
    {canSeeProfit && (
      <TouchableOpacity style={[styles.closingBox, closing && styles.closingBoxDone]} onPress={closing ? undefined : closeDay}>
        <Ionicons name={closing ? 'checkmark-done-outline' : 'lock-closed-outline'} size={22} color={closing ? COLORS.success : COLORS.secondary} />
        <View style={styles.rankInfo}>
          <Text style={styles.rankName}>{closing ? 'Daily Closing လုပ်ပြီး' : 'Daily Closing လုပ်မည်'}</Text>
          <Text style={styles.productMeta}>{closing ? `${closing.closedByName} • ${new Date(closing.closedAt).toLocaleString()}` : `${endDate} အတွက် report snapshot သိမ်းမည်`}</Text>
        </View>
      </TouchableOpacity>
    )}
    <View style={[styles.twoColumn, isDesktop && styles.twoColumnDesktop]}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Top products</Text>
        {summary.topProducts.slice(0, 8).map((item, index) => (
          <View key={item.productId} style={styles.rankRow}>
            <Text style={styles.rankNo}>{index + 1}</Text>
            <View style={styles.rankInfo}>
              <Text style={styles.rankName}>{item.productName}</Text>
              <Text style={styles.rankMeta}>{item.quantity} items • {formatCurrency(item.sales)}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Orders</Text>
        {orders.map(order => <OrderRow key={order.id} order={order} onPress={() => onOrderPress(order)} />)}
      </View>
    </View>
  </ScrollView>
);
const Metric = ({ title, value, icon, tone }: {
  title: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone: string;
}) => (
  <View style={styles.metric}>
    <View style={[styles.metricIcon, { backgroundColor: tone }]}>
      <Ionicons name={icon} size={22} color={COLORS.primary} />
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricTitle}>{title}</Text>
  </View>
);

const AlertRow = ({ icon, title, value, color }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  value: string;
  color: string;
}) => (
  <View style={styles.alertRow}>
    <Ionicons name={icon} size={20} color={color} />
    <Text style={styles.alertTitle}>{title}</Text>
    <Text style={styles.alertValue}>{value}</Text>
  </View>
);

const ProductTile = ({ product, onAdd }: { product: Product; onAdd: () => void }) => (
  <TouchableOpacity style={styles.productTile} onPress={onAdd}>
    <View style={styles.productTop}>
      <View style={styles.productIcon}><Ionicons name="cube-outline" size={22} color={COLORS.primary} /></View>
      <View style={[styles.stockPill, product.stock <= 10 && styles.stockPillWarn]}>
        <Text style={styles.stockPillText}>{product.stock} {product.unitName || 'ခု'}</Text>
      </View>
    </View>
    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
    <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
    <Text style={styles.productMeta} numberOfLines={1}>{product.barcode || 'Barcode မရှိ'}</Text>
  </TouchableOpacity>
);

const InventoryCard = ({ product, canManage, onEdit, onDelete }: {
  product: Product;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) => (
  <View style={styles.inventoryCard}>
    <View style={styles.productTop}>
      <Text style={styles.inventoryName}>{product.name}</Text>
      <Text style={[styles.inventoryStock, product.stock <= 10 && styles.warnText]}>{product.stock} {product.unitName || 'ခု'}</Text>
    </View>
    <Text style={styles.productMeta}>ရောင်းစျေး {formatCurrency(product.price)} • အရင်း {formatCurrency(product.costPrice || 0)}</Text>
    {(product.wholesalePrice || product.vipPrice || product.packUnitName) ? (
      <Text style={styles.productMeta}>
        {product.wholesalePrice ? `Wholesale ${formatCurrency(product.wholesalePrice)} ` : ''}
        {product.vipPrice ? `VIP ${formatCurrency(product.vipPrice)} ` : ''}
        {product.packUnitName ? `${product.packUnitName}=${product.packSize || 1}${product.unitName || 'ခု'}` : ''}
      </Text>
    ) : null}
    <Text style={styles.productMeta}>Barcode: {product.barcode || '-'}</Text>
    <Text style={styles.productMeta}>Expire: {product.expiryDate || '-'}</Text>
    {canManage && (
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onEdit}><Text style={styles.secondaryButtonText}>Edit</Text></TouchableOpacity>
        <TouchableOpacity style={styles.dangerOutlineButton} onPress={onDelete}><Text style={styles.dangerText}>Delete</Text></TouchableOpacity>
      </View>
    )}
  </View>
);
const CartPanel = ({ cart, total, payment, setPayment, changeQty, checkout, busy }: {
  cart: CartLine[];
  total: number;
  payment: PaymentMethod;
  setPayment: (method: PaymentMethod) => void;
  changeQty: (line: CartLine, delta: number) => void;
  checkout: () => void;
  busy: boolean;
}) => (
  <View style={styles.cartPanel}>
    <Text style={styles.panelTitle}>Cart</Text>
    <ScrollView style={styles.cartList}>
      {cart.length === 0 ? <Text style={styles.emptyText}>ရောင်းမည့် product ရွေးပါ</Text> : cart.map(line => (
        <View key={`${line.product.id}-${line.unitPrice}-${line.label}`} style={styles.cartLine}>
          <View style={styles.cartLineInfo}>
            <Text style={styles.cartLineName}>{line.product.name}</Text>
            <Text style={styles.productMeta}>{formatCurrency(line.unitPrice)} x {line.quantity} {line.label}</Text>
          </View>
          <View style={styles.qtyGroup}>
            <TouchableOpacity style={styles.qtyButton} onPress={() => changeQty(line, -1)}><Text>-</Text></TouchableOpacity>
            <Text style={styles.qtyText}>{line.quantity}</Text>
            <TouchableOpacity style={styles.qtyButton} onPress={() => changeQty(line, 1)}><Text>+</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
    <View style={styles.paymentRow}>
      {paymentMethods.map(method => (
        <TouchableOpacity key={method} style={[styles.paymentChip, payment === method && styles.paymentChipActive]} onPress={() => setPayment(method)}>
          <Text style={[styles.paymentText, payment === method && styles.paymentTextActive]}>{paymentLabel(method)}</Text>
        </TouchableOpacity>
      ))}
    </View>
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>စုစုပေါင်း</Text>
      <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
    </View>
    <TouchableOpacity style={[styles.primaryButton, cart.length === 0 && styles.disabledButton]} onPress={checkout} disabled={busy || cart.length === 0}>
      {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>ငွေရှင်းမည်</Text>}
    </TouchableOpacity>
  </View>
);

const StockInView = ({ products, purchases, form, setForm, onSubmit, busy }: {
  products: Product[];
  purchases: PurchaseResponse[];
  form: { productId: string; supplierName: string; supplierPhone: string; quantity: string; unitCost: string; note: string };
  setForm: (value: any) => void;
  onSubmit: () => void;
  busy: boolean;
}) => (
  <ScrollView style={styles.content}>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Stock In</Text>
      <TextInput style={styles.formInput} placeholder="Product ID" value={form.productId} onChangeText={value => setForm({ ...form, productId: value })} />
      <View style={styles.formRow}>
        <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Quantity" value={form.quantity} onChangeText={value => setForm({ ...form, quantity: value })} keyboardType="numeric" />
        <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Unit cost" value={form.unitCost} onChangeText={value => setForm({ ...form, unitCost: value })} keyboardType="numeric" />
      </View>
      <View style={styles.formRow}>
        <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Supplier" value={form.supplierName} onChangeText={value => setForm({ ...form, supplierName: value })} />
        <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Phone" value={form.supplierPhone} onChangeText={value => setForm({ ...form, supplierPhone: value })} />
      </View>
      <TextInput style={styles.formInput} placeholder="Note" value={form.note} onChangeText={value => setForm({ ...form, note: value })} />
      <TouchableOpacity style={styles.primaryButtonSmall} onPress={onSubmit} disabled={busy}>
        <Text style={styles.primaryButtonSmallText}>Stock In သိမ်းမည်</Text>
      </TouchableOpacity>
      <Text style={styles.productMeta}>Product ID သိရန် Inventory card တွင်ကြည့်နိုင်သည်။ Total products: {products.length}</Text>
    </View>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Recent Stock In</Text>
      {purchases.slice(0, 20).map(item => (
        <View key={item.id} style={styles.orderRow}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNo}>{item.product?.name || `Product #${item.id}`}</Text>
            <Text style={styles.productMeta}>{item.quantity} x {formatCurrency(item.unitCost)} • {item.supplier?.name || '-'}</Text>
          </View>
          <Text style={styles.orderAmount}>{formatCurrency(item.totalCost)}</Text>
        </View>
      ))}
    </View>
  </ScrollView>
);

const UsersView = ({ users, currentUserId, onAdd, onToggle }: {
  users: ShopUser[];
  currentUserId: number;
  onAdd: () => void;
  onToggle: (user: ShopUser) => void;
}) => (
  <ScrollView style={styles.content}>
    <View style={styles.sectionToolbar}>
      <Text style={styles.panelTitle}>ဝန်ထမ်း Account များ</Text>
      <TouchableOpacity style={styles.primaryButtonSmall} onPress={onAdd}><Text style={styles.primaryButtonSmallText}>Add User</Text></TouchableOpacity>
    </View>
    {users.map(item => (
      <View key={item.id} style={styles.inventoryCard}>
        <View style={styles.productTop}>
          <View>
            <Text style={styles.inventoryName}>{item.fullName}</Text>
            <Text style={styles.productMeta}>@{item.username} • {item.role}</Text>
          </View>
          <Text style={[styles.inventoryStock, item.active ? undefined : styles.warnText]}>{item.active ? 'Active' : 'Disabled'}</Text>
        </View>
        {item.role !== 'ADMIN' && item.id !== currentUserId && (
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => onToggle(item)}>
              <Text style={styles.secondaryButtonText}>{item.active ? 'Disable' : 'Enable'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ))}
  </ScrollView>
);

const SettingsView = ({ settings, setSettings, saveSettings, user, lowStock, expiring }: {
  settings: AlertSettings;
  setSettings: (value: AlertSettings) => void;
  saveSettings: () => void;
  user: WebUser;
  lowStock: number;
  expiring: number;
}) => (
  <ScrollView style={styles.content}>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>ဆိုင်အခြေအနေ</Text>
      <Text style={styles.productMeta}>Shop: {user.shopName}</Text>
      <Text style={styles.productMeta}>User: {user.fullName} • {user.role}</Text>
      <Text style={styles.productMeta}>Subscription: {user.subscriptionStatus || '-'}</Text>
    </View>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Alert Settings</Text>
      <View style={styles.formRow}>
        <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Expiry days" value={String(settings.expiryDays)} onChangeText={value => setSettings({ ...settings, expiryDays: Number(value) || 0 })} keyboardType="numeric" />
        <TextInput style={[styles.formInput, styles.formHalf]} placeholder="Low stock count" value={String(settings.lowStockCount)} onChangeText={value => setSettings({ ...settings, lowStockCount: Number(value) || 0 })} keyboardType="numeric" />
      </View>
      <Text style={styles.productMeta}>Current: low stock {lowStock}, expire soon {expiring}</Text>
      <TouchableOpacity style={styles.primaryButtonSmall} onPress={saveSettings}><Text style={styles.primaryButtonSmallText}>Save Settings</Text></TouchableOpacity>
    </View>
  </ScrollView>
);

const OrderRow = ({ order, onPress }: { order: OrderResponse; onPress?: () => void }) => (
  <TouchableOpacity style={styles.orderRow} onPress={onPress} disabled={!onPress}>
    <View style={styles.orderIcon}><Ionicons name="receipt-outline" size={18} color={COLORS.primary} /></View>
    <View style={styles.orderInfo}>
      <Text style={styles.orderNo}>{order.orderNumber}</Text>
      <Text style={styles.productMeta}>{new Date(order.createdAt).toLocaleString()} • {paymentLabel(order.paymentMethod)}</Text>
    </View>
    <Text style={styles.orderAmount}>{formatCurrency(order.totalAmount)}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: '#F4F6F8' },
  main: { flex: 1, minWidth: 0 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  loadingText: { marginTop: 10, color: COLORS.gray, fontFamily: FONTS.regular },
  loginShell: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: COLORS.primary },
  loginPanel: { width: 440, backgroundColor: COLORS.white, borderRadius: 8, padding: 28, alignItems: 'stretch' },
  loginPanelCompact: { width: '100%' },
  brandMark: { width: 64, height: 64, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  loginTitle: { fontFamily: FONTS.bold, fontSize: 28, color: COLORS.dark },
  loginSub: { marginTop: 6, marginBottom: 22, fontFamily: FONTS.regular, fontSize: 14, color: COLORS.gray, lineHeight: 22 },
  loginInput: { minHeight: 48, borderWidth: 1, borderColor: '#DDE3EA', borderRadius: 8, paddingHorizontal: 14, marginBottom: 12, fontFamily: FONTS.regular, backgroundColor: COLORS.white },
  loginHint: { marginTop: 14, fontFamily: FONTS.regular, color: COLORS.gray, fontSize: 12, lineHeight: 19 },
  nav: { width: 248, backgroundColor: '#14284D', padding: 16 },
  navCompact: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 72, flexDirection: 'row', alignItems: 'center', padding: 8, zIndex: 10 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  navLogo: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: 17 },
  navShop: { fontFamily: FONTS.regular, color: COLORS.white + 'B8', fontSize: 11, marginTop: 2 },
  navButton: { minHeight: 46, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, marginBottom: 8 },
  navButtonCompact: { flex: 1, minHeight: 54, justifyContent: 'center', gap: 4, paddingHorizontal: 4, marginBottom: 0 },
  navButtonActive: { backgroundColor: COLORS.primary },
  navButtonText: { fontFamily: FONTS.medium, color: COLORS.gray, fontSize: 13 },
  navButtonTextActive: { color: COLORS.white },
  navSpacer: { flex: 1 },
  navUser: { fontFamily: FONTS.medium, color: COLORS.white, fontSize: 13, marginBottom: 10 },
  logout: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: COLORS.white + '33', alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: COLORS.white, fontFamily: FONTS.medium },
  topbar: { minHeight: 78, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#E4E8EE', paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topbarCompact: { paddingHorizontal: 14, paddingTop: 8 },
  pageTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: 24 },
  pageSub: { marginTop: 3, fontFamily: FONTS.regular, color: COLORS.gray, fontSize: 12 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshButton: { minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: '#DDE3EA', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.white },
  refreshText: { fontFamily: FONTS.medium, color: COLORS.primary, fontSize: 13 },
  content: { flex: 1, padding: 18, paddingBottom: 90 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricGridDesktop: { flexWrap: 'nowrap' },
  metric: { flex: 1, minWidth: 180, backgroundColor: COLORS.white, borderRadius: 8, padding: 18, borderWidth: 1, borderColor: '#E8EDF3' },
  metricIcon: { width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricValue: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: 24 },
  metricTitle: { marginTop: 4, fontFamily: FONTS.regular, color: COLORS.gray, fontSize: 12 },
  twoColumn: { gap: 14, marginTop: 14 },
  twoColumnDesktop: { flexDirection: 'row' },
  panel: { flex: 1, backgroundColor: COLORS.white, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#E8EDF3' },
  panelTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: 18, marginBottom: 12 },
  alertRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  alertTitle: { flex: 1, fontFamily: FONTS.medium, color: COLORS.dark },
  alertValue: { fontFamily: FONTS.bold, color: COLORS.primary },
  posLayout: { flex: 1, padding: 14, paddingBottom: 86 },
  posLayoutDesktop: { flexDirection: 'row', gap: 14, paddingBottom: 14 },
  posProducts: { flex: 1, minWidth: 0 },
  search: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: '#DDE3EA', paddingHorizontal: 14, backgroundColor: COLORS.white, fontFamily: FONTS.regular, marginBottom: 12 },
  gridRow: { gap: 12 },
  productTile: { flex: 1, minHeight: 188, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: '#E8EDF3', padding: 14, marginBottom: 12 },
  productTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  productIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  stockPill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#E7F7EF' },
  stockPillWarn: { backgroundColor: '#FFF4D8' },
  stockPillText: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: 12 },
  productName: { marginTop: 16, minHeight: 48, fontFamily: FONTS.bold, color: COLORS.dark, fontSize: 18, lineHeight: 27 },
  productPrice: { marginTop: 8, fontFamily: FONTS.bold, color: COLORS.primary, fontSize: 22 },
  productMeta: { marginTop: 4, fontFamily: FONTS.regular, color: COLORS.gray, fontSize: 12, lineHeight: 20 },
  cartPanel: { backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: '#E8EDF3', padding: 16, minHeight: 320, flex: 1 },
  cartList: { maxHeight: 360 },
  cartLine: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEF1F5', paddingVertical: 10, gap: 10 },
  cartLineInfo: { flex: 1 },
  cartLineName: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: 14 },
  qtyGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyButton: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: '#DDE3EA', alignItems: 'center', justifyContent: 'center' },
  qtyText: { minWidth: 22, textAlign: 'center', fontFamily: FONTS.bold, color: COLORS.dark },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  paymentChip: { minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: '#DDE3EA', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  paymentChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  paymentText: { fontFamily: FONTS.medium, color: COLORS.dark, fontSize: 12 },
  paymentTextActive: { color: COLORS.white },
  selectedLine: { backgroundColor: COLORS.primary + '10' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 16 },
  totalLabel: { fontFamily: FONTS.medium, color: COLORS.gray },
  totalValue: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: 24 },
  primaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: 15 },
  disabledButton: { opacity: 0.45 },
  emptyText: { color: COLORS.gray, fontFamily: FONTS.regular, paddingVertical: 20 },
  sectionToolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  dateInput: { flex: 1, marginBottom: 0 },
  toolbarSearch: { flex: 1, marginBottom: 0 },
  primaryButtonSmall: { minHeight: 42, borderRadius: 8, backgroundColor: COLORS.primary, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryButtonSmallText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: 13 },
  dangerButton: { minHeight: 42, borderRadius: 8, backgroundColor: COLORS.danger, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  inventoryCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: '#E8EDF3', padding: 14, marginBottom: 12 },
  inventoryName: { flex: 1, fontFamily: FONTS.bold, color: COLORS.dark, fontSize: 16 },
  inventoryStock: { fontFamily: FONTS.bold, color: COLORS.primary },
  warnText: { color: COLORS.danger },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dangerOutlineButton: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: COLORS.danger, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: FONTS.medium, color: COLORS.danger },
  closingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E8EDF3', marginTop: 14 },
  closingBoxDone: { borderColor: COLORS.success + '77', backgroundColor: COLORS.success + '08' },
  orderRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  orderIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  orderInfo: { flex: 1 },
  orderNo: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: 13 },
  orderAmount: { fontFamily: FONTS.bold, color: COLORS.primary, fontSize: 15 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  rankNo: { width: 24, fontFamily: FONTS.bold, color: COLORS.secondary, fontSize: 16 },
  rankInfo: { flex: 1 },
  rankName: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: 14 },
  rankMeta: { fontFamily: FONTS.regular, color: COLORS.gray, fontSize: 12, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  productModal: { width: 520, maxWidth: '100%', backgroundColor: COLORS.white, borderRadius: 8, padding: 18 },
  productModalCompact: { width: '100%' },
  modalTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: 18, marginBottom: 12 },
  formInput: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: '#DDE3EA', paddingHorizontal: 12, marginBottom: 10, fontFamily: FONTS.regular },
  formRow: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  secondaryButton: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: '#DDE3EA', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: FONTS.medium, color: COLORS.dark },
});
