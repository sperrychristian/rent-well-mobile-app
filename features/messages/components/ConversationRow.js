import { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UnreadBadge from './UnreadBadge';
import { formatMessageTime } from '../utils/messageHelpers';
import { COLORS, SPACING, FONTS, TYPE, BORDER, OPACITY, SIZES } from '../../../theme';
import Avatar from '../../../components/ui/Avatar';
import { themedStyles } from '../../../utils/themedStyles';

// one thread in the inbox: who, the last message, when, and how many are unread
// props: conversation, my_user_id, onPress
function ConversationRow(props) {
  const conversation = props.conversation;
  const last = conversation.lastMessage;
  const unread = conversation.unreadCount > 0;
  let preview = 'No messages yet';
  if (last) {
    preview = (last.senderId === props.my_user_id ? 'You: ' : '') + last.body;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, unread && styles.row_unread, pressed && styles.pressed]}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={
        'Conversation with ' +
        conversation.otherUser.name +
        (unread ? ', ' + conversation.unreadCount + ' unread' : '')
      }
    >
      {/* the shared avatar, first and last initials in a color picked from the name */}
      <Avatar name={conversation.otherUser.name} size={SIZES.touch} style={styles.avatar} />
      <View style={styles.text_column}>
        <View style={styles.top_line}>
          <Text style={[styles.name, unread && styles.bold]} numberOfLines={1}>
            {conversation.otherUser.name}
          </Text>
          <Text style={styles.time}>
            {formatMessageTime(last ? last.createdAt : conversation.createdAt)}
          </Text>
        </View>
        <View style={styles.bottom_line}>
          {last && last.attachmentKey ? (
            <Ionicons
              name="camera-outline"
              size={14}
              color={COLORS.text_muted}
              style={styles.camera}
            />
          ) : null}
          <Text style={[styles.preview, unread && styles.preview_unread]} numberOfLines={1}>
            {preview}
          </Text>
          <UnreadBadge count={conversation.unreadCount} />
        </View>
      </View>
    </Pressable>
  );
}

export default memo(ConversationRow);

const styles = themedStyles((COLORS) => ({
  // the Hearth pass: a ruled row on the paper, no box
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZES.row_min_height,
    paddingVertical: SPACING.md,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.hairline,
  },
  pressed: {
    opacity: OPACITY.pressed,
  },
  avatar: {
    marginRight: SPACING.sm + SPACING.xs,
  },
  text_column: {
    flex: 1,
  },
  top_line: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xxs,
  },
  name: {
    ...TYPE.subheading,
    flex: 1,
    color: COLORS.text,
  },
  bold: {
    fontFamily: FONTS.heading,
  },
  time: {
    ...TYPE.caption,
    color: COLORS.text_muted,
    marginLeft: SPACING.sm,
  },
  bottom_line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  camera: {
    opacity: OPACITY.subtle,
  },
  preview: {
    ...TYPE.body_small,
    flex: 1,
    color: COLORS.text_muted,
  },
  preview_unread: {
    fontFamily: FONTS.body_bold,
    color: COLORS.text,
  },
  // an unread thread gets an amber edge, the bold text and the badge say it too
  // (the Hearth pass dropped the edge, the bold text and the badge carry it)
  row_unread: {},
}));
