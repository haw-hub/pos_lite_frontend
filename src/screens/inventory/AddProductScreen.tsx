// src/screens/inventory/AddProductScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../store/productStore';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { COLORS, FONTS } from '../../config/theme';
import { moderateScale, getButtonHeight } from '../../utils/responsive';
import { formatCurrency } from '../../utils/currency';
import { Product } from '../../types';
import { DatePickerModal } from '../../components/DatePickerModal';

interface AddProductScreenProps {
  navigation: any;
  route: {
    params?: {
      product?: Product;
    };
  };
}

export const AddProductScreen = ({ navigation, route }: AddProductScreenProps) => {
  const { addProduct, updateProduct, isLoading } = useProductStore();
  const product = route.params?.product;
  const isEditing = !!product;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    barcode: '',
    expiryDate: '',
  });

  const [errors, setErrors] = useState({
    name: '',
    price: '',
    stock: '',
    expiryDate: '',
  });

  const [scannerVisible, setScannerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        stock: product.stock.toString(),
        barcode: product.barcode || '',
        expiryDate: product.expiryDate || '',
      });
    }
  }, [product]);

  const validateForm = () => {
    let isValid = true;
    const newErrors = { name: '', price: '', stock: '', expiryDate: '' };

    if (!formData.name.trim()) {
      newErrors.name = 'ပစ္စည်းအမည် ထည့်သွင်းရန် လိုအပ်ပါသည်';
      isValid = false;
    }

    const price = parseFloat(formData.price.replace(/,/g, ''));
    if (!formData.price || isNaN(price) || price <= 0) {
      newErrors.price = 'ဈေးနှုန်း မှန်ကန်စွာ ထည့်သွင်းရန် လိုအပ်ပါသည်';
      isValid = false;
    }

    const stock = parseInt(formData.stock);
    if (!formData.stock || isNaN(stock) || stock < 0) {
      newErrors.stock = 'အရေအတွက် မှန်ကန်စွာ ထည့်သွင်းရန် လိုအပ်ပါသည်';
      isValid = false;
    }

    if (formData.expiryDate) {
      const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(formData.expiryDate);
      const parsedDate = new Date(`${formData.expiryDate}T00:00:00`);
      if (!validFormat || Number.isNaN(parsedDate.getTime())) {
        newErrors.expiryDate = 'ရက်စွဲကို YYYY-MM-DD ပုံစံဖြင့် ထည့်ပါ';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  // FIXED: Handle barcode scan - returns Promise<Product | null>
  const handleBarcodeScan = async (scannedBarcode: string): Promise<Product | null> => {
    console.log('Scanned barcode:', scannedBarcode);
    
    // Just set the barcode in the form and return null (no product lookup needed)
    setFormData({ ...formData, barcode: scannedBarcode });
    
    // Return null since we're not auto-filling product details in add product screen
    return null;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const productData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: parseFloat(formData.price.replace(/,/g, '')),
      stock: parseInt(formData.stock),
      barcode: formData.barcode.trim() || undefined,
      expiryDate: formData.expiryDate.trim() || undefined,
    };

    try {
      console.log('Submitting product:', productData);
      
      if (isEditing && product) {
        await updateProduct(product.id, productData);
        Alert.alert('အောင်မြင်ပါသည်', 'ပစ္စည်း အချက်အလက် ပြင်ဆင်ပြီးပါပြီ');
      } else {
        await addProduct(productData);
        Alert.alert('အောင်မြင်ပါသည်', 'ပစ္စည်းအသစ် ထည့်သွင်းပြီးပါပြီ');
      }
      navigation.goBack();
    } catch (error: any) {
      console.error('Submit error:', error);
      Alert.alert(
        'အမှား', 
        error.response?.data?.message || 'ပစ္စည်း သိမ်းဆည်းရာတွင် အမှားရှိပါသည်။ နောက်မှ ထပ်မံကြိုးစားပါ'
      );
    }
  };

  const handlePriceChange = (text: string) => {
    const numericValue = text.replace(/,/g, '');
    if (!/^\d*$/.test(numericValue)) {
      return;
    }
    const formattedValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setFormData(prev => ({
      ...prev,
      price: formattedValue,
    }));
  };

  const handleStockChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setFormData({ ...formData, stock: cleaned });
  };

  const getNumericPrice = (): number | null => {
    if (!formData.price) return null;
    const numericPrice = parseFloat(formData.price.replace(/,/g, ''));
    return isNaN(numericPrice) ? null : numericPrice;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
          {/* Product Name */}
          <View style={styles.field}>
            <Text style={styles.label}>
              ပစ္စည်းအမည် <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="ဥပမာ - ဆန်၊ ကြက်ဥ၊ စားသုံးဆီ"
              placeholderTextColor={COLORS.gray}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>ဖော်ပြချက် (အသေးစိတ်)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="ပစ္စည်း၏ အသေးစိတ်အချက်အလက်များ"
              placeholderTextColor={COLORS.gray}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Price */}
          <View style={styles.field}>
            <Text style={styles.label}>
              ဈေးနှုန်း (ကျပ်) <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.price && styles.inputError]}
              placeholder="၀"
              placeholderTextColor={COLORS.gray}
              value={formData.price}
              onChangeText={handlePriceChange}
              keyboardType="numeric"
            />
            {(() => {
              const numeric = getNumericPrice();
              return numeric != null ? (
                <Text style={styles.pricePreview}>{formatCurrency(numeric)}</Text>
              ) : null;
            })()}
            {errors.price ? <Text style={styles.errorText}>{errors.price}</Text> : null}
          </View>

          {/* Stock */}
          <View style={styles.field}>
            <Text style={styles.label}>
              အရေအတွက် <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.stock && styles.inputError]}
              placeholder="၀"
              placeholderTextColor={COLORS.gray}
              value={formData.stock}
              onChangeText={handleStockChange}
              keyboardType="numeric"
            />
            {errors.stock ? <Text style={styles.errorText}>{errors.stock}</Text> : null}
          </View>

          {/* Barcode with Scan Button */}
          <View style={styles.field}>
            <Text style={styles.label}>သက်တမ်းကုန်ရက် (မဖြစ်မနေမဟုတ်ပါ)</Text>
            <TouchableOpacity
              style={[styles.input, styles.dateInput, errors.expiryDate && styles.inputError]}
              onPress={() => setDatePickerVisible(true)}
            >
              <Text style={formData.expiryDate ? styles.dateText : styles.datePlaceholder}>
                {formData.expiryDate || 'ရက်စွဲရွေးမည်'}
              </Text>
              <Ionicons name="calendar-outline" size={21} color={COLORS.primary} />
            </TouchableOpacity>
            {errors.expiryDate ? <Text style={styles.errorText}>{errors.expiryDate}</Text> : null}
          </View>

          {/* Barcode with Scan Button */}
          <View style={styles.field}>
            <Text style={styles.label}>ဘားကုဒ် (အလိုရှိလျှင်)</Text>
            <View style={styles.barcodeContainer}>
              <TextInput
                style={[styles.input, styles.barcodeInput]}
                placeholder="ဘားကုဒ်နံပါတ်"
                placeholderTextColor={COLORS.gray}
                value={formData.barcode}
                onChangeText={(text) => setFormData({ ...formData, barcode: text })}
              />
              <TouchableOpacity 
                style={styles.scanButton}
                onPress={() => setScannerVisible(true)}
              >
                <Ionicons name="barcode-outline" size={22} color={COLORS.white} />
                <Text style={styles.scanButtonText}>Scan</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelButtonText}>မလုပ်တော့ပါ</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEditing ? 'ပြင်ဆင်မည်' : 'သိမ်းဆည်းမည်'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleBarcodeScan}
        cartItems={[]}
        cartTotal={0}
      />
      <DatePickerModal
        visible={datePickerVisible}
        value={formData.expiryDate}
        onSelect={(expiryDate) => setFormData(current => ({ ...current, expiryDate }))}
        onClear={() => setFormData(current => ({ ...current, expiryDate: '' }))}
        onClose={() => setDatePickerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.light,
  },
  scrollContent: {
    padding: moderateScale(15),
  },
  form: {
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(12),
    padding: moderateScale(20),
    ...Platform.select({
      ios: { shadowOpacity: 0.1, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  field: {
    marginBottom: moderateScale(20),
  },
  label: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.dark,
    marginBottom: moderateScale(8),
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
    color: COLORS.dark,
    backgroundColor: COLORS.white,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontFamily: FONTS.medium,
    fontSize: moderateScale(14),
    color: COLORS.dark,
  },
  datePlaceholder: {
    fontFamily: FONTS.regular,
    fontSize: moderateScale(14),
    color: COLORS.gray,
  },
  textArea: {
    height: moderateScale(80),
    textAlignVertical: 'top',
  },
  pricePreview: {
    marginTop: moderateScale(5),
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.primary,
  },
  errorText: {
    marginTop: moderateScale(5),
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.danger,
  },
  barcodeContainer: {
    flexDirection: 'row',
    gap: moderateScale(10),
    alignItems: 'center',
  },
  barcodeInput: {
    flex: 1,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(15),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(8),
    gap: moderateScale(6),
  },
  scanButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.medium,
    fontSize: moderateScale(14),
  },
  actions: {
    flexDirection: 'row',
    gap: moderateScale(12),
    marginTop: moderateScale(20),
  },
  button: {
    flex: 1,
    height: getButtonHeight('normal'),
    borderRadius: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.grayLight,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButtonText: {
    color: COLORS.dark,
    fontSize: moderateScale(16),
    fontFamily: FONTS.medium,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
  },
});
