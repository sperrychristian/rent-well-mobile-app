import { Modal, View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// the pop-up forms share the sheet look from components/ui, the JSX still says Card
import Card from '../../../components/ui/ModalCard';
import PrimaryButton from '../../../components/PrimaryButton';
import { COLORS, SPACING, TYPE, RADIUS } from '../../../theme';
import { getDocumentUri } from '../utils/documentFiles';
import { isImage, iconFor, expiryTag, daysUntil, formatSize } from '../utils/documentHelpers';

// props: visible, document, in_demo, onOpen, onEdit, onDelete, onClose, and onDismiss (iOS calls it once the modal is fully gone)
function DocumentDetailModal(props) {
  const document = props.document;

  // the screen keeps the document around while the modal slides away, so this only guards the very first render
  if (!document) {
    return null;
  }

  // images show right here, everything else opens through the share sheet
  const preview_uri =
    !document.sample && isImage(document.mime_type)
      ? getDocumentUri(document.stored_name, props.in_demo)
      : null;
  const tag = expiryTag(document.expires_on);

  let end_text = 'None';
  if (document.expires_on) {
    const days = daysUntil(document.expires_on);
    end_text =
      document.expires_on +
      (days < 0 ? ' (ended ' + Math.abs(days) + ' days ago)' : ' (' + days + ' days left)');
  }

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
      onDismiss={props.onDismiss}
    >
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.scroll_content}>
          <Card>
            <View style={styles.title_row}>
              <Ionicons name={iconFor(document.mime_type)} size={26} color={COLORS.text} />
              <Text style={styles.heading}>{document.name}</Text>
            </View>

            <View style={styles.tag_row}>
              {tag && (
                <View style={[styles.tag, tag.expired ? styles.expired_tag : styles.expiring_tag]}>
                  <Text style={[styles.tag_text, !tag.expired && styles.tag_text_dark]}>
                    {tag.text}
                  </Text>
                </View>
              )}
              {document.shared_with_tenant && (
                <View style={[styles.tag, styles.shared_tag]}>
                  <Text style={styles.tag_text}>Shared with tenant</Text>
                </View>
              )}
              {document.sample && (
                <View style={[styles.tag, styles.sample_tag]}>
                  <Text style={styles.tag_text}>Sample</Text>
                </View>
              )}
            </View>

            {preview_uri && (
              <Image source={{ uri: preview_uri }} style={styles.preview} resizeMode="contain" />
            )}

            <Text style={styles.label}>Category</Text>
            <Text style={styles.value}>{document.category}</Text>
            <Text style={styles.label}>Property</Text>
            <Text style={styles.value}>{document.property}</Text>
            <Text style={styles.label}>Tenant</Text>
            <Text style={styles.value}>{document.tenant || 'None'}</Text>
            <Text style={styles.label}>Added</Text>
            <Text style={styles.value}>{document.added_at}</Text>
            <Text style={styles.label}>End date</Text>
            <Text style={styles.value}>{end_text}</Text>
            <Text style={styles.label}>File</Text>
            <Text style={styles.value}>
              {document.file_name}
              {document.size ? ' · ' + formatSize(document.size) : ''}
            </Text>
            <Text style={styles.label}>Shared with tenant</Text>
            <Text style={styles.value}>{document.shared_with_tenant ? 'Yes' : 'No'}</Text>
            {document.notes ? (
              <View>
                <Text style={styles.label}>Notes</Text>
                <Text style={styles.value}>{document.notes}</Text>
              </View>
            ) : null}

            <View style={styles.button_row}>
              <PrimaryButton
                variant="primary"
                title="Open / Share"
                icon="share-outline"
                onPress={props.onOpen}
                style={styles.open_button}
              />
              <PrimaryButton
                variant="secondary"
                title="Edit"
                icon="create-outline"
                onPress={props.onEdit}
                style={styles.edit_button}
              />
            </View>
            <View style={styles.button_row}>
              <PrimaryButton
                variant="destructive"
                title="Delete"
                icon="trash-outline"
                onPress={props.onDelete}
                style={styles.delete_button}
              />
              <PrimaryButton
                variant="secondary"
                title="Close"
                onPress={props.onClose}
                style={styles.close_button}
              />
            </View>
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default DocumentDetailModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
  },
  scroll_content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  title_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heading: {
    ...TYPE.heading,
    color: COLORS.text,
    flex: 1,
  },
  tag_row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tag: {
    borderRadius: RADIUS.pill,
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
  },
  expiring_tag: {
    backgroundColor: COLORS.warning,
  },
  expired_tag: {
    backgroundColor: COLORS.danger,
  },
  shared_tag: {
    backgroundColor: COLORS.action,
  },
  sample_tag: {
    backgroundColor: COLORS.secondary,
  },
  tag_text: {
    ...TYPE.caption,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.text_light,
  },
  preview: {
    borderRadius: RADIUS.md,
    width: '100%',
    height: 220,
    marginBottom: SPACING.sm,
  },
  label: {
    ...TYPE.label,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  value: {
    ...TYPE.body,
    color: COLORS.text,
  },
  button_row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  open_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  edit_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  delete_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  close_button: {
    flex: 1,
    marginHorizontal: 0,
  },
  // the expiring-soon tag is orange, so its words are dark
  tag_text_dark: {
    color: COLORS.on_light,
  },
});
