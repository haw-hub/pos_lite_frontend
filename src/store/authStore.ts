// src/store/authStore.ts
import { create } from 'zustand';
import { authApi, AuthResponse } from '../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { switchUserDatabase } from '../database/sqlite';
import { useProductStore } from './productStore';
import { useCartStore } from './cartStore';
import { syncService } from '../services/sync/syncService';

interface AuthState {
  user: AuthResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username: string, password: string) => {
    try {
      const response = await authApi.login({ username, password });
      syncService.destroy();
      await switchUserDatabase(response.username);
      useProductStore.setState({ products: [], deletedProducts: [], isInitialized: false });
      useCartStore.getState().clearCart();
      set({ user: response, isAuthenticated: true });
      await syncService.init();
      syncService.forceSync().catch(() => undefined);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  },

  logout: async () => {
    await authApi.logout();
    syncService.destroy();
    await switchUserDatabase(null);
    useProductStore.setState({ products: [], deletedProducts: [], isInitialized: false });
    useCartStore.getState().clearCart();
    set({ user: null, isAuthenticated: false });
    await syncService.init();
  },

  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userData = await AsyncStorage.getItem('user_data');
      
      if (token && userData) {
        const user = JSON.parse(userData);
        await switchUserDatabase(user.username);
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },
}));
