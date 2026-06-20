export const SHOP_FEATURES = {
  DAILY_CLOSING: 'DAILY_CLOSING',
  MULTI_PRICE: 'MULTI_PRICE',
  STOCK_IN: 'STOCK_IN',
  VOUCHER_PRINT: 'VOUCHER_PRINT',
} as const;

export type ShopFeature = typeof SHOP_FEATURES[keyof typeof SHOP_FEATURES];

export const hasShopFeature = (features: string[] | undefined | null, feature: ShopFeature) =>
  Boolean(features?.includes(feature));
