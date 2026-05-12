// src/config/theme.ts
export const COLORS = {
  primary: '#2E7D32',    // Myanmar green
  secondary: '#FF9800',   // Orange accent
  success: '#4CAF50',
  danger: '#F44336',
  warning: '#FFC107',
  info: '#2196F3',
  dark: '#333333',
  light: '#F5F5F5',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#9E9E9E',
  grayLight: '#E0E0E0',
};

export const SIZES = {
  // Base sizes
  base: 8,
  small: 12,
  font: 14,
  medium: 16,
  large: 18,
  xlarge: 24,
  xxlarge: 32,
  
  // Button sizes for POS (large for easy tapping)
  buttonHeight: 60,
  buttonLarge: 80,
  
  // Spacing
  padding: 16,
  margin: 16,
  borderRadius: 12,
};

export const FONTS = {
  regular: 'NotoSansMyanmar_400Regular',
  medium: 'NotoSansMyanmar_500Medium',
  semiBold: 'NotoSansMyanmar_600SemiBold',
  bold: 'NotoSansMyanmar_700Bold',
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
};