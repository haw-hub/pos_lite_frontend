// src/config/env.ts
import { Platform } from 'react-native';

const defaultApiUrl =
  Platform.OS === 'web'
    ? 'http://localhost:8080/api'
    : 'https://pos-api-proxy.dev-htetaungwai.workers.dev/api';

const fallbackApiUrl = 'https://pos-lite-backend-g7hs.onrender.com/api';

export const ENV = {
  // Use EXPO_PUBLIC_API_URL in .env for a physical device or production.
  API_URL: process.env.EXPO_PUBLIC_API_URL || defaultApiUrl,
  // Some mobile networks/DNS providers can fail to resolve the Cloudflare Worker.
  // The app retries this public Render endpoint only when that network failure occurs.
  FALLBACK_API_URL: fallbackApiUrl,
  
  // Render's free service can take a few minutes to wake after being idle.
  TIMEOUT: 240000,
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
