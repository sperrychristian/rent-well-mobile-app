import { File, Directory, Paths } from 'expo-file-system';

const photos_folder = 'checklist_photos';
const demo_folder = 'demo_checklist_photos';

// same idea as documents, demo photos go in the cache and real ones in the document folder so they survive
function folderFor(in_demo) {
  return in_demo
    ? new Directory(Paths.cache, demo_folder)
    : new Directory(Paths.document, photos_folder);
}

// I only save the stored name on the item and rebuild the full path here, since iOS moves the app folder
export function getPhotoUri(stored_name, in_demo) {
  if (!stored_name) {
    return null;
  }
  return new File(folderFor(in_demo), stored_name).uri;
}

// the picker hands back a temporary file, so I copy it into the app's folder and keep the new name
export async function saveChecklistPhoto(source_uri, in_demo) {
  const folder = folderFor(in_demo);
  folder.create({ intermediates: true, idempotent: true });
  const stored_name = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
  await new File(source_uri).copy(new File(folder, stored_name));
  return stored_name;
}

export function deleteChecklistPhoto(stored_name, in_demo) {
  if (!stored_name) {
    return;
  }
  try {
    const file = new File(folderFor(in_demo), stored_name);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.log('Could not delete checklist photo', error);
  }
}

// wipes every photo taken during a demo
export function clearDemoChecklistPhotos() {
  try {
    const folder = new Directory(Paths.cache, demo_folder);
    if (folder.exists) {
      folder.delete();
    }
  } catch (error) {
    console.log('Could not clear demo checklist photos', error);
  }
}
