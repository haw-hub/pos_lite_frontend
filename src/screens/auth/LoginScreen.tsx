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
  Image,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { COLORS, FONTS } from '../../config/theme';
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>POS Myanmar</Text>
          <Text style={styles.subtitle}>သင့်လုပ်ငန်းအတွက် အသက်သာဆုံး POS</Text> 
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>
              အသုံးပြုသူအမည် <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="သင်၏အသုံးပြုသူအမည်"
              placeholderTextColor={COLORS.gray}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              စကားဝှက် <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="သင်၏စကားဝှက်"
              placeholderTextColor={COLORS.gray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.loginButtonText}>ဝင်ရောက်မည်</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>အကောင့်မရှိသေးဘူးလား? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupLink}>အကောင့်ဖွင့်ရန်</Text>
            </TouchableOpacity>

          </View>
          <Text style={styles.copyright}>© 2026 Idea X Technology. All rights reserved.</Text>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
    
  },
  header: {
    alignItems: 'center',
    paddingTop: moderateScale(60),
    paddingBottom: moderateScale(30),
  },
  logoWrapper: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(20),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  logo: {
    width: moderateScale(90),
    height: moderateScale(100),
    borderRadius: moderateScale(20),
  },
  title: {
    fontSize: moderateScale(32),
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  subtitle: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.regular,
    color: COLORS.white,
    marginTop: moderateScale(5),
  },
  form: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: moderateScale(25),
    borderTopRightRadius: moderateScale(25),
    padding: moderateScale(20),
    flex: 1,
  },
  field: {
    marginBottom: moderateScale(15),
  },
  label: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
    marginBottom: moderateScale(5),
  },
  required: {
    color: COLORS.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    backgroundColor: COLORS.white,
  },
  loginButton: {
    height: getButtonHeight('normal'),
    backgroundColor: COLORS.primary,
    borderRadius: moderateScale(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: moderateScale(20),
    marginBottom: moderateScale(15),
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  signupLink: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  copyright:{
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: moderateScale(90),
  }
});