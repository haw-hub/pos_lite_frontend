import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { PNG } from 'pngjs/browser';
import type { VoucherPrintInput } from './voucherPrintService';

export type BluetoothPrinterDevice = {
  address: string;
  name: string;
  bonded?: boolean;
};

const SELECTED_PRINTER_KEY = 'pos_myanmar_selected_bluetooth_printer';

type BluetoothNativeDevice = {
  address?: string;
  id?: string;
  name?: string;
  bonded?: boolean;
};

type BluetoothNativeModule = {
  isBluetoothEnabled: () => Promise<boolean>;
  requestBluetoothEnabled: () => Promise<boolean>;
  getBondedDevices: () => Promise<BluetoothNativeDevice[]>;
  connectToDevice: (address: string, options?: Record<string, unknown>) => Promise<BluetoothNativeDevice>;
  isDeviceConnected: (address: string) => Promise<boolean>;
  disconnectFromDevice: (address: string) => Promise<boolean>;
  writeToDevice: (address: string, base64Data: string) => Promise<boolean>;
};

const getNativeModule = (): BluetoothNativeModule => NativeModules.RNBluetoothClassic as BluetoothNativeModule;

const amount = (value: number) => `${Math.round(Number(value || 0)).toLocaleString('my-MM')} Ks`;

const paymentLabel = (method: string) => {
  switch (method) {
    case 'CASH':
      return 'Cash';
    case 'TRANSFER':
      return 'Digital Pay';
    case 'CREDIT':
      return 'Credit';
    default:
      return method;
  }
};

const ensureNativeBluetooth = () => {
  if (!NativeModules.RNBluetoothClassic) {
    throw new Error('Bluetooth printer သုံးရန် Expo Go မဟုတ်သော development build / APK build လိုအပ်ပါသည်။');
  }
};

const requestAndroidPermissions = async () => {
  if (Platform.OS !== 'android') return;
  if (Platform.Version < 31) return;

  const permissions = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  ];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  const denied = permissions.some(permission => result[permission] !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied) {
    throw new Error('Bluetooth permission မရသေးပါ။ Phone Settings မှ permission ပေးပါ။');
  }
};

const toDevice = (device: BluetoothNativeDevice): BluetoothPrinterDevice => ({
  address: device.address || device.id,
  name: device.name || 'Bluetooth Device',
  bonded: Boolean(device.bonded),
} as BluetoothPrinterDevice);

const connectDevice = async (address: string) => {
  ensureNativeBluetooth();
  await requestAndroidPermissions();
  const bluetooth = getNativeModule();

  const enabled = await bluetooth.isBluetoothEnabled();
  if (!enabled) {
    await bluetooth.requestBluetoothEnabled();
  }

  const bonded = await bluetooth.getBondedDevices();
  const device = bonded.find(item => item.address === address || item.id === address);
  if (!device) {
    throw new Error('Printer ကို phone Bluetooth setting မှာ အရင် pair လုပ်ပါ။');
  }

  const alreadyConnected = await bluetooth.isDeviceConnected(address).catch(() => false);
  if (!alreadyConnected) {
    const connected = await bluetooth.connectToDevice(address, {});
    if (!connected) {
      throw new Error('Printer ချိတ်ဆက်မရပါ။ Printer ဖွင့်ထား/paired ဖြစ်ထားကြောင်း စစ်ပါ။');
    }
  }
  return {
    write: (data: string) => bluetooth.writeToDevice(address, Buffer.from(data, 'utf8').toString('base64')),
    writeRaw: (data: Buffer) => bluetooth.writeToDevice(address, data.toString('base64')),
    isConnected: () => bluetooth.isDeviceConnected(address),
  };
};

const line = (text = '') => `${text}\n`;

