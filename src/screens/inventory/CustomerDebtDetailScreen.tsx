// src/screens/credit/CustomerDebtDetailScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Alert } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { debtApi } from '../../api/debts';
import { COLORS, FONTS } from '../../config/theme';
import { formatCurrency } from '../../utils/currency';

export const CustomerDebtDetailScreen = ({
  route,
  navigation,
}: any) => {
  const { customerId, name } = route.params;

  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] =
    useState<any>(null);

    const [modalVisible, setModalVisible] =
    useState(false);

    const [paymentModalVisible, setPaymentModalVisible] =
    useState(false);

  const [selectedPaymentDebt, setSelectedPaymentDebt] =
    useState<any>(null);

  const [paymentAmount, setPaymentAmount] =
    useState('');

    const [paymentMethod, setPaymentMethod] =
  useState('CASH');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await debtApi.getByCustomer(customerId);
      setDebts(data);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (debt: any) => {
    setSelectedDebt(debt);
    setModalVisible(true);
    };

    const openPaymentModal = (debt: any) => {
    setSelectedPaymentDebt(debt);

    setPaymentAmount(
      debt.remainingAmount.toString()
    );

    setPaymentMethod('CASH');

    setPaymentModalVisible(true);
  };

  const total = debts.reduce(
    (sum, d) => sum + Number(d.remainingAmount),
    0
  );

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    
    <View style={{ flex: 1, padding: 15 }}>
        <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            >
            <Ionicons
                name="arrow-back"
                size={22}
                color={COLORS.primary}
            />

            <Text style={styles.backText}>
                Back
            </Text>
            </TouchableOpacity>
      <Text style={styles.title}>{name}</Text>

      <FlatList
        data={debts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.order}>
                Order #{item.order?.orderNumber}
            </Text>

            <View
                style={[
                styles.statusBadge,
                item.order?.status === 'COMPLETED'
                    ? styles.completedBadge
                    : styles.pendingBadge,
                ]}
            >
                <Text style={styles.statusText}>
                {item.order?.status}
                </Text>
            </View>

            <Text style={styles.amount}>
                {formatCurrency(item.remainingAmount)}
            </Text>

            <View style={styles.buttonRow}>
                <TouchableOpacity
                style={styles.detailButton}
                onPress={() => openDetail(item)}
                >
                <Text style={styles.buttonText}>
                    View Details
                </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={
                      item.order?.status === 'COMPLETED'
                  }
                  style={[
                      styles.paidButton,
                      item.order?.status === 'COMPLETED' &&
                      styles.completedButton,
                  ]}
                  onPress={() =>
                      openPaymentModal(item)
                  }
                >
                  <Text style={styles.buttonText}>
                      {item.order?.status === 'COMPLETED'
                      ? 'Paid'
                      : 'Receive Payment'}
                  </Text>
                </TouchableOpacity>
            </View>
            </View>
        )}
      />

      <View style={styles.footer}>
        <Text style={styles.totalLabel}>Total Due</Text>
        <Text style={styles.total}>
          {formatCurrency(total)}
        </Text>
      </View>
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        >
        <View style={styles.modalOverlay}>
            <View style={styles.modal}>
            <Text style={styles.modalTitle}>
                Order Details
            </Text>

            <ScrollView>
                {selectedDebt?.order?.items?.map(
                (item: any) => (
                    <View
                    key={item.id}
                    style={styles.productRow}
                    >
                    <Text>
                        {item.product?.name}
                    </Text>

                    <Text>
                        x{item.quantity}
                    </Text>
                    </View>
                )
                )}
            </ScrollView>

            <TouchableOpacity
                style={styles.closeButton}
                onPress={() =>
                setModalVisible(false)
                }
            >
                <Text
                style={{
                    color: 'white',
                }}
                >
                Close
                </Text>
            </TouchableOpacity>
            </View>
        </View>
      </Modal>
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              Receive Payment
            </Text>

            <View style={styles.remainingBox}>
              <Text style={styles.remainingLabel}>
                Remaining Balance
              </Text>

              <Text style={styles.remainingAmount}>
                {formatCurrency(
                  selectedPaymentDebt?.remainingAmount || 0
                )}
              </Text>
            </View>

            <Text style={styles.inputLabel}>
              Payment Method
            </Text>

            <View style={styles.paymentMethods}>
              {[
                'CASH',
                'CARD',
                'QR',
                'TRANSFER',
              ].map(method => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.methodButton,
                    paymentMethod === method &&
                      styles.methodButtonSelected,
                  ]}
                  onPress={() =>
                    setPaymentMethod(method)
                  }
                >
                  <Text
                    style={[
                      styles.methodText,
                      paymentMethod === method &&
                        styles.methodTextSelected,
                    ]}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>
              Payment Amount
            </Text>

            <TextInput
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={async () => {
                try {

                  await debtApi.makePayment(
                    selectedPaymentDebt.id,
                    Number(paymentAmount),
                    paymentMethod
                  );

                  setPaymentModalVisible(false);

                  Alert.alert(
                    'Success',
                    'Payment saved.'
                  );

                  load();

                } catch (e) {

                  Alert.alert(
                    'Error',
                    'Unable to save payment.'
                  );

                }
              }}
            >
              <Text style={styles.buttonText}>
                Save Payment
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() =>
                setPaymentModalVisible(false)
              }
            >
              <Text style={{ color: 'white' }}>
                Cancel
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    marginBottom: 10,
  },

  card: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },

  order: {
    fontSize: 14,
    fontFamily: FONTS.medium,
  },

  amount: {
    fontSize: 14,
    color: COLORS.danger,
    marginTop: 5,
  },

  footer: {
    marginTop: 10,
    padding: 15,
    backgroundColor: COLORS.light,
    borderRadius: 10,
  },

  totalLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },

  total: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.danger,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    },

    backText: {
    marginLeft: 8,
    color: COLORS.primary,
    fontFamily: FONTS.bold,
    },
    buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
    },

    detailButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: 10,
    borderRadius: 8,
    marginRight: 5,
    },

    paidButton: {
    flex: 1,
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 8,
    marginLeft: 5,
    },

    buttonText: {
    textAlign: 'center',
    color: 'white',
    fontFamily: FONTS.bold,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },

    modal: {
      width: '90%',
      backgroundColor: 'white',
      marginHorizontal: 20,
      borderRadius: 20,
      padding: 20,
      elevation: 8,
    },

    modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    marginBottom: 15,
    },

    productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    },

    closeButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    alignItems: 'center',
    },
    completedButton: {
    backgroundColor: COLORS.gray,
    opacity: 0.7,
    },
    headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    },

    statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    },

    completedBadge: {
    backgroundColor: '#28a745',
    },

    pendingBadge: {
    backgroundColor: '#ff9800',
    },

    statusText: {
    color: 'white',
    fontSize: 11,
    fontFamily: FONTS.bold,
    },

    input: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 10,
      padding: 12,
      marginTop: 15,
      marginBottom: 15,
    },
    modalSaveButton: {
      backgroundColor: '#28a745',
      padding: 14,
      borderRadius: 10, 
      alignItems: 'center',
      marginTop: 15,
    },
    remainingBox: {
      backgroundColor: '#f5f5f5',
      padding: 15,
      borderRadius: 12,
      marginBottom: 15,
    },

    remainingLabel: {
      fontSize: 13,
      color: COLORS.gray,
    },

    remainingAmount: {
      fontSize: 22,
      fontFamily: FONTS.bold,
      color: COLORS.danger,
      marginTop: 5,
    },
    inputLabel: {
      fontSize: 14,
      fontFamily: FONTS.medium,
      marginBottom: 8,
    },
    paymentMethods: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 15,
    },

    methodButton: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginRight: 8,
      marginBottom: 8,
    },

    methodButtonSelected: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },

    methodText: {
      color: '#555',
    },

    methodTextSelected: {
      color: 'white',
      fontFamily: FONTS.bold,
    },
});