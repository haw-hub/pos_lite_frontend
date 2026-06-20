// src/api/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './client';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SignupData {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  phone?: string;
  shopName?: string;
}

export interface AuthResponse {
  token: string;
  userId: number;
  username: string;
  role: string;
  fullName: string;
  shopId: number;
  shopName: string;
  shopLogoUrl?: string;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  enabledFeatures: string[];
}

export interface SignupResponse {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  shopId: number;
  shopName: string;
  message: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', credentials);
    const { token, userId, username, role, fullName, shopId, shopName, shopLogoUrl, subscriptionStatus, trialEndsAt, subscriptionEndsAt, enabledFeatures = [] } = response.data;
    
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('user_data', JSON.stringify({
      userId, username, role, fullName, shopId, shopName, shopLogoUrl,
      subscriptionStatus, trialEndsAt, subscriptionEndsAt, enabledFeatures,
    }));
    
    return response.data;
  },

  signup: async (data: SignupData): Promise<SignupResponse> => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user_data');
  },

  getToken: async (): Promise<string | null> => {
    return await AsyncStorage.getItem('auth_token');
  },
};
