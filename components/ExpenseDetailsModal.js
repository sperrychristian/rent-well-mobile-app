import { useState } from 'react';
import { Modal, View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from './PrimaryButton';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../theme';

function ExpenseDetailsModal(props) {
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
    <Modal visible={props.visible} animationType="slide" onRequestClose={handleClose}>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <Text style={styles.heading}>{props.order ? props.order.title : ''}</Text>
        <Text style={styles.total}>Total: ${total.toFixed(2)}</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {expenses.map((expense) => (
            <View key={expense.id} style={styles.row}>
              <Text style={styles.amount}>${expense.amount.toFixed(2)}</Text>
              <Text style={styles.description}>{expense.description || 'No description'}</Text>
              {expense.photo_uri && (
                <Pressable onPress={() => setFullPhotoUri(expense.photo_uri)}>
                  <Image source={{ uri: expense.photo_uri }} style={styles.photo} />
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
        <PrimaryButton title="Close" onPress={handleClose} style={styles.close_button} />
        {/* I draw the full size photo as an overlay in this same modal, tapping anywhere closes it */}
        {full_photo_uri && (
          <Pressable style={styles.full_overlay} onPress={() => setFullPhotoUri(null)}>
            <Image
              source={{ uri: full_photo_uri }}
              style={styles.full_photo}
              resizeMode="contain"
            />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

export default ExpenseDetailsModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
  },
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
  },
  total: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    marginBottom: SPACING.md,
    opacity: 0.8,
  },
  list: {
    gap: SPACING.md,
  },
  row: {
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
  },
  amount: {
    color: COLORS.text,
    fontFamily: FONTS.body_bold,
    fontSize: FONT_SIZES.body,
  },
  description: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    marginTop: 4,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 8,
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
});
