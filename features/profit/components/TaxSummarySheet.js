import { useState } from 'react';
import { Text } from 'react-native';
import FormSheet from '../../payments/components/FormSheet';
import { Field, ChipPicker } from '../../payments/components/FormBits';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useTaxSummary } from '../hooks/useProfitReport';
import { shareTaxCsv, shareTaxText } from '../utils/shareTaxSummary';
import { SPACING, TYPE } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// the Schedule E style summary for one year, shared as a CSV (for a spreadsheet or an accountant) or as text
// props: visible, years (YYYY strings, newest first), year (the one to start on), onClose
function TaxSummarySheet(props) {
  const toast = useToast();
  const tax = useTaxSummary();
  const [year, setYear] = useState(props.year || props.years[0]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function share(kind) {
    setBusy(kind);
    setError('');
    try {
      if (kind === 'csv') {
        await shareTaxCsv(await tax.csv(year), year);
      } else {
        await shareTaxText(await tax.text(year), year);
      }
      toast.show('Tax summary ready', 'document-text-outline');
      props.onClose();
    } catch (share_error) {
      console.log('Could not share the tax summary', share_error.message);
      setError(share_error.message);
    }
    setBusy(null);
  }

  return (
    <FormSheet
      visible={props.visible}
      title="Tax Summary"
      subtitle="Rent collected and deductible expenses by Schedule E line"
      error={error}
      submit_label="Share CSV"
      submit_icon="share-outline"
      busy={busy === 'csv'}
      onSubmit={() => share('csv')}
      onClose={props.onClose}
    >
      <Field label="Tax year">
        <ChipPicker
          label="Tax year"
          options={props.years.map((item) => ({ value: item, label: item }))}
          value={year}
          onChange={setYear}
        />
      </Field>
      <Button
        variant="tertiary"
        icon="document-text-outline"
        title="Share as Text"
        loading={busy === 'text'}
        onPress={() => share('text')}
      />
      <Text style={styles.note}>
        A summary for you and your accountant, not tax advice. Capital improvements and other costs
        marked not deductible are listed on their own line.
      </Text>
    </FormSheet>
  );
}

export default TaxSummarySheet;

const styles = themedStyles((COLORS) => ({
  note: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginTop: SPACING.sm,
  },
}));
