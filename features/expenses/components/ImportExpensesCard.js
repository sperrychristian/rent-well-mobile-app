import { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../components/ui/Button';
import ProgressLine from '../../../components/ui/ProgressLine';
import { useToast } from '../../../components/ui/Toast';
import { hapticSuccess } from '../../../utils/haptics';
import { useExpenses } from '../context/ExpensesContext';
import { COLORS, SPACING, TYPE, BORDER, SIZES } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// a quiet card on Expenses for a real landlord who still has expenses saved only on this phone
// one tap uploads them (with their receipts), the phone's copy is only cleared once the server has each one,
// and anything that fails stays here to try again
function ImportExpensesCard() {
  const toast = useToast();
  const { legacy_count, importing, importLegacy } = useExpenses();
  const [last_failures, setLastFailures] = useState([]);

  if (legacy_count === 0 && !importing) {
    return null;
  }

  async function upload() {
    const result = await importLegacy();
    setLastFailures(result.failures || []);
    if (result.imported > 0) {
      hapticSuccess();
      toast.show(
        result.imported === 1 ? '1 expense uploaded' : result.imported + ' expenses uploaded',
        'cloud-done-outline',
      );
    }
  }

  const share = importing ? importing.done / Math.max(importing.total, 1) : 0;
  const count_text = legacy_count === 1 ? '1 expense' : legacy_count + ' expenses';

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.top}>
        <Ionicons name="cloud-upload-outline" size={SIZES.row_icon} color={COLORS.cta} />
        <View style={styles.words}>
          <Text style={styles.title}>{'Upload ' + count_text + ' from this phone'}</Text>
          <Text style={styles.body}>
            They were saved before expenses moved to your account. Nothing on the phone is removed
            until the server has it.
          </Text>
        </View>
      </View>
      {importing ? (
        <ProgressLine
          share={share}
          label={'Uploaded ' + importing.done + ' of ' + importing.total}
          style={styles.progress}
        />
      ) : null}
      {last_failures.length > 0 && !importing ? (
        <Text style={styles.failed} accessibilityLiveRegion="polite">
          {last_failures.length === 1
            ? "1 didn't upload: " + last_failures[0].message
            : last_failures.length + " didn't upload. The first: " + last_failures[0].message}
        </Text>
      ) : null}
      <Button
        variant="secondary"
        size="small"
        icon="cloud-upload-outline"
        title={last_failures.length > 0 ? 'Try Again' : 'Upload ' + count_text}
        loading={!!importing}
        onPress={upload}
        style={styles.button}
      />
    </View>
  );
}

export default ImportExpensesCard;

const styles = themedStyles((COLORS) => ({
  card: {
    paddingVertical: SPACING.md,
    borderTopWidth: BORDER.hairline,
    borderBottomWidth: BORDER.hairline,
    borderColor: COLORS.hairline,
    marginBottom: SPACING.md,
  },
  top: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  words: {
    flex: 1,
  },
  title: {
    ...TYPE.subheading,
    color: COLORS.text,
  },
  body: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginTop: SPACING.xxs,
  },
  progress: {
    marginTop: SPACING.md,
  },
  failed: {
    ...TYPE.body_small,
    color: COLORS.danger_text,
    marginTop: SPACING.sm,
  },
  button: {
    marginTop: SPACING.md,
    marginHorizontal: 0,
    alignSelf: 'flex-start',
  },
}));
