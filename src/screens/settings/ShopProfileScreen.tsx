import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS, FONTS } from '../../config/theme';
import { useAuthStore } from '../../store/authStore';
import { fontScale, moderateScale } from '../../utils/responsive';
import { localShopProfileService, LocalShopProfile } from '../../services/shop/localShopProfileService';

const logoDirectory = `${FileSystem.documentDirectory || ''}shop-logos/`;

export const ShopProfileScreen = () => {
  const user = useAuthStore(state => state.user);
  const [profile, setProfile] = useState<LocalShopProfile>({});
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const saved = await localShopProfileService.getProfile(user?.shopId, user?.username);
    setProfile(saved);
    setDisplayName(saved.displayName || user?.shopName || '');
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [user?.shopId, user?.username]);

  const saveProfile = async (nextProfile: LocalShopProfile) => {
    setSaving(true);
    try {
      await localShopProfileService.saveProfile(user?.shopId, user?.username, nextProfile);
      setProfile(nextProfile);
      Alert.alert('သိမ်းပြီးပါပြီ', 'ဆိုင်အချက်အလက်ကို ဒီဖုန်းထဲတွင် သိမ်းပြီးပါပြီ။');
    } finally {
      setSaving(false);
    }
  };

  const saveName = async () => {
    const name = displayName.trim();
    if (!name) {
      Alert.alert('ဆိုင်နာမည်လိုအပ်သည်', 'Voucher တွင်ပြမည့် ဆိုင်နာမည်ထည့်ပါ။');
      return;
    }
    await saveProfile({ ...profile, displayName: name });
  };

  const chooseLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission လိုအပ်ပါသည်', 'ဆိုင် Logo ရွေးရန် photos permission ဖွင့်ပေးပါ။');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setSaving(true);
    try {
      if (!FileSystem.documentDirectory) {
        throw new Error('Local storage မရနိုင်ပါ');
      }
      const dirInfo = await FileSystem.getInfoAsync(logoDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(logoDirectory, { intermediates: true });
      }
      const extension = result.assets[0].uri.split('.').pop()?.split('?')[0] || 'jpg';
      const target = `${logoDirectory}${user?.shopId || 'shop'}-${Date.now()}.${extension}`;
      await FileSystem.copyAsync({ from: result.assets[0].uri, to: target });

      const nextProfile = {
        ...profile,
        displayName: displayName.trim() || user?.shopName,
        logoUri: target,
      };
      await localShopProfileService.saveProfile(user?.shopId, user?.username, nextProfile);
      setProfile(nextProfile);
      Alert.alert('Logo သိမ်းပြီးပါပြီ', 'Logo ကို Database မသိမ်းဘဲ ဒီဖုန်းထဲတွင် သိမ်းထားပါသည်။');
    } catch (error: any) {
      Alert.alert('Logo မသိမ်းနိုင်ပါ', error?.message || 'ပြန်ကြိုးစားပါ။');
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = async () => {
    const nextProfile = { ...profile, logoUri: undefined };
    await saveProfile(nextProfile);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.previewCard}>
        <View style={styles.logoPreview}>
          {profile.logoUri ? (
            <Image source={{ uri: profile.logoUri }} style={styles.logoImage} />
          ) : (
            <Ionicons name="storefront-outline" size={moderateScale(42)} color={COLORS.primary} />
          )}
        </View>
        <Text style={styles.previewName} numberOfLines={2}>
          {displayName.trim() || user?.shopName || 'ဆိုင်အမည်'}
        </Text>
        <Text style={styles.previewHint}>Voucher တွင် ဤအချက်အလက်ကို အသုံးပြုပါမည်</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>ဆိုင်နာမည်</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="ဆိုင်နာမည်"
          placeholderTextColor={COLORS.gray}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={saveName} disabled={saving} activeOpacity={1}>
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="save-outline" size={20} color={COLORS.white} />}
          <Text style={styles.primaryText}>ဆိုင်နာမည် သိမ်းမည်</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>ဆိုင် Logo</Text>
        <Text style={styles.helpText}>
          Logo ပုံကို Database ထဲမသိမ်းပါ။ ဒီဖုန်းထဲတွင်သာ သိမ်းထားမည်ဖြစ်ပြီး app ဖျက်လျှင် ပြန်ရွေးရန်လိုနိုင်ပါသည်။
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={chooseLogo} disabled={saving} activeOpacity={1}>
          <Ionicons name="image-outline" size={20} color={COLORS.white} />
          <Text style={styles.primaryText}>{profile.logoUri ? 'Logo ပြောင်းမည်' : 'Logo ရွေးမည်'}</Text>
        </TouchableOpacity>
        {profile.logoUri ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={removeLogo} disabled={saving} activeOpacity={1}>
            <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
            <Text style={styles.secondaryText}>Logo ဖျက်မည်</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  content: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(34),
    gap: moderateScale(14),
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: moderateScale(20),
    borderWidth: 1,
    borderColor: '#E8ECF2',
  },
  logoPreview: {
    width: moderateScale(104),
    height: moderateScale(104),
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#EFF4FB',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  previewName: {
    marginTop: moderateScale(14),
    textAlign: 'center',
    fontFamily: FONTS.bold,
    fontSize: fontScale(21),
    lineHeight: fontScale(34),
    color: COLORS.dark,
    includeFontPadding: true,
  },
  previewHint: {
    marginTop: moderateScale(4),
    textAlign: 'center',
    fontFamily: FONTS.regular,
    fontSize: fontScale(12),
    lineHeight: fontScale(21),
    color: COLORS.gray,
    includeFontPadding: true,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: moderateScale(15),
    borderWidth: 1,
    borderColor: '#E8ECF2',
  },
  label: {
    fontFamily: FONTS.bold,
    fontSize: fontScale(15),
    lineHeight: fontScale(25),
    color: COLORS.dark,
    includeFontPadding: true,
  },
  input: {
    minHeight: moderateScale(50),
    marginTop: moderateScale(10),
    borderWidth: 1,
    borderColor: '#DDE3EA',
    borderRadius: 8,
    paddingHorizontal: moderateScale(12),
    fontFamily: FONTS.regular,
    fontSize: fontScale(14),
    color: COLORS.dark,
    includeFontPadding: true,
  },
  helpText: {
    marginTop: moderateScale(6),
    fontFamily: FONTS.regular,
    fontSize: fontScale(12),
    lineHeight: fontScale(21),
    color: COLORS.gray,
    includeFontPadding: true,
  },
  primaryButton: {
    minHeight: moderateScale(48),
    marginTop: moderateScale(14),
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
  },
  primaryText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: fontScale(14),
    includeFontPadding: true,
  },
  secondaryButton: {
    minHeight: moderateScale(46),
    marginTop: moderateScale(10),
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#F3C4C4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
  },
  secondaryText: {
    color: COLORS.danger,
    fontFamily: FONTS.bold,
    fontSize: fontScale(13),
    includeFontPadding: true,
  },
});
