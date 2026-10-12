import { Modal, Pressable, Image, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONTS } from '../../../theme';

// the full size photo, tap anywhere to close
// props: url (null hides it), onClose
function ImageViewerModal(props) {
  return (
    <Modal visible={!!props.url} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={props.onClose}
        accessibilityRole="button"
        accessibilityLabel="Close photo"
      >
        {props.url ? (
          <Image source={{ uri: props.url }} style={styles.image} resizeMode="contain" />
        ) : null}
        <Text style={styles.hint}>Tap to close</Text>
      </Pressable>
    </Modal>
  );
}

export default ImageViewerModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.photo_backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '80%',
  },
  hint: {
    color: COLORS.text_light,
    fontFamily: FONTS.body,
    marginTop: SPACING.sm,
  },
});
