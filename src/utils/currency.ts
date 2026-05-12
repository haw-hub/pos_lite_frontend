// src/utils/currency.ts

// Format number as Myanmar Kyat
export const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) return '0 ကျပ်';
  
  // Format with Myanmar number system (optional)
  const formattedNumber = new Intl.NumberFormat('my-MM', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  
  return `${formattedNumber} ကျပ်`;
};

// Format without currency symbol (just number)
export const formatNumber = (amount: number): string => {
  if (isNaN(amount)) return '0';
  
  return new Intl.NumberFormat('my-MM', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Parse currency string to number
export const parseCurrency = (value: string): number => {
  // Remove all non-numeric characters except decimal point
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Calculate change
export const calculateChange = (received: number, total: number): number => {
  return Math.max(0, received - total);
};

// Format for receipt (shorter version)
export const formatCurrencyShort = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ကျပ်`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K ကျပ်`;
  }
  return formatCurrency(amount);
};

// Add tax to amount
export const addTax = (amount: number, taxRate: number = 0): number => {
  return amount + (amount * taxRate) / 100;
};

// Calculate subtotal from items
export const calculateSubtotal = (items: Array<{ quantity: number; price: number }>): number => {
  return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
};

// Format for input display
export const formatForInput = (amount: number): string => {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Myanmar number converter (optional - converts English to Myanmar numbers)
export const toMyanmarNumber = (number: number): string => {
  const myanmarDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  return number.toString().replace(/\d/g, digit => myanmarDigits[parseInt(digit)]);
};

// English number converter (convert Myanmar to English numbers)
export const toEnglishNumber = (myanmarNumber: string): string => {
  const myanmarDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  let result = myanmarNumber;
  myanmarDigits.forEach((digit, index) => {
    result = result.replace(new RegExp(digit, 'g'), index.toString());
  });
  return result;
};

// Check if amount is valid
export const isValidAmount = (amount: number): boolean => {
  return !isNaN(amount) && amount >= 0 && isFinite(amount);
};

// Round to nearest (for cash payments)
export const roundToNearest = (amount: number, nearest: number = 50): number => {
  return Math.round(amount / nearest) * nearest;
};

// Get currency symbol
export const getCurrencySymbol = (): string => {
  return 'MMK';
};

// Format for barcode price (no spaces)
export const formatCurrencyCompact = (amount: number): string => {
  return amount.toString().replace(/,/g, '');
};