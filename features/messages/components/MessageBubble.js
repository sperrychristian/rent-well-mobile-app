import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AttachmentImage from './AttachmentImage';
import { formatMessageTime, photo_only_body } from '../utils/messageHelpers';
import { COLORS, SPACING, FONTS } from '../../../theme';

// one message, mine on the right in blue and theirs on the left
// props: message, is_mine, show_seen, onOpenImage
function MessageBubble(props) {
  const message = props.message;
  // a photo sent on its own carries the placeholder body, no need to show it under the picture
  const hide_body = message.attachmentKey && message.body === photo_only_body;
  return (
    <View style={[styles.row, props.is_mine ? styles.row_mine : styles.row_theirs]}>
      <View style={[styles.bubble, props.is_mine ? styles.bubble_mine : styles.bubble_theirs]}>
        {message.attachmentKey ? (
          <AttachmentImage attachment_key={message.attachmentKey} onPress={props.onOpenImage} />
        ) : null}
        {hide_body ? null : (
          <Text style={[styles.body, props.is_mine && styles.body_mine]}>{message.body}</Text>
        )}
      </View>
      <Text style={styles.meta}>
        {formatMessageTime(message.createdAt)}
        {props.show_seen ? '  ·  Seen' : ''}
      </Text>
    </View>
  );
}

export default memo(MessageBubble);

const styles = StyleSheet.create({
  row: {
    marginVertical: 3,
    maxWidth: '80%',
  },
  row_mine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  row_theirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 12,
  },
  bubble_mine: {
    backgroundColor: COLORS.action,
    borderBottomRightRadius: 4,
  },
  bubble_theirs: {
    backgroundColor: COLORS.surface_light,
    borderBottomLeftRadius: 4,
  },
  body: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  body_mine: {
    color: COLORS.text_light,
  },
  meta: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
    marginHorizontal: 4,
  },
});
