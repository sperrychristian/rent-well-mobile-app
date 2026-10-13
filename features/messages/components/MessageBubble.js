import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AttachmentImage from './AttachmentImage';
import { formatMessageTime, photo_only_body } from '../utils/messageHelpers';
import { COLORS, SPACING, TYPE, RADIUS, BORDER } from '../../../theme';

// one message, mine on the right in blue and theirs on the left
// props: message, is_mine, show_seen, onOpenImage
// the design pass added day_label (a Today, Yesterday, or date divider above the first message of a day)
// and show_time (false hides the time on all but the newest of a quick run from one person)
function MessageBubble(props) {
  const message = props.message;
  // a photo sent on its own carries the placeholder body, no need to show it under the picture
  const hide_body = message.attachmentKey && message.body === photo_only_body;
  const show_meta = props.show_time !== false || props.show_seen;
  return (
    <View>
      {props.day_label ? (
        <View style={styles.divider} accessibilityRole="header">
          <View style={styles.divider_line} />
          <Text style={styles.divider_text}>{props.day_label}</Text>
          <View style={styles.divider_line} />
        </View>
      ) : null}
      <View style={[styles.row, props.is_mine ? styles.row_mine : styles.row_theirs]}>
        <View style={[styles.bubble, props.is_mine ? styles.bubble_mine : styles.bubble_theirs]}>
          {message.attachmentKey ? (
            <AttachmentImage attachment_key={message.attachmentKey} onPress={props.onOpenImage} />
          ) : null}
          {hide_body ? null : (
            <Text style={[styles.body, props.is_mine && styles.body_mine]}>{message.body}</Text>
          )}
        </View>
        {show_meta ? (
          <Text style={styles.meta}>
            {formatMessageTime(message.createdAt)}
            {props.show_seen ? '  ·  Seen' : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default memo(MessageBubble);

const styles = StyleSheet.create({
  row: {
    marginVertical: SPACING.xxs,
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
    borderRadius: RADIUS.xl - 2,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm + SPACING.xs,
  },
  bubble_mine: {
    backgroundColor: COLORS.action,
    borderBottomRightRadius: SPACING.xs,
  },
  bubble_theirs: {
    backgroundColor: COLORS.surface_raised,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    borderBottomLeftRadius: SPACING.xs,
  },
  body: {
    ...TYPE.body,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.text,
  },
  body_mine: {
    color: COLORS.text_light,
  },
  meta: {
    ...TYPE.caption,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.text_muted,
    marginTop: SPACING.xxs,
    marginHorizontal: SPACING.xs,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.md,
  },
  divider_line: {
    flex: 1,
    height: BORDER.hairline,
    backgroundColor: COLORS.border,
  },
  divider_text: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.text_muted,
  },
});
