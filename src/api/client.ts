// src/api/client.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getBaseUrl = (): string => {
  // For development
  if (__DEV__) {
    // Android emulator
    if (Platform.OS === 'android') {
      // Check if running in emulator or physical device
      // For emulator: 10.0.2.2
      // For physical device: use your computer's IP
      
<<<<<<< HEAD
      // Since you're using physical device with IP 172.20.10.14
      console.log('📱 Using Physical Device - Connecting to:', 'http://172.20.10.14:8080/api');
      return 'http://172.20.10.14:8080/api';
=======
      // Since you're using physical device with IP 192.168.200.133
      console.log('📱 Using Physical Device - Connecting to:', 'http://192.168.200.133:8080/api');
      return 'http://192.168.200.133:8080/api';
>>>>>>> 8db739e (initial commint main)
    }
    
    // iOS simulator
    if (Platform.OS === 'ios') {
      return 'http://localhost:8080/api';
    }
  }
  
<<<<<<< HEAD
  return 'http://172.20.10.14:8080/api';
=======
  return 'http://192.168.200.133:8080/api';
>>>>>>> 8db739e (initial commint main)
};

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  async (config) => {
    console.log(`📤 ${config.method?.toUpperCase()} → ${config.baseURL}${config.url}`);
    
    // Add auth token if available
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error.message);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`📥 ${response.status} ← ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Timeout - Backend not responding');
    } else if (error.code === 'ERR_NETWORK') {
      console.error('❌ Network Error - Cannot reach backend');
      console.error(`   URL: ${error.config?.baseURL}`);
      console.error('\n   🔧 CHECKLIST:');
      console.error('   1. Backend running? cd backend-api && mvn spring-boot:run');
      console.error('   2. Phone and computer on same WiFi network?');
      console.error('   3. Windows Firewall blocking port 8080?');
      console.error('   4. Backend bound to 0.0.0.0?');
    } else if (error.response?.status === 401) {
      console.error('❌ Unauthorized - Please login again');
      AsyncStorage.removeItem('auth_token');
    } else if (error.response) {
      console.error(`❌ HTTP ${error.response.status}: ${error.response.data?.message || error.message}`);
    } else {
      console.error('❌ Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;