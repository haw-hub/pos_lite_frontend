import { SHOP_FEATURES, ShopFeature, hasShopFeature } from '../config/features';
import { useAuthStore } from '../store/authStore';

export const useFeature = (feature: ShopFeature) =>
  useAuthStore(state => hasShopFeature(state.user?.enabledFeatures, feature));

export { SHOP_FEATURES };
