import { Modal, View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// the pop-up forms share the sheet look from components/ui, the JSX still says Card
import Card from '../../../components/ui/ModalCard';
import PrimaryButton from '../../../components/PrimaryButton';
import { COLORS, SPACING, TYPE, RADIUS } from '../../../theme';
import { getDocumentUri } from '../utils/documentFiles';
import { isImage, iconFor, expiryTag, daysUntil, formatSize } from '../utils/documentHelpers';
import StatusLabel from '../../../components/ui/StatusLabel';
import { useReduceMotion } from '../../../components/ui/useReduceMotion';

// props: visible, document, in_demo, onOpen, onEdit, onDelete, onClose, and onDismiss (iOS calls it once the modal is fully gone)
function DocumentDetailModal(props) {
  // with Reduce Motion on the sheet just appears, no slide or fade
  const reduce_motion = useReduceMotion();
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
      animationType={reduce_motion ? 'none' : 'slide'}
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
              {/* the fintech pass: soft tinted pills, red when it's expired and amber when it's close */}
              {tag && (
                <StatusLabel
                  label={tag.text}
                  tone={tag.expired ? 'danger' : 'warning'}
                  icon={tag.expired ? 'alert-circle' : 'time'}
                />
              )}
              {document.shared_with_tenant && (
                <StatusLabel label="Shared with tenant" tone="info" icon="people-outline" />
              )}
              {document.sample && (
                <StatusLabel label="Sample" tone="neutral" icon="document-outline" />
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
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
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
});
