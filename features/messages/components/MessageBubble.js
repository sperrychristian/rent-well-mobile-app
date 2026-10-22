import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AttachmentImage from './AttachmentImage';
import { formatMessageTime, photo_only_body } from '../utils/messageHelpers';
import { isRentReminder } from '../../reminders/utils/reminderHelpers';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES } from '../../../theme';

// one message, mine on the right in blue and theirs on the left
// (the fintech pass: mine is the indigo brand color, theirs is a light gray)
// props: message, is_mine, show_seen, onOpenImage
// the design pass added day_label (a Today, Yesterday, or date divider above the first message of a day)
// and show_time (false hides the time on all but the newest of a quick run from one person)
// a rent reminder from the landlord gets a small "Payment reminder" label with a bell, tapping it opens
// Payments (onOpenPayments)
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
          {isRentReminder(message) ? (
            <Pressable
              onPress={props.onOpenPayments}
              hitSlop={{ top: SPACING.sm, bottom: SPACING.sm }}
              accessibilityRole="button"
              accessibilityLabel="Payment reminder, opens Payments"
              style={styles.reminder}
            >
              <Ionicons
                name="notifications-outline"
                size={SIZES.icon_small}
                color={props.is_mine ? COLORS.text_light : COLORS.cta}
              />
              <Text style={[styles.reminder_text, props.is_mine && styles.reminder_text_mine]}>
                Payment reminder
              </Text>
            </Pressable>
          ) : null}
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
  // the reminder label: a bell and the words, green on the tenant's white bubble, white on the landlord's green
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  reminder_text: {
    ...TYPE.label,
    color: COLORS.cta,
    textDecorationLine: 'underline',
  },
  reminder_text_mine: {
    color: COLORS.text_light,
  },
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
  // the Hearth pass: 18 corners, mine in forest green with white words, theirs white with a hairline edge
  bubble: {
    borderRadius: RADIUS.lg + SPACING.xxs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm + SPACING.xs,
  },
  bubble_mine: {
    backgroundColor: COLORS.cta,
    borderBottomRightRadius: SPACING.xs,
  },
  bubble_theirs: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.hairline,
    borderBottomLeftRadius: SPACING.xs,
  },
  body: {
    ...TYPE.body,
    fontSize: TYPE.body_compact.fontSize,
    lineHeight: TYPE.body_compact.lineHeight,
    color: COLORS.text,
  },
  body_mine: {
    color: COLORS.text_light,
  },
  meta: {
    ...TYPE.caption,
    fontSize: TYPE.micro.fontSize,
    lineHeight: TYPE.micro.lineHeight,
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
