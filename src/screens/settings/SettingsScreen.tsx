// src/screens/settings/SettingsScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { COLORS, FONTS } from '../../config/theme';

export const SettingsScreen = () => {
  const { logout } = useAuthStore();
  
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>ထွက်ရန်</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  logoutButton: { backgroundColor: COLORS.danger, padding: 15, borderRadius: 8 },
  logoutText: { color: COLORS.white, textAlign: 'center', fontFamily: FONTS.bold },
});