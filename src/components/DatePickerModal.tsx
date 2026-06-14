import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../config/theme';
import { moderateScale } from '../utils/responsive';

interface DatePickerModalProps {
  visible: boolean;
  value?: string;
  onSelect: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
}

const weekDays = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ'];

const toDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DatePickerModal = ({
  visible,
  value,
  onSelect,
  onClear,
  onClose,
}: DatePickerModalProps) => {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    if (visible) {
      const date = value ? new Date(`${value}T00:00:00`) : new Date();
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }, [visible, value]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const dayCount = new Date(year, month + 1, 0).getDate();
    return [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: dayCount }, (_, index) => index + 1),
    ];
  }, [visibleMonth]);

  const moveMonth = (amount: number) => {
    setVisibleMonth(
      current => new Date(current.getFullYear(), current.getMonth() + amount, 1)
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => undefined}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconButton} onPress={() => moveMonth(-1)}>
              <Ionicons name="chevron-back" size={22} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {visibleMonth.toLocaleDateString('my-MM', { year: 'numeric', month: 'long' })}
            </Text>
            <TouchableOpacity style={styles.iconButton} onPress={() => moveMonth(1)}>
              <Ionicons name="chevron-forward" size={22} color={COLORS.dark} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {weekDays.map(day => (
              <Text key={day} style={styles.weekDay} numberOfLines={1}>{day}</Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {days.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
              const dateValue = toDateValue(date);
              const selected = dateValue === value;
              const today = dateValue === toDateValue(new Date());
              return (
                <TouchableOpacity
                  key={dateValue}
                  style={[styles.dayCell, selected && styles.selectedDay]}
                  onPress={() => {
                    onSelect(dateValue);
                    onClose();
                  }}
                >
                  <Text style={[
                    styles.dayText,
                    today && styles.todayText,
                    selected && styles.selectedDayText,
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => {
              onClear();
              onClose();
            }}>
              <Text style={styles.clearText}>ရက်စွဲဖျက်မည်</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>ပိတ်မည်</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: moderateScale(20),
  },
  modal: {
    backgroundColor: COLORS.white,
    borderRadius: moderateScale(8),
    padding: moderateScale(16),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moderateScale(14),
  },
  iconButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontFamily: FONTS.bold,
    fontSize: moderateScale(17),
    color: COLORS.dark,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: moderateScale(6),
  },
  weekDay: {
    width: '14.285%',
    textAlign: 'center',
    fontFamily: FONTS.medium,
    fontSize: moderateScale(9),
    color: COLORS.gray,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(4),
  },
  selectedDay: {
    backgroundColor: COLORS.primary,
  },
  dayText: {
    fontFamily: FONTS.medium,
    fontSize: moderateScale(13),
    color: COLORS.dark,
  },
  todayText: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
  selectedDayText: {
    color: COLORS.white,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: moderateScale(14),
    paddingTop: moderateScale(12),
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
  },
  clearText: {
    fontFamily: FONTS.medium,
    color: COLORS.danger,
  },
  closeText: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
});
