import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmployeeRequest, EmployeeRole, ShopUser, usersApi } from '../../api/users';
import { COLORS, FONTS } from '../../config/theme';
import { useAuthStore } from '../../store/authStore';
import { moderateScale } from '../../utils/responsive';

const emptyForm: EmployeeRequest = {
  username: '',
  password: '',
  fullName: '',
  role: 'CASHIER',
};

export const UserManagementScreen = () => {
  const currentUser = useAuthStore(state => state.user);
  const [users, setUsers] = useState<ShopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<EmployeeRequest>(emptyForm);

  const loadUsers = async () => {
    try {
      setUsers(await usersApi.getAll());
    } catch (error: any) {
      Alert.alert('မအောင်မြင်ပါ', error.response?.data?.message || 'ဝန်ထမ်းစာရင်း မရရှိပါ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const createEmployee = async () => {
    if (!form.fullName.trim() || !form.username.trim() || form.password.length < 6) {
      Alert.alert('အချက်အလက်လိုအပ်သည်', 'အမည်၊ username နှင့် အနည်းဆုံး ၆ လုံး password ထည့်ပါ');
      return;
    }
    setSaving(true);
    try {
      const created = await usersApi.create({
        ...form,
        username: form.username.trim().toLowerCase(),
      });
      setUsers(current => [...current, created]);
      setForm(emptyForm);
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('မအောင်မြင်ပါ', error.response?.data?.message || 'ဝန်ထမ်း account မဖန်တီးနိုင်ပါ');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: ShopUser) => {
    try {
      const updated = await usersApi.setActive(user.id, !user.active);
      setUsers(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (error: any) {
      Alert.alert('မအောင်မြင်ပါ', error.response?.data?.message || 'Account အခြေအနေ မပြောင်းနိုင်ပါ');
    }
  };

  const renderUser = ({ item }: { item: ShopUser }) => (
    <View style={styles.userRow}>
      <View style={[styles.avatar, !item.active && styles.inactiveAvatar]}>
        <Ionicons name="person-outline" size={22} color={item.active ? COLORS.primary : COLORS.gray} />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.fullName}</Text>
        <Text style={styles.username}>@{item.username}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.role}>{item.role}</Text>
          <Text style={[styles.status, { color: item.active ? COLORS.success : COLORS.danger }]}>
            {item.active ? 'အသုံးပြုနိုင်သည်' : 'ပိတ်ထားသည်'}
          </Text>
        </View>
      </View>
      {item.role !== 'ADMIN' && item.id !== currentUser?.userId ? (
        <TouchableOpacity style={styles.toggleButton} onPress={() => toggleActive(item)}>
          <Ionicons
            name={item.active ? 'pause-circle-outline' : 'play-circle-outline'}
            size={25}
            color={item.active ? COLORS.danger : COLORS.success}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.shopHeader}>
        <View>
          <Text style={styles.shopName}>{currentUser?.shopName || 'ဆိုင်'}</Text>
          <Text style={styles.shopMeta}>{users.length} accounts</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="person-add-outline" size={21} color={COLORS.white} />
          <Text style={styles.addButtonText}>ဝန်ထမ်းထည့်</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={item => String(item.id)}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadUsers}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ဝန်ထမ်း Account အသစ်</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.dark} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="အမည်" value={form.fullName}
              onChangeText={fullName => setForm(current => ({ ...current, fullName }))} />
            <TextInput style={styles.input} placeholder="Username" autoCapitalize="none" value={form.username}
              onChangeText={username => setForm(current => ({ ...current, username }))} />
            <TextInput style={styles.input} placeholder="Password အနည်းဆုံး ၆ လုံး" secureTextEntry value={form.password}
              onChangeText={password => setForm(current => ({ ...current, password }))} />
            <Text style={styles.roleLabel}>Role</Text>
            <View style={styles.roleOptions}>
              {(['CASHIER', 'MANAGER'] as EmployeeRole[]).map(role => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleOption, form.role === role && styles.selectedRole]}
                  onPress={() => setForm(current => ({ ...current, role }))}
                >
                  <Text style={[styles.roleOptionText, form.role === role && styles.selectedRoleText]}>{role}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={createEmployee} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>Account ဖန်တီးမည်</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shopHeader: { padding: moderateScale(16), backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shopName: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: moderateScale(18) },
  shopMeta: { color: COLORS.white + 'B8', fontFamily: FONTS.regular, fontSize: moderateScale(11), marginTop: 2 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.warning, paddingHorizontal: 12, height: 42, borderRadius: 8 },
  addButtonText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: moderateScale(12) },
  list: { padding: moderateScale(14), gap: moderateScale(10) },
  userRow: { backgroundColor: COLORS.white, borderRadius: 8, padding: moderateScale(13), flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.grayLight },
  avatar: { width: 45, height: 45, borderRadius: 8, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  inactiveAvatar: { backgroundColor: COLORS.grayLight },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontFamily: FONTS.bold, fontSize: moderateScale(14), color: COLORS.dark },
  username: { fontFamily: FONTS.regular, fontSize: moderateScale(11), color: COLORS.gray, marginTop: 1 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 5 },
  role: { fontFamily: FONTS.bold, fontSize: moderateScale(10), color: COLORS.primary },
  status: { fontFamily: FONTS.medium, fontSize: moderateScale(10) },
  toggleButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: moderateScale(18), paddingBottom: moderateScale(30) },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontFamily: FONTS.bold, color: COLORS.dark, fontSize: moderateScale(17) },
  input: { height: 48, borderWidth: 1, borderColor: COLORS.grayLight, borderRadius: 8, paddingHorizontal: 12, marginBottom: 11, fontFamily: FONTS.regular, color: COLORS.dark },
  roleLabel: { fontFamily: FONTS.medium, color: COLORS.dark, marginBottom: 8 },
  roleOptions: { flexDirection: 'row', gap: 10 },
  roleOption: { flex: 1, height: 43, borderRadius: 8, borderWidth: 1, borderColor: COLORS.grayLight, alignItems: 'center', justifyContent: 'center' },
  selectedRole: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleOptionText: { fontFamily: FONTS.bold, color: COLORS.dark },
  selectedRoleText: { color: COLORS.white },
  saveButton: { marginTop: 18, height: 48, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: COLORS.white, fontFamily: FONTS.bold },
});
