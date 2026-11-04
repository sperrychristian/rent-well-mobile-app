import { File, Paths } from 'expo-file-system';
import { Sharing } from '../../../services/systemPickers';
import { buildReceiptText } from './ledgerHelpers';

// writes the receipt text to a file in the cache and opens the share sheet, like the expenses CSV export
export async function shareReceipt(payment, ledger, today) {
  const text = buildReceiptText(payment, ledger, today);
  const file = new File(Paths.cache, 'rent-well-receipt-' + payment.id + '.txt');
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
    dialogTitle: 'Share receipt',
    UTI: 'public.plain-text',
  });
}
