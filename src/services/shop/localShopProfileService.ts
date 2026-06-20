import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalShopProfile {
  displayName?: string;
  logoUri?: string;
  updatedAt?: number;
}

const keyFor = (shopId?: number | null, username?: string | null) =>
  `local_shop_profile:${shopId || 'no-shop'}:${username || 'no-user'}`;

export const localShopProfileService = {
  getProfile: async (shopId?: number | null, username?: string | null): Promise<LocalShopProfile> => {
    const raw = await AsyncStorage.getItem(keyFor(shopId, username));
    if (!raw) return {};
    try {
      return JSON.parse(raw) as LocalShopProfile;
    } catch {
      return {};
    }
  },

  saveProfile: async (
    shopId: number | null | undefined,
    username: string | null | undefined,
    profile: LocalShopProfile,
  ) => {
    await AsyncStorage.setItem(
      keyFor(shopId, username),
      JSON.stringify({ ...profile, updatedAt: Date.now() }),
    );
  },
};
