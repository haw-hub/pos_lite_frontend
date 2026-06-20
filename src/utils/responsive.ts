// src/utils/responsive.ts
import { Dimensions, Platform, PixelRatio } from 'react-native';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone SE as base)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 667;

// Scale functions
export const scale = (size: number): number => {
  return (SCREEN_WIDTH / guidelineBaseWidth) * size;
};

export const verticalScale = (size: number): number => {
  return (SCREEN_HEIGHT / guidelineBaseHeight) * size;
};

export const moderateScale = (size: number, factor: number = 0.5): number => {
  return size + (scale(size) - size) * factor;
};

export const fontScale = (size: number, factor: number = 0.5): number => {
  const scaled = moderateScale(size, factor);
  return Platform.OS === 'android' ? Math.round(scaled * 1.12) : scaled;
};

// Get button height for POS (large buttons for easy tapping)
export const getButtonHeight = (size: 'normal' | 'large' = 'normal'): number => {
  if (size === 'large') {
    return moderateScale(80);
  }
  return moderateScale(60);
};

// Get font size responsive
export const getFontSize = (size: number): number => {
  return fontScale(size);
};

// Check if device is tablet
export const isTablet = (): boolean => {
  return SCREEN_WIDTH >= 768;
};

// Get responsive spacing
export const getSpacing = (multiplier: number = 1): number => {
  return moderateScale(8 * multiplier);
};

// Get responsive width percentage
export const getWidthPercent = (percent: number): number => {
  return (SCREEN_WIDTH * percent) / 100;
};

// Get responsive height percentage
export const getHeightPercent = (percent: number): number => {
  return (SCREEN_HEIGHT * percent) / 100;
};

// Check if screen is small
export const isSmallScreen = (): boolean => {
  return SCREEN_WIDTH < 375;
};

// Check if screen is large
export const isLargeScreen = (): boolean => {
  return SCREEN_WIDTH > 414;
};

// Get orientation
export const isPortrait = (): boolean => {
  return SCREEN_HEIGHT > SCREEN_WIDTH;
};

export const isLandscape = (): boolean => {
  return SCREEN_WIDTH > SCREEN_HEIGHT;
};

// Get pixel ratio
export const getPixelRatio = (): number => {
  return PixelRatio.get();
};

// Responsive padding
export const responsivePadding = {
  small: moderateScale(8),
  medium: moderateScale(16),
  large: moderateScale(24),
  xlarge: moderateScale(32),
};

// Responsive margin
export const responsiveMargin = {
  small: moderateScale(8),
  medium: moderateScale(16),
  large: moderateScale(24),
  xlarge: moderateScale(32),
};

// Border radius responsive
export const responsiveBorderRadius = {
  small: moderateScale(4),
  medium: moderateScale(8),
  large: moderateScale(12),
  xlarge: moderateScale(16),
  circle: moderateScale(50),
};

// Grid system for POS
export const grid = {
  containerPadding: moderateScale(16),
  itemMargin: moderateScale(8),
  getItemWidth: (columns: number = 3): number => {
    const totalMargin = (columns - 1) * 8;
    return (SCREEN_WIDTH - 32 - totalMargin) / columns;
  },
};

// POS specific sizes
export const posSizes = {
  productCardHeight: moderateScale(120),
  productImageSize: moderateScale(80),
  buttonLarge: moderateScale(80),
  buttonNormal: moderateScale(60),
  numberPadButton: moderateScale(70),
};
