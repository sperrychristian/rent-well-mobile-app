import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UnreadBadge from './UnreadBadge';
import { formatMessageTime } from '../utils/messageHelpers';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// one thread in the inbox: who, the last message, when, and how many are unread
// props: conversation, my_user_id, onPress
function ConversationRow(props) {
  const conversation = props.conversation;
  const last = conversation.lastMessage;
  const unread = conversation.unreadCount > 0;
  const initial = conversation.otherUser.name.trim().charAt(0).toUpperCase() || '?';
  let preview = 'No messages yet';
  if (last) {
    preview = (last.senderId === props.my_user_id ? 'You: ' : '') + last.body;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={
        'Conversation with ' +
        conversation.otherUser.name +
        (unread ? ', ' + conversation.unreadCount + ' unread' : '')
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatar_text}>{initial}</Text>
      </View>
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
            <Ionicons name="camera-outline" size={14} color={COLORS.text} style={styles.camera} />
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.muted,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatar_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  text_column: {
    flex: 1,
  },
  top_line: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.subheading,
    fontSize: FONT_SIZES.body,
  },
  bold: {
    fontFamily: FONTS.heading,
  },
  time: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    opacity: 0.7,
    marginLeft: SPACING.sm,
  },
  bottom_line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  camera: {
    opacity: 0.8,
  },
  preview: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  preview_unread: {
    fontFamily: FONTS.body_bold,
    opacity: 1,
  },
});
