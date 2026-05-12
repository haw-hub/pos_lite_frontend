// src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { COLORS, SIZES, FONTS } from '../../config/theme';
import { moderateScale, getButtonHeight } from '../../utils/responsive';

export const LoginScreen = ({ navigation }: any) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('သတိပေးချက်', 'ကျေးဇူးပြု၍ အသုံးပြုသူအမည်နှင့် စကားဝှက်ကို ဖြည့်သွင်းပါ');
      return;
    }

    setLoading(true);
    const success = await login(username, password);
    setLoading(false);

    if (success) {
      navigation.replace('Main');
    } else {
      Alert.alert('အမှား', 'အသုံးပြုသူအမည် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>POS မြန်မာ</Text>
        <Text style={styles.subtitle}>အရောင်းစနစ်</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="အသုံးပြုသူအမည်"
            placeholderTextColor={COLORS.gray}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="စကားဝှက်"
            placeholderTextColor={COLORS.gray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.loginButtonText}>ဝင်ရန်</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(20),
  },
  title: {
    fontSize: moderateScale(36),
    fontFamily: FONTS.bold,
    color: COLORS.white,
    marginBottom: moderateScale(10),
  },
  subtitle: {
    fontSize: moderateScale(18),
    fontFamily: FONTS.regular,
    color: COLORS.white,
    marginBottom: moderateScale(50),
  },
  form: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(15),
    padding: moderateScale(20),
    ...Platform.select({
      ios: { shadowOpacity: 0.2 },
      android: { elevation: 5 },
    }),
  },
  input: {
    width: '100%',
    height: moderateScale(50),
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    borderRadius: moderateScale(10),
    paddingHorizontal: moderateScale(15),
    marginBottom: moderateScale(15),
    fontSize: moderateScale(16),
    fontFamily: FONTS.regular,
  },
  loginButton: {
    width: '100%',
    height: getButtonHeight('normal'),
    backgroundColor: COLORS.primary,
    borderRadius: moderateScale(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: moderateScale(10),
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
  },
});