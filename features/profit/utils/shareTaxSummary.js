import { File, Paths } from 'expo-file-system';
import { Sharing } from '../../../services/systemPickers';
import { shareCsvText } from '../../expenses/utils/exportExpenses';

// the tax summary as a CSV (for a spreadsheet or an accountant) or as plain text (to read or paste)
// csv and text are already built, real mode gets them from the server and the demo builds them locally

export async function shareTaxCsv(csv, year) {
  await shareCsvText(csv, 'tax-summary-' + year + '.csv', 'Share tax summary');
}

export async function shareTaxText(text, year) {
  const file = new File(Paths.cache, 'tax-summary-' + year + '.txt');
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
    dialogTitle: 'Share tax summary',
    UTI: 'public.plain-text',
  });
}
