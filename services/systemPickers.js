import * as ExpoImagePicker from 'expo-image-picker';
import * as ExpoDocumentPicker from 'expo-document-picker';
import * as ExpoSharing from 'expo-sharing';
import { whileSystemDialog } from './appLock';

// the photo picker, the camera, the file picker, and the share sheet, with the app lock paused while they're up
// on Android each of these opens over the app and sends it to the background, and coming back from one
// should never ask for Face ID, so screens import these instead of the expo modules (same names, same calls)
// the calls read the expo module when they run, not when this loads, so the tests' mocks still apply

function paused(module, name) {
  return (...args) => whileSystemDialog(() => module[name](...args));
}

export const ImagePicker = {
  ...ExpoImagePicker,
  launchCameraAsync: paused(ExpoImagePicker, 'launchCameraAsync'),
  launchImageLibraryAsync: paused(ExpoImagePicker, 'launchImageLibraryAsync'),
  requestCameraPermissionsAsync: paused(ExpoImagePicker, 'requestCameraPermissionsAsync'),
  requestMediaLibraryPermissionsAsync: paused(
    ExpoImagePicker,
    'requestMediaLibraryPermissionsAsync',
  ),
};

export const DocumentPicker = {
  ...ExpoDocumentPicker,
  getDocumentAsync: paused(ExpoDocumentPicker, 'getDocumentAsync'),
};

export const Sharing = {
  ...ExpoSharing,
  shareAsync: paused(ExpoSharing, 'shareAsync'),
};
