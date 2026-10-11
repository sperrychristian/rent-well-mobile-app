import { Platform } from 'react-native';

// ===== PHYSICAL PHONE: put your computer's LAN IP here =====
// the simulator can reach the backend at localhost, a real phone can't, it needs the computer's address on the wifi
// find it on a Mac with: ipconfig getifaddr en0
// example: const lan_api_url = 'http://192.168.1.20:4000';
const lan_api_url = null;
// ===========================================================

// the Android emulator reaches the computer at 10.0.2.2, the iOS simulator can use localhost
const simulator_api_url =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

export const api_base_url = lan_api_url || simulator_api_url;
