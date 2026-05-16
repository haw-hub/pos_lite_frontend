// src/screens/auth/SignupScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../api/auth';
import { COLORS, FONTS } from '../../config/theme';
import { moderateScale, getButtonHeight } from '../../utils/responsive';

export const SignupScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    email: '',
    phone: '',
  });
  
  const [errors, setErrors] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    email: '',
    phone: '',
  });

  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      username: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      email: '',
      phone: '',
    };

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'အသုံးပြုသူအမည် ထည့်သွင်းရန် လိုအပ်ပါသည်';
      isValid = false;
    } else if (formData.username.length < 3) {
      newErrors.username = 'အသုံးပြုသူအမည် အနည်းဆုံး ၃ လုံးရှိရပါမည်';
      isValid = false;
    }

    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'အမည်အပြည့်အစုံ ထည့်သွင်းရန် လိုအပ်ပါသည်';
      isValid = false;
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'စကားဝှက် ထည့်သွင်းရန် လိုအပ်ပါသည်';
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = 'စကားဝှက် အနည်းဆုံး ၆ လုံးရှိရပါမည်';
      isValid = false;
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'စကားဝှက်များ မတူညီပါ';
      isValid = false;
    }

    // Email validation (optional)
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'အီးမေးလ် ပုံစံ မမှန်ကန်ပါ';
      isValid = false;
    }

    // Phone validation (optional)
    if (formData.phone && !/^[0-9]{7,15}$/.test(formData.phone)) {
      newErrors.phone = 'ဖုန်းနံပါတ် ပုံစံ မမှန်ကန်ပါ';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.signup({
        username: formData.username,
        password: formData.password,
        fullName: formData.fullName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
      });

      Alert.alert(
        'အောင်မြင်ပါသည်',
        `အကောင့် ${response.username} အောင်မြင်စွာ ဖွင့်လှစ်ပြီးပါပြီ။ ကျေးဇူးပြု၍ ဝင်ရောက်ပါ။`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = 'အကောင့်ဖွင့်ရာတွင် အမှားရှိပါသည်။ နောက်မှ ထပ်မံကြိုးစားပါ။';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        errorMessage = error.response.data.errors[0].defaultMessage;
      }
      
      Alert.alert('အမှား', errorMessage);
    } finally {
      setLoading(false);
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
        </View>

        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.field}>
            <Text style={styles.label}>
              အမည်အပြည့်အစုံ <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="ဦးမောင်မောင်"
              placeholderTextColor={COLORS.gray}
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
            />
            {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
          </View>

          {/* Username */}
          <View style={styles.field}>
            <Text style={styles.label}>
              အသုံးပြုသူအမည် <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.username && styles.inputError]}
              placeholder="example_user"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="none"
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text.toLowerCase() })}
            />
            {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>အီးမေးလ် (အလိုရှိလျှင်)</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="user@example.com"
              placeholderTextColor={COLORS.gray}
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>ဖုန်းနံပါတ် (အလိုရှိလျှင်)</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="09123456789"
              placeholderTextColor={COLORS.gray}
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
            />
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>
              စကားဝှက် <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.password && styles.inputError]}
                placeholder="အနည်းဆုံး ၆ လုံး"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showPassword}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          {/* Confirm Password */}
          <View style={styles.field}>
            <Text style={styles.label}>
              စကားဝှက် အတည်ပြုရန် <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.passwordInput, errors.confirmPassword && styles.inputError]}
                placeholder="စကားဝှက်ကို ထပ်မံရိုက်ထည့်ပါ"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showConfirmPassword}
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
          </View>

          {/* Signup Button */}
          <TouchableOpacity
            style={styles.signupButton}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.signupButtonText}>အကောင့်ဖွင့်မည်</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>အကောင့်ရှိပြီးသားလား? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>ဝင်ရောက်ရန်</Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: moderateScale(30),},
  header: {
    alignItems: 'center',
    paddingTop: moderateScale(60),
    paddingBottom: moderateScale(30),
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
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    paddingRight: moderateScale(40),
  },
  eyeIcon: {
    position: 'absolute',
    right: moderateScale(12),
  },
  errorText: {
    marginTop: moderateScale(4),
    fontSize: moderateScale(11),
    fontFamily: FONTS.regular,
    color: COLORS.danger,
  },
  signupButton: {
    height: getButtonHeight('normal'),
    backgroundColor: COLORS.primary,
    borderRadius: moderateScale(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: moderateScale(20),
    marginBottom: moderateScale(15),
  },
  signupButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.gray,
  },
  loginLink: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  logoWrapper: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: moderateScale(-30),
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
});