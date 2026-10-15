import { View, StyleSheet } from 'react-native';
import { SheetHandle, sheet_styles } from './sheet';
import { SPACING, SIZES } from '../../theme';

// the card every pop-up form sits in: the shared sheet look with a grab bar on top
// it keeps the old Card's place in the layout (90% wide, centered, space above and below),
// so the modals only had to change which Card they import
function ModalCard(props) {
  return (
    <View style={[sheet_styles.dialog, styles.card, props.style]}>
      <SheetHandle />
      {props.children}
    </View>
  );
}

export default ModalCard;

const styles = StyleSheet.create({
  card: {
    width: '90%',
    maxWidth: SIZES.content_max_width,
    marginVertical: SPACING.md,
    paddingTop: SPACING.sm,
  },
});