const buildVoucherText = (input: VoucherPrintInput) => {
  const createdAt = new Date(input.createdAt).toLocaleString('my-MM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const width = 32;
  const divider = '-'.repeat(width);
  const itemRows = input.items.map(item => {
    const name = item.product.name;
    const qty = `${item.quantity} ${item.unitLabel}`;
    return [
      line(name),
      line(`${qty} x ${amount(item.unitPrice)} = ${amount(item.totalPrice)}`),
    ].join('');
  }).join('');

  return [
    '\x1B@',
    '\x1Ba\x01',
    line(input.shopName || 'POS Myanmar'),
    line('Sale Voucher'),
    '\x1Ba\x00',
    line(divider),
    line(`Voucher: ${input.orderNumber}`),
    line(`Date: ${createdAt}`),
    line(`Cashier: ${input.cashierName || '-'}`),
    input.customerName ? line(`Customer: ${input.customerName}`) : '',
    input.customerPhone ? line(`Phone: ${input.customerPhone}`) : '',
    line(divider),
    itemRows,
    line(divider),
    line(`Total: ${amount(input.totalAmount)}`),
    line(`Payment: ${paymentLabel(input.paymentMethod)}`),
    input.paymentMethod === 'CASH' ? line(`Received: ${amount(input.cashReceived || 0)}`) : '',
    input.paymentMethod === 'CASH' ? line(`Change: ${amount(input.change || 0)}`) : '',
    line(divider),
    '\x1Ba\x01',
    line('Thank you'),
    line('Powered by POS Myanmar'),
    '\n\n\n',
    '\x1DVA\x00',
  ].join('');
};

const buildRasterCommandFromPngBase64 = (pngBase64: string) => {
  const png = PNG.sync.read(Buffer.from(pngBase64, 'base64'));
  const widthBytes = Math.ceil(png.width / 8);
  const raster = Buffer.alloc(widthBytes * png.height);

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const pixelIndex = (png.width * y + x) << 2;
      const alpha = png.data[pixelIndex + 3];
      if (alpha < 30) continue;

      const red = png.data[pixelIndex];
      const green = png.data[pixelIndex + 1];
      const blue = png.data[pixelIndex + 2];
      const luminance = (red * 0.299) + (green * 0.587) + (blue * 0.114);
      if (luminance > 180) continue;

      const byteIndex = y * widthBytes + Math.floor(x / 8);
      raster[byteIndex] |= 0x80 >> (x % 8);
    }
  }

  const header = Buffer.from([
    0x1b, 0x40,
    0x1d, 0x76, 0x30, 0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    png.height & 0xff,
    (png.height >> 8) & 0xff,
  ]);
  const footer = Buffer.from([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x41, 0x00]);
  return Buffer.concat([header, raster, footer]);
};

export const bluetoothPrinterService = {
  isNativeAvailable: () => Boolean(NativeModules.RNBluetoothClassic),

  listPairedDevices: async (): Promise<BluetoothPrinterDevice[]> => {
    ensureNativeBluetooth();
    await requestAndroidPermissions();
    const bluetooth = getNativeModule();
    const enabled = await bluetooth.isBluetoothEnabled();
    if (!enabled) {
      await bluetooth.requestBluetoothEnabled();
    }
    const devices = await bluetooth.getBondedDevices();
    return devices.map(toDevice);
  },

  getSavedPrinter: async (): Promise<BluetoothPrinterDevice | null> => {
    const raw = await AsyncStorage.getItem(SELECTED_PRINTER_KEY);
    return raw ? JSON.parse(raw) as BluetoothPrinterDevice : null;
  },

  savePrinter: async (device: BluetoothPrinterDevice) => {
    await AsyncStorage.setItem(SELECTED_PRINTER_KEY, JSON.stringify(device));
  },

  clearPrinter: async () => {
    await AsyncStorage.removeItem(SELECTED_PRINTER_KEY);
  },

  connect: async (device: BluetoothPrinterDevice) => {
    const nativeDevice = await connectDevice(device.address);
    await bluetoothPrinterService.savePrinter(device);
    return nativeDevice.isConnected();
  },

  disconnect: async (device: BluetoothPrinterDevice) => {
    ensureNativeBluetooth();
    await getNativeModule().disconnectFromDevice(device.address).catch(() => false);
  },

  printTest: async (device: BluetoothPrinterDevice) => {
    const nativeDevice = await connectDevice(device.address);
    await nativeDevice.write('\x1B@\x1Ba\x01POS Myanmar\nBluetooth Printer OK\n\n\n\x1DVA\x00');
  },

  printVoucher: async (input: VoucherPrintInput) => {
    const saved = await bluetoothPrinterService.getSavedPrinter();
    if (!saved) {
      throw new Error('Bluetooth printer မရွေးရသေးပါ။ Settings > Bluetooth Printer / Scanner မှ printer ရွေးပါ။');
    }
    const nativeDevice = await connectDevice(saved.address);
    await nativeDevice.write(buildVoucherText(input));
  },

  printVoucherImageBase64: async (pngBase64: string) => {
    const saved = await bluetoothPrinterService.getSavedPrinter();
    if (!saved) {
      throw new Error('Bluetooth printer မရွေးရသေးပါ။ Settings > Bluetooth Printer / Scanner မှ printer ရွေးပါ။');
    }
    const nativeDevice = await connectDevice(saved.address);
    await nativeDevice.writeRaw(buildRasterCommandFromPngBase64(pngBase64));
  },
};
