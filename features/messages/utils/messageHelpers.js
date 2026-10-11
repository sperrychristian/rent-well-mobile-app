// pure helpers for messages and the inbox, nothing here touches the network so they're easy to test
// messages are always kept newest first, the same order the server pages them in

function timeOf(iso) {
  return iso ? Date.parse(iso) : 0;
}

// newest first, and the id breaks ties so two messages from the same millisecond keep a steady order
function newestFirst(a, b) {
  return timeOf(b.createdAt) - timeOf(a.createdAt) || (b.id < a.id ? -1 : b.id > a.id ? 1 : 0);
}

// adds new or older messages to the list, the same id never shows twice (the socket and the send response both bring it)
export function mergeMessages(existing, incoming) {
  const by_id = new Map();
  existing.forEach((message) => by_id.set(message.id, message));
  incoming.forEach((message) => by_id.set(message.id, message));
  return [...by_id.values()].sort(newestFirst);
}

// the newest message in the thread, or the creation time for an empty one
function activityTime(conversation) {
  return conversation.lastMessage
    ? timeOf(conversation.lastMessage.createdAt)
    : timeOf(conversation.createdAt);
}

// most recent activity first, same as the server sends them
export function sortConversations(conversations) {
  return [...conversations].sort((a, b) => activityTime(b) - activityTime(a));
}

// a message:new from the socket, it moves that thread to the top and counts it as unread if it's from the other person
// open_conversation_id is the thread on screen, it's about to be marked read so it doesn't count
// found is false when the thread isn't in the list yet (like a brand new tenant), so the caller can reload the list
export function applyNewMessage(conversations, message, my_user_id, open_conversation_id) {
  let found = false;
  const updated = conversations.map((conversation) => {
    if (conversation.id !== message.conversationId) {
      return conversation;
    }
    found = true;
    const is_newer =
      !conversation.lastMessage ||
      timeOf(message.createdAt) >= timeOf(conversation.lastMessage.createdAt);
    const already_seen = conversation.lastMessage && conversation.lastMessage.id === message.id;
    const from_other = message.senderId !== my_user_id;
    const counts_as_unread =
      from_other && !already_seen && message.conversationId !== open_conversation_id;
    return {
      ...conversation,
      lastMessage: is_newer ? message : conversation.lastMessage,
      unreadCount: counts_as_unread ? conversation.unreadCount + 1 : conversation.unreadCount,
      // sending a message moves my own read time up to it
      lastReadAt: from_other ? conversation.lastReadAt : message.createdAt,
    };
  });
  return { conversations: sortConversations(updated), found: found };
}

// a message:read from the socket, if it's me (maybe on another phone) my unread goes to 0
// if it's the other person, their read time moves up for the seen marker
export function applyRead(conversations, read_event, my_user_id) {
  return conversations.map((conversation) => {
    if (conversation.id !== read_event.conversationId) {
      return conversation;
    }
    if (read_event.userId === my_user_id) {
      return { ...conversation, unreadCount: 0, lastReadAt: read_event.readAt };
    }
    return { ...conversation, otherUserLastReadAt: read_event.readAt };
  });
}

export function totalUnread(conversations) {
  return conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0);
}

// only my newest message the other person has read gets the Seen label, like most chat apps
export function lastSeenMessageId(messages, my_user_id, other_last_read_at) {
  if (!other_last_read_at) {
    return null;
  }
  const read_time = timeOf(other_last_read_at);
  const seen = messages.find(
    (message) => message.senderId === my_user_id && timeOf(message.createdAt) <= read_time,
  );
  return seen ? seen.id : null;
}

function twoDigits(number) {
  return String(number).padStart(2, '0');
}

// the local date as YYYY-MM-DD, same as the rest of the app
function localDate(date) {
  return (
    date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate())
  );
}

// today's messages show the time like 3:07 PM, older ones show the date
export function formatMessageTime(iso, now) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const today = now || new Date();
  if (localDate(date) !== localDate(today)) {
    return localDate(date);
  }
  const hours = date.getHours();
  const hour_text = hours % 12 === 0 ? 12 : hours % 12;
  return hour_text + ':' + twoDigits(date.getMinutes()) + (hours < 12 ? ' AM' : ' PM');
}

// an attachment still needs text since the server rejects an empty body, so a photo on its own gets this
export const photo_only_body = 'Photo';

export function messageBodyToSend(text, has_photo) {
  const trimmed = text.trim();
  if (trimmed === '' && has_photo) {
    return photo_only_body;
  }
  return trimmed;
}
