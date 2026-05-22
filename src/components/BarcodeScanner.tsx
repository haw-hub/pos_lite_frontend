// src/components/BarcodeScanner.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../config/theme';
import { moderateScale, getButtonHeight } from '../utils/responsive';

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  visible,
  onClose,
  onScan,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [torchOn, setTorchOn] = useState(false);

  // Request permission when modal opens
  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  const handleBarcodeScanned = (data: any) => {
    if (!scanning) return;
    
    // Vibrate on successful scan
    Vibration.vibrate(100);
    
    setScanning(false);
    const scannedValue = data.data;
    console.log('📷 Scanned barcode:', scannedValue);
    
    onScan(scannedValue);
    
    // Reset scanning after delay
    setTimeout(() => {
      setScanning(true);
    }, 2000);
  };

  const toggleTorch = () => {
    setTorchOn(!torchOn);
  };

  if (!permission) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.content}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.message}>ကင်မရာ ခွင့်ပြုချက် တောင်းဆိုနေပါသည်...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.content}>
            <Ionicons name="camera-outline" size={64} color={COLORS.danger} />
            <Text style={styles.message}>ကင်မရာ ခွင့်ပြုချက် လိုအပ်ပါသည်</Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>ခွင့်ပြုမည်</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: COLORS.gray, marginTop: 10 }]}
              onPress={onClose}
            >
              <Text style={styles.permissionButtonText}>ပိတ်မည်</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* Camera View */}
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: [
              'codabar',
              'code39',
              'code93',
              'code128',
              'ean8',
              'ean13',
              'itf14',
              'upc_a',
              'upc_e',
              'qr',
              'pdf417',
              'aztec',
              'datamatrix',
            ],
          }}
          enableTorch={torchOn}
        >
          {/* Scanner Overlay */}
          <View style={styles.overlay}>
            <View style={styles.topOverlay} />
            <View style={styles.middleContainer}>
              <View style={styles.leftOverlay} />
              <View style={styles.scannerFrame}>
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
                <View style={styles.scannerLine} />
              </View>
              <View style={styles.rightOverlay} />
            </View>
            <View style={styles.bottomOverlay}>
              <Text style={styles.scanText}>
                ဘားကုဒ်ကို မျဉ်းအတွင်းထည့်ပါ
              </Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={onClose}>
              <Ionicons name="close" size={30} color={COLORS.white} />
              <Text style={styles.controlText}>ပိတ်မည်</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={toggleTorch}>
              <Ionicons
                name={torchOn ? 'flash' : 'flash-off'}
                size={30}
                color={COLORS.white}
              />
              <Text style={styles.controlText}>မီး</Text>
            </TouchableOpacity>
          </View>
        </CameraView>

        {/* Scanning Status */}
        {!scanning && (
          <View style={styles.successOverlay}>
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={50} color={COLORS.success} />
              <Text style={styles.successText}>ဖတ်ပြီးပါပြီ</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 20,
  },
  message: {
    marginTop: 20,
    fontSize: moderateScale(16),
    fontFamily: FONTS.regular,
    color: COLORS.dark,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(30),
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(8),
    marginTop: moderateScale(20),
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  middleContainer: {
    flexDirection: 'row',
    height: moderateScale(250),
  },
  leftOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scannerFrame: {
    width: moderateScale(250),
    height: moderateScale(250),
    position: 'relative',
  },
  rightOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    color: COLORS.white,
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    marginTop: moderateScale(20),
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: moderateScale(40),
    height: moderateScale(40),
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primary,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: moderateScale(40),
    height: moderateScale(40),
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: moderateScale(40),
    height: moderateScale(40),
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primary,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: moderateScale(40),
    height: moderateScale(40),
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
  },
  scannerLine: {
    position: 'absolute',
    top: moderateScale(125),
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  controls: {
    position: 'absolute',
    bottom: moderateScale(30),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: moderateScale(30),
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(30),
  },
  controlText: {
    color: COLORS.white,
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    marginTop: moderateScale(5),
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBox: {
    backgroundColor: COLORS.white,
    padding: moderateScale(20),
    borderRadius: moderateScale(15),
    alignItems: 'center',
  },
  successText: {
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
    color: COLORS.success,
    marginTop: moderateScale(10),
  },
});

export default BarcodeScanner;