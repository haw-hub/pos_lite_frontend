// src/config/env.ts
export const ENV = {
  // For Android emulator
<<<<<<< HEAD
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.14:8081/api',
  // For physical device, use your computer's IP
  // API_URL: 'http://192.168.1.100:8080/api',
=======
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.200.133:8081/api',
  // For physical device, use your computer's IP
  // API_URL: 'http://192.168.200.133:8080/api',
>>>>>>> 8db739e (initial commint main)
  
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
// EXPO_PUBLIC_API_URL=http://10.0.2.2:8080/api