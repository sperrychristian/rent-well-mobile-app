import { useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../../../components/PrimaryButton';
import { SPACING, TYPE, RADIUS, NUMBERS } from '../../../theme';
import { list_styles } from '../../../components/ui/listStyles';
import { formatCurrency } from '../../../utils/formatCurrency';
import { useReduceMotion } from '../../../components/ui/useReduceMotion';
import ReceiptImage from '../../../components/ReceiptImage';
import { themedStyles } from '../../../utils/themedStyles';

function ExpenseDetailsModal(props) {
  // with Reduce Motion on the sheet just appears, no slide or fade
  const reduce_motion = useReduceMotion();
  const insets = useSafeAreaInsets();
  // remember which photo is open full size, null means none
  const [full_photo_uri, setFullPhotoUri] = useState(null);

  // order is undefined while the modal is closed, so I fall back to an empty list
  const expenses = props.order ? props.order.expenses || [] : [];
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // I clear the full size photo on close so it doesn't reopen next time
  function handleClose() {
    setFullPhotoUri(null);
    props.onClose();
  }

  return (
    <Modal
      visible={props.visible}
      animationType={reduce_motion ? 'none' : 'slide'}
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <Text style={styles.heading}>{props.order ? props.order.title : ''}</Text>
        <Text style={styles.total}>Total: {formatCurrency(total)}</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {expenses.map((expense) => (
            <View key={expense.id} style={styles.row}>
              <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
              <Text style={styles.description}>{expense.description || 'No description'}</Text>
              {expense.photo_uri && (
                <Pressable
                  onPress={() => setFullPhotoUri(expense.photo_uri)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Open receipt photo"
                >
                  <ReceiptImage value={expense.photo_uri} style={styles.photo} />
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
        <PrimaryButton
          title="Close"
          variant="secondary"
          onPress={handleClose}
          style={styles.close_button}
        />
        {/* I draw the full size photo as an overlay in this same modal, tapping anywhere closes it */}
        {full_photo_uri && (
          <Pressable
            style={styles.full_overlay}
            onPress={() => setFullPhotoUri(null)}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <ReceiptImage value={full_photo_uri} style={styles.full_photo} resizeMode="contain" />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

export default ExpenseDetailsModal;

const styles = themedStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
  },
  heading: {
    ...TYPE.title,
    color: COLORS.text,
  },
  total: {
    ...TYPE.subheading,
    ...NUMBERS,
    color: COLORS.text_muted,
    marginBottom: SPACING.md,
  },
  list: {
    gap: SPACING.md,
  },
  row: {
    ...list_styles.row,
    padding: SPACING.md,
  },
  amount: {
    ...NUMBERS,
    ...TYPE.heading,
    color: COLORS.text,
  },
  description: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    marginTop: SPACING.xs,
  },
  photo: {
    borderRadius: RADIUS.md,
    width: '100%',
    height: 160,
    marginTop: SPACING.sm,
  },
  close_button: {
    marginHorizontal: 0,
    marginTop: SPACING.md,
  },
  full_overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.photo_backdrop,
    justifyContent: 'center',
  },
  full_photo: {
    width: '100%',
    height: '100%',
  },
}));
