import { Alert } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { allowed_mime_types, max_document_bytes } from '../../../data/documentOptions';
import { extensionOf, guessMimeType } from './documentHelpers';

const documents_folder = 'documents';
const demo_folder = 'demo_documents';

// demo files go in the cache so they never mix with real ones, real files go in the document folder the system won't clear
function folderFor(in_demo) {
  return in_demo
    ? new Directory(Paths.cache, demo_folder)
    : new Directory(Paths.document, documents_folder);
}

// iOS moves the app's folder between launches and updates, so I only ever save the stored name and rebuild the full path here
export function getDocumentUri(stored_name, in_demo) {
  if (!stored_name) {
    return null;
  }
  return new File(folderFor(in_demo), stored_name).uri;
}

// turns away anything over the limit, true means the file is fine
function checkSize(size) {
  if (size > max_document_bytes) {
    Alert.alert('File too large', 'Pick a file under 25 MB.');
    return false;
  }
  return true;
}

// opens the file picker and hands back the picked file, or null if it was cancelled or too big
export async function pickDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: allowed_mime_types,
    copyToCacheDirectory: true,
  });
  if (result.canceled) {
    return null;
  }
  const asset = result.assets[0];
  // the picker doesn't always report a size, so I read it off the file instead
  const size = typeof asset.size === 'number' ? asset.size : new File(asset.uri).size;
  if (!checkSize(size)) {
    return null;
  }
  return {
    uri: asset.uri,
    file_name: asset.name,
    mime_type: asset.mimeType || guessMimeType(asset.name),
    size: size,
  };
}

// a camera photo shaped the same way as a picked file, or null if it's too big
export function fileFromPhoto(asset, file_name) {
  const size = typeof asset.fileSize === 'number' ? asset.fileSize : new File(asset.uri).size;
  if (!checkSize(size)) {
    return null;
  }
  return {
    uri: asset.uri,
    file_name: file_name,
    mime_type: asset.mimeType || 'image/jpeg',
    size: size,
  };
}

// copies the file into the app's own folder under a unique name and gives back that name
export async function saveDocumentFile(source_uri, file_name, in_demo) {
  const folder = folderFor(in_demo);
  folder.create({ intermediates: true, idempotent: true });
  const stored_name =
    Date.now().toString() + '-' + Math.random().toString(36).slice(2, 7) + extensionOf(file_name);
  await new File(source_uri).copy(new File(folder, stored_name));
  return stored_name;
}

export function deleteDocumentFile(stored_name, in_demo) {
  if (!stored_name) {
    return;
  }
  try {
    const file = new File(folderFor(in_demo), stored_name);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.log('Could not delete document file', error);
  }
}

// wipes every file added during a demo
export function clearDemoFiles() {
  try {
    const folder = new Directory(Paths.cache, demo_folder);
    if (folder.exists) {
      folder.delete();
    }
  } catch (error) {
    console.log('Could not clear demo files', error);
  }
}

// the app can't show PDFs or Word files itself, so they open through the share sheet, which can preview them or send them to another app
export async function openDocument(document, in_demo) {
  if (document.sample) {
    Alert.alert('Sample document', 'This is sample data, so there is no real file to open.');
    return;
  }
  const uri = getDocumentUri(document.stored_name, in_demo);
  if (!uri || !new File(uri).exists) {
    Alert.alert('File missing', 'The file for this document could not be found.');
    return;
  }
  const can_share = await Sharing.isAvailableAsync();
  if (!can_share) {
    Alert.alert('Sharing unavailable', 'This device cannot open or share files.');
    return;
  }
  try {
    await Sharing.shareAsync(uri, { mimeType: document.mime_type, dialogTitle: document.name });
  } catch (error) {
    console.log('Could not open document', error);
    Alert.alert('Could not open', 'The file could not be opened or shared.');
  }
}
