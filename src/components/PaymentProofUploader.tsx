import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS } from '../config/theme';
import { subscriptionPaymentsApi } from '../api/subscriptionPayments';
import { moderateScale, fontScale } from '../utils/responsive';

interface Props {
  onSubmitted?: () => void;
}

export const PaymentProofUploader = ({ onSubmitted }: Props) => {
  const [months, setMonths] = useState('1');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('KBZPay');
  const [notes, setNotes] = useState('KBZPay ဖြင့်ပေးပြီး');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const chooseScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission လိုအပ်ပါသည်', 'Payment screenshot ရွေးရန် photos permission ဖွင့်ပေးပါ');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled) {
      setAsset(result.assets[0]);
    }
  };

  const submit = async () => {
    if (!asset) {
      Alert.alert('Screenshot ရွေးပါ', 'ငွေလွှဲထားသော screenshot ကို ရွေးပြီးမှ ပို့ပါ');
      return;
    }
    const safeMonths = Number(months);
    if (!Number.isFinite(safeMonths) || safeMonths <= 0) {
      Alert.alert('လအရေအတွက် မှားနေသည်', 'သက်တမ်းတိုးမည့် လအရေအတွက်ကို မှန်ကန်စွာ ထည့်ပါ');
      return;
    }

    setSubmitting(true);
    try {
      await subscriptionPaymentsApi.submitProof({
        months: safeMonths,
        amount,
        paymentMethod,
        notes,
        screenshot: {
          uri: asset.uri,
          name: asset.fileName || `payment-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        },
      });
      Alert.alert(
        'ပို့ပြီးပါပြီ',
        'ငွေလွှဲ screenshot ကို Super Admin ဆီပို့ပြီးပါပြီ။ အတည်ပြုပြီးလျှင် သက်တမ်းပြန်တိုးပါမည်။',
      );
      setAsset(null);
      onSubmitted?.();
    } catch (error: any) {
      Alert.alert('မပို့နိုင်ပါ', error.response?.data?.message || 'Internet connection ကိုစစ်ပြီး ထပ်စမ်းပါ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-upload-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Payment Screenshot ပို့ရန်</Text>
          <Text style={styles.subtitle}>KBZPay/WavePay ဖြင့်လွှဲပြီး screenshot ပို့ပါ</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>လအရေအတွက်</Text>
          <TextInput style={styles.input} value={months} onChangeText={setMonths} keyboardType="number-pad" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="30000" placeholderTextColor={COLORS.gray} />
        </View>
      </View>

      <Text style={styles.label}>Payment Method</Text>
      <TextInput style={styles.input} value={paymentMethod} onChangeText={setPaymentMethod} placeholder="KBZPay" placeholderTextColor={COLORS.gray} />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="KBZPay ဖြင့်ပေးပြီး"
        placeholderTextColor={COLORS.gray}
      />

      <TouchableOpacity style={styles.pickButton} onPress={chooseScreenshot}>
        <Ionicons name="image-outline" size={20} color={COLORS.primary} />
        <Text style={styles.pickText}>{asset ? 'Screenshot ပြန်ရွေးမည်' : 'Screenshot ရွေးမည်'}</Text>
      </TouchableOpacity>

      {asset ? <Image source={{ uri: asset.uri }} style={styles.preview} /> : null}

      <TouchableOpacity style={[styles.submitButton, submitting && styles.disabledButton]} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="send-outline" size={19} color={COLORS.white} />}
        <Text style={styles.submitText}>{submitting ? 'ပို့နေသည်...' : 'Super Admin ဆီ ပို့မည်'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, marginTop: moderateScale(20), padding: moderateScale(14), borderRadius: 8, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(10), marginBottom: moderateScale(12) },
  iconCircle: { width: moderateScale(42), height: moderateScale(42), borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '12' },
  headerCopy: { flex: 1 },
  title: { fontFamily: FONTS.bold, fontSize: fontScale(15), color: COLORS.dark },
  subtitle: { marginTop: 2, fontFamily: FONTS.regular, fontSize: fontScale(11), color: COLORS.gray },
  row: { flexDirection: 'row', gap: moderateScale(8) },
  inputGroup: { flex: 1 },
  label: { marginTop: moderateScale(10), marginBottom: moderateScale(5), fontFamily: FONTS.medium, fontSize: fontScale(12), color: COLORS.dark },
  input: { minHeight: moderateScale(42), borderWidth: 1, borderColor: COLORS.grayLight, borderRadius: 8, paddingHorizontal: moderateScale(11), fontFamily: FONTS.regular, color: COLORS.dark, backgroundColor: COLORS.white },
  noteInput: { minHeight: moderateScale(70), textAlignVertical: 'top', paddingTop: moderateScale(9) },
  pickButton: { marginTop: moderateScale(12), minHeight: moderateScale(44), borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary + '55', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(7), backgroundColor: COLORS.primary + '08' },
  pickText: { fontFamily: FONTS.bold, fontSize: fontScale(13), color: COLORS.primary },
  preview: { width: '100%', height: moderateScale(150), borderRadius: 8, marginTop: moderateScale(10), backgroundColor: COLORS.light },
  submitButton: { marginTop: moderateScale(12), minHeight: moderateScale(48), borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(8), backgroundColor: COLORS.primary },
  submitText: { fontFamily: FONTS.bold, fontSize: fontScale(14), color: COLORS.white },
  disabledButton: { opacity: 0.65 },
});

export default PaymentProofUploader;
