  // src/screens/pos/CheckoutScreen.tsx
  import React, { useState } from 'react';
  import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
  } from 'react-native';
  import { Ionicons } from '@expo/vector-icons';
  import { useCartStore } from '../../store/cartStore';
  import { useAuthStore } from '../../store/authStore';
  import { COLORS, FONTS } from '../../config/theme';
  import { moderateScale, getButtonHeight } from '../../utils/responsive';
  import { formatCurrency, calculateChange } from '../../utils/currency';
  import { OrderRepository } from '../../database/repositories/orderRepository';
  import { syncService } from '../../services/sync/syncService';
  import { useProductStore } from '../../store/productStore';
  import { inventoryAlertService } from '../../services/alerts/inventoryAlertService';

  type PaymentMethod = 'CASH' | 'CARD' | 'QR' | 'TRANSFER'  | 'CREDIT';

  export const CheckoutScreen = ({ navigation }: any) => {
    const { items, total, clearCart } = useCartStore();
    const { user } = useAuthStore();
    const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('CASH');
    const [loading, setLoading] = useState(false);
    const [receivedAmount, setReceivedAmount] = useState<number>(total);
    const [showNumberPad, setShowNumberPad] = useState(true);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [creditNote, setCreditNote] = useState('');

    const handlePaymentMethodSelect = (method: PaymentMethod) => {
      setSelectedPayment(method);
      setShowNumberPad(method === 'CASH');
    };

    const handleAmountChange = (amount: number) => {
      setReceivedAmount(amount);
    };

    const handleCheckout = async () => {
      if (items.length === 0) {
        Alert.alert('သတိပေးချက်', 'ဈေးခြင်းထဲတွင် ပစ္စည်းမရှိပါ');
        return;
      }

      if (selectedPayment === 'CASH' && receivedAmount < total) {
        Alert.alert('သတိပေးချက်', 'ငွေပမာဏ မလုံလောက်ပါ');
        return;
      }

      const productWithoutCost = items.find(item => !item.product.costPrice || item.product.costPrice <= 0);
      if (productWithoutCost) {
        Alert.alert(
          'အရင်းဈေးလိုအပ်ပါသည်',
          `${productWithoutCost.product.name} အတွက် အရင်းဈေးအရင်ဖြည့်ပြီးမှ ရောင်းနိုင်ပါမည်။`
        );
        return;
      }

      if (selectedPayment === 'CREDIT') {

        if (!customerName.trim()) {
          Alert.alert(
            'သတိပေးချက်',
            'ဖောက်သည်အမည် ထည့်ပါ'
          );
          return;
        }

        if (!customerPhone.trim()) {
          Alert.alert(
            'သတိပေးချက်',
            'ဖုန်းနံပါတ် ထည့်ပါ'
          );
          return;
        }
      }

      setLoading(true);

      const orderData = {
        items: items.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        paymentMethod: selectedPayment,
        totalAmount: total,
        cashierId: user?.username,
        cashReceived: selectedPayment === 'CASH' ? receivedAmount : null,
        change: selectedPayment === 'CASH' ? receivedAmount - total : 0,
        customer: selectedPayment === 'CREDIT'
        ? {
            name: customerName,
            phone: customerPhone,
            dueDate,
            note: creditNote,
          }
        : null,
      };

      try {
        // Save to local sync queue first (offline-first approach)
        
        // await SyncQueueRepository.add('ORDER', orderData);

        const payload = {
          items: items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          paymentMethod: selectedPayment,
          customerName:
            selectedPayment === 'CREDIT'
              ? customerName
              : undefined,
          customerPhone:
            selectedPayment === 'CREDIT'
              ? customerPhone
              : undefined,
        };

        console.log(
          'ORDER PAYLOAD:',
          JSON.stringify(payload, null, 2)
        );

        await OrderRepository.savePending({
          items: items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.product.price,
            unitCost: item.product.costPrice || 0,
          })),
          paymentMethod: selectedPayment,
          totalAmount: total,
          totalProfit: items.reduce(
            (sum, item) => sum + (item.product.price - (item.product.costPrice || 0)) * item.quantity,
            0
          ),
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
        });
        await useProductStore.getState().fetchProducts();
        inventoryAlertService.checkAndNotify().catch(() => undefined);
        syncService.forceSync().catch(() => undefined);

        
        // Show success message
        const change = receivedAmount - total;
        Alert.alert(
          'အောင်မြင်ပါသည်',
          selectedPayment === 'CASH' && change > 0
            ? `ငွေသားအောင်မြင်စွာ ရှင်းလင်းပြီးပါပြီ။\nအပိုငွေ: ${formatCurrency(change)}`
            : 'အရောင်းအမိန့် အောင်မြင်စွာ ပြီးစီးပါသည်',
          [
            { 
              text: 'OK', 
              onPress: () => {
                clearCart();
                navigation.navigate('POS');
              }
            }
          ]
        );
      // } catch (error) {
      //   Alert.alert('အမှား', 'အရောင်းအမိန့် မအောင်မြင်ပါ။ နောက်မှထပ်မံကြိုးစားပါ');
      // } 
      } catch (error: any) {

        console.log(
          'ORDER ERROR RESPONSE:',
          error?.response?.data
        );

        console.log(
          'ORDER ERROR STATUS:',
          error?.response?.status
        );

        console.log(
          'ORDER ERROR FULL:',
          error
        );

        Alert.alert(
          'Payment failed',
          error?.response?.data?.message ||
            error?.message ||
            'Unable to complete the order.'
        );

      }
      finally {
        setLoading(false);
      }
    };

    const NumberPad = () => {
      const numbers = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['C', '0', '⌫'],
      ];

      const handlePress = (value: string) => {
        if (value === 'C') {
          handleAmountChange(0);
        } else if (value === '⌫') {
          const newAmount = Math.floor(receivedAmount / 10);
          handleAmountChange(newAmount);
        } else {
          const newAmount = receivedAmount * 10 + parseInt(value);
          handleAmountChange(newAmount);
        }
      };

      return (
        <View style={styles.numberPad}>
          {numbers.map((row, i) => (
            <View key={i} style={styles.numberRow}>
              {row.map(num => {
                const label = num === 'C' ? 'ဖျက်ရန်' : num;
                return (
                  <TouchableOpacity
                    key={num}
                    style={styles.numberButton}
                    onPress={() => handlePress(num)}
                  >
                    <Text style={styles.numberButtonText}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      );
    };

    if (items.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyText}>ဈေးခြင်းထဲတွင် ပစ္စည်းမရှိပါ</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>POS သို့ပြန်သွားရန်</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const change = calculateChange(receivedAmount, total);

    return (
      <ScrollView style={styles.container}>
        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.sectionTitle}>အမိန့်အကျဉ်းချုပ်</Text>
          {items.map((item, index) => (
            <View key={index} style={styles.orderItem}>
              <View style={styles.orderItemInfo}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemDetail}>
                  {formatCurrency(item.product.price)} x {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemPrice}>
                {formatCurrency(item.totalPrice)}
              </Text>
            </View>
          ))}
          
          <View style={styles.divider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>စုစုပေါင်း</Text>
            <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>ငွေချေနည်းရွေးချယ်ရန်</Text>
          <View style={styles.paymentMethods}>
            <TouchableOpacity
              style={[
                styles.paymentButton,
                selectedPayment === 'CASH' && styles.paymentButtonActive,
              ]}
              onPress={() => handlePaymentMethodSelect('CASH')}
            >
              <Ionicons 
                name="cash-outline" 
                size={24} 
                color={selectedPayment === 'CASH' ? COLORS.white : COLORS.dark} 
              />
              <Text
                style={[
                  styles.paymentButtonText,
                  selectedPayment === 'CASH' && styles.paymentButtonTextActive,
                ]}
              >
                ငွေသား
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.paymentButton,
                selectedPayment === 'CARD' && styles.paymentButtonActive,
              ]}
              onPress={() => handlePaymentMethodSelect('CARD')}
            >
              <Ionicons 
                name="card-outline" 
                size={24} 
                color={selectedPayment === 'CARD' ? COLORS.white : COLORS.dark} 
              />
              <Text
                style={[
                  styles.paymentButtonText,
                  selectedPayment === 'CARD' && styles.paymentButtonTextActive,
                ]}
              >
                ကဒ်
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.paymentButton,
                selectedPayment === 'QR' && styles.paymentButtonActive,
              ]}
              onPress={() => handlePaymentMethodSelect('QR')}
            >
              <Ionicons 
                name="qr-code-outline" 
                size={24} 
                color={selectedPayment === 'QR' ? COLORS.white : COLORS.dark} 
              />
              <Text
                style={[
                  styles.paymentButtonText,
                  selectedPayment === 'QR' && styles.paymentButtonTextActive,
                ]}
              >
                QR Code
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.paymentButton,
                selectedPayment === 'TRANSFER' && styles.paymentButtonActive,
              ]}
              onPress={() => handlePaymentMethodSelect('TRANSFER')}
            >
              <Ionicons 
                name="swap-horizontal-outline" 
                size={24} 
                color={selectedPayment === 'TRANSFER' ? COLORS.white : COLORS.dark} 
              />
              <Text
                style={[
                  styles.paymentButtonText,
                  selectedPayment === 'TRANSFER' && styles.paymentButtonTextActive,
                ]}
              >
                ငွေလွှဲ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentButton,
                selectedPayment === 'CREDIT' &&
                  styles.paymentButtonActive,
              ]}
              onPress={() => handlePaymentMethodSelect('CREDIT')}
            >
              <Ionicons
                name="time-outline"
                size={24}
                color={
                  selectedPayment === 'CREDIT'
                    ? COLORS.white
                    : COLORS.dark
                }
              />

              <Text
                style={[
                  styles.paymentButtonText,
                  selectedPayment === 'CREDIT' &&
                    styles.paymentButtonTextActive,
                ]}
              >
                အကြွေး
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cash Amount Section */}
        {selectedPayment === 'CASH' && (
          <View style={styles.cashSection}>
            <Text style={[styles.sectionTitle, styles.cashSectionTitle]}>ငွေသားဖြင့်ရှင်းရန်</Text>
            
            <View style={styles.amountDisplay}>
              <Text style={styles.amountLabel}>ရရှိငွေ</Text>
              <Text style={styles.amountValue}>
                {formatCurrency(receivedAmount)}
              </Text>
            </View>
            
            {receivedAmount >= total && (
              <View style={styles.changeRow}>
                <Text style={styles.changeLabel}>အပိုငွေ</Text>
                <Text style={styles.changeValue}>
                  {formatCurrency(change)}
                </Text>
              </View>
            )}
            
            {showNumberPad && <NumberPad />}
          </View>
        )}

        {selectedPayment === 'CREDIT' && (
        <View style={styles.cashSection}>

          <Text style={styles.sectionTitle}>
            အကြွေးရောင်းချမှု အချက်အလက်
          </Text>

          <TextInput
            style={styles.input}
            placeholder="ဖောက်သည်အမည်"
            value={customerName}
            onChangeText={setCustomerName}
          />

          <TextInput
            style={styles.input}
            placeholder="ဖုန်းနံပါတ်"
            keyboardType="phone-pad"
            value={customerPhone}
            onChangeText={setCustomerPhone}
          />

          <TextInput
            style={styles.input}
            placeholder="Due Date (YYYY-MM-DD)"
            value={dueDate}
            onChangeText={setDueDate}
          />

          <TextInput
            style={[
              styles.input,
              { height: 80 }
            ]}
            placeholder="မှတ်ချက်"
            multiline
            value={creditNote}
            onChangeText={setCreditNote}
          />

          <View style={styles.amountDisplay}>
            <Text style={styles.amountLabel}>
              ပေးရန်ကျန်ငွေ
            </Text>

            <Text style={styles.amountValue}>
              {formatCurrency(total)}
            </Text>
          </View>

        </View>
      )}  

        {/* Checkout Button */}
        <TouchableOpacity
          style={[
            styles.checkoutButton,
            (selectedPayment === 'CASH' && receivedAmount < total) && styles.checkoutButtonDisabled
          ]}
          onPress={handleCheckout}
          disabled={loading || (selectedPayment === 'CASH' && receivedAmount < total)}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.checkoutButtonText}>
              အတည်ပြုပြီး ငွေရှင်းမည်
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.light,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: moderateScale(20),
    },
    emptyText: {
      fontSize: moderateScale(16),
      fontFamily: FONTS.regular,
      color: COLORS.gray,
      marginTop: moderateScale(16),
      marginBottom: moderateScale(20),
    },
    backButton: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(12),
      borderRadius: moderateScale(8),
    },
    backButtonText: {
      color: COLORS.white,
      fontSize: moderateScale(16),
      fontFamily: FONTS.bold,
    },
    orderSummary: {
      backgroundColor: COLORS.white,
      margin: moderateScale(15),
      padding: moderateScale(15),
      borderRadius: moderateScale(12),
    },
    sectionTitle: {
      fontSize: moderateScale(16),
      fontFamily: FONTS.bold,
      marginBottom: moderateScale(15),
      color: COLORS.dark,
    },
    orderItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: moderateScale(8),
    },
    orderItemInfo: {
      flex: 2,
    },
    itemName: {
      fontSize: moderateScale(14),
      fontFamily: FONTS.medium,
      color: COLORS.dark,
    },
    itemDetail: {
      fontSize: moderateScale(12),
      fontFamily: FONTS.regular,
      color: COLORS.gray,
      marginTop: moderateScale(2),
    },
    itemPrice: {
      fontSize: moderateScale(14),
      fontFamily: FONTS.bold,
      color: COLORS.primary,
    },
    divider: {
      height: 1,
      backgroundColor: COLORS.grayLight,
      marginVertical: moderateScale(12),
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: moderateScale(5),
    },
    totalLabel: {
      fontSize: moderateScale(18),
      fontFamily: FONTS.bold,
      color: COLORS.dark,
    },
    totalAmount: {
      fontSize: moderateScale(20),
      fontFamily: FONTS.bold,
      color: COLORS.primary,
    },
    paymentSection: {
      backgroundColor: COLORS.white,
      marginHorizontal: moderateScale(15),
      marginBottom: moderateScale(15),
      padding: moderateScale(15),
      borderRadius: moderateScale(12),
    },
    paymentMethods: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    paymentButton: {
      flex: 1,
      backgroundColor: COLORS.light,
      paddingVertical: moderateScale(12),
      marginHorizontal: moderateScale(4),
      borderRadius: moderateScale(8),
      alignItems: 'center',
      gap: moderateScale(4),
    },
    paymentButtonActive: {
      backgroundColor: COLORS.primary,
    },
    paymentButtonText: {
      fontSize: moderateScale(12),
      fontFamily: FONTS.medium,
      color: COLORS.dark,
    },
    paymentButtonTextActive: {
      color: COLORS.white,
    },
    cashSection: {
      backgroundColor: COLORS.white,
      marginHorizontal: moderateScale(15),
      marginBottom: moderateScale(12),
      padding: moderateScale(12),
      borderRadius: moderateScale(12),
    },
    amountDisplay: {
      backgroundColor: COLORS.light,
      borderRadius: moderateScale(10),
      padding: moderateScale(8),
      alignItems: 'center',
      marginBottom: moderateScale(8),
    },
    amountLabel: {
      fontSize: moderateScale(12),
      fontFamily: FONTS.regular,
      color: COLORS.gray,
      marginBottom: moderateScale(5),
    },
    amountValue: {
      fontSize: moderateScale(20),
      fontFamily: FONTS.bold,
      color: COLORS.primary,
    },
    changeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: COLORS.success + '10',
      padding: moderateScale(15),
      borderRadius: moderateScale(10),
      marginBottom: moderateScale(15),
    },
    changeLabel: {
      fontSize: moderateScale(16),
      fontFamily: FONTS.regular,
      color: COLORS.dark,
    },
    changeValue: {
      fontSize: moderateScale(18),
      fontFamily: FONTS.bold,
      color: COLORS.success,
    },
    numberPad: {
      marginTop: moderateScale(6),
    },
    numberRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: moderateScale(8),
    },
    numberButton: {
      flex: 1,
      backgroundColor: COLORS.light,
      paddingVertical: moderateScale(8),
      marginHorizontal: moderateScale(3),
      borderRadius: moderateScale(8),
      alignItems: 'center',
    },
    numberButtonText: {
      fontSize: moderateScale(16),
      fontFamily: FONTS.bold,
      color: COLORS.dark,
    },
    cashSectionTitle: {
      fontSize: moderateScale(14),
      marginBottom: moderateScale(10),
      fontFamily: FONTS.bold,
      color: COLORS.dark,
    },
    checkoutButton: {
      height: getButtonHeight('large'),
      backgroundColor: COLORS.success,
      margin: moderateScale(15),
      borderRadius: moderateScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: moderateScale(30),
    },
    checkoutButtonDisabled: {
      backgroundColor: COLORS.gray,
      opacity: 0.5,
    },
    checkoutButtonText: {
      color: COLORS.white,
      fontSize: moderateScale(18),
      fontFamily: FONTS.bold,
    },
    input: {
    backgroundColor: COLORS.light,
    borderRadius: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    marginBottom: moderateScale(10),
    fontSize: moderateScale(14),
  },
  });
