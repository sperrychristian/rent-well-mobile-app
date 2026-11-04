import { File, Paths } from 'expo-file-system';
import { Sharing } from '../../../services/systemPickers';
import { buildChecklistText } from './checklistHelpers';

// turns an address into something safe for a file name
function fileSafe(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// same pattern as the expense export, write a temporary text file and open the share sheet
export async function shareChecklistText(checklist) {
  const text = buildChecklistText(checklist);
  const file_name =
    'rent-well-' +
    fileSafe(checklist.type) +
    '-' +
    fileSafe(checklist.property) +
    '-' +
    (checklist.signed_on || checklist.created_at) +
    '.txt';

  const file = new File(Paths.cache, file_name);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(text);

  const can_share = await Sharing.isAvailableAsync();
  if (!can_share) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/plain',
    dialogTitle: 'Export checklist',
    UTI: 'public.plain-text',
  });
}
