// src/api/client.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';

const apiClient = axios.create({
  baseURL: ENV.API_URL,
  timeout: ENV.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    console.log(`${config.method?.toUpperCase()} -> ${config.baseURL}${config.url}`);

    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Auth token attached:', Boolean(token));

    return config;
  },
  (error) => {
    console.error('Request Error:', error.message);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log(`${response.status} <- ${response.config.url}`);
    return response;
  },
  async (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('Timeout - Backend not responding');
    } else if (error.code === 'ERR_NETWORK') {
      console.error('Network Error - Cannot reach backend');
      console.error(`   URL: ${error.config?.baseURL}`);
      console.error('\n   CHECKLIST:');
      console.error('   1. Backend running? mvn spring-boot:run');
      console.error('   2. Phone and computer on same WiFi network?');
      console.error('   3. Windows Firewall blocking port 8080?');
      console.error('   4. Backend bound to 0.0.0.0?');
    } else if (error.response?.status === 401) {
      console.error('Unauthorized - Please login again');
      await AsyncStorage.multiRemove(['auth_token', 'user_data']);
      const { useAuthStore } = await import('../store/authStore');
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } else if (error.response?.status === 403) {
      console.error('Forbidden - Your account cannot access this resource');
    } else if (error.response?.status === 402 && error.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
      console.error('Subscription required - Shop access is paused');
      const { useAuthStore } = await import('../store/authStore');
      const { subscriptionService } = await import('../services/subscription/subscriptionService');
      const subscriptionState = await subscriptionService.blockFromServer();
      useAuthStore.setState({ subscriptionRequired: true, subscriptionState });
    } else if (error.response) {
      console.error(`HTTP ${error.response.status}: ${error.response.data?.message || error.message}`);
    } else {
      console.error('Error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
