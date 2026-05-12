// src/api/auth.ts
import apiClient from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  role: string;
  fullName: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', credentials);
    const { token, ...user } = response.data;
    
    // Store token securely [citation:10]
    await SecureStore.setItemAsync('auth_token', token);
    await AsyncStorage.setItem('user_data', JSON.stringify(user));
    
    return response.data;
  },

  logout: async (): Promise<void> => {
    await SecureStore.deleteItemAsync('auth_token');
    await AsyncStorage.removeItem('user_data');
  },

  getToken: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync('auth_token');
  },
};