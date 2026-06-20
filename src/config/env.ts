// src/config/env.ts
import { Platform } from 'react-native';

const defaultApiUrl =
  Platform.OS === 'web'
    ? 'http://localhost:8080/api'
    : 'http://192.168.0.106:8080/api';

export const ENV = {
  // Use EXPO_PUBLIC_API_URL in .env for a physical device or production.
  API_URL: process.env.EXPO_PUBLIC_API_URL || defaultApiUrl,
  
  TIMEOUT: 30000,
  SYNC_INTERVAL: 300000, // 5 minutes
  
  // App settings
  APP_NAME: 'POS Myanmar',
  CURRENCY: 'MMK',
  TAX_RATE: 0,
  
  // Features
  ENABLE_PRINTING: true,
  ENABLE_BARCODE_SCANNER: true,
};

// Create .env file in project root
// EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:8080/api
