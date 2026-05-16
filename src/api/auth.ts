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
}

export interface AuthResponse {
  token: string;
  username: string;
  role: string;
  fullName: string;
}

export interface SignupResponse {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  message: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', credentials);
    const { token, username, role, fullName } = response.data;
    
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('user_data', JSON.stringify({ username, role, fullName }));
    
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