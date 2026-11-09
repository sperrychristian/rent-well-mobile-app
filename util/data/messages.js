// conversations/{conversationId} and messages/{conversationId}/{pushId}
// one conversation per landlord and tenant, and its messages under push ids so they read oldest to newest
// these hand back the same camelCase shapes the old server sent, so MessagesContext and the screens read them as before
// REST has no live listener in React Native, so the thread screen asks again every 8 seconds while it's open
import { getNode, patchNode } from '../http';
import { parseApiError } from '../apiHelpers';
import { recordsToList, nowIso } from './records';
import { generatePushId } from './pushId';

function notFound() {
  return parseApiError(404, { error: { code: 'NOT_FOUND', message: 'NOT_FOUND' } });
}

function messageFromDb(conversation_id, id, record) {
  return {
    id: id,
    conversationId: conversation_id,
    senderId: record.senderId,
    body: record.body || '',
    attachmentKey: null,
    metadata: record.metadata || undefined,
    createdAt: record.createdAt,
  };
}

// the conversation from one person's side: the other person, my unread count, and both read times
export function conversationFor(record, user_id, users) {
  const i_am_owner = record.ownerId === user_id;
  const other_id = i_am_owner ? record.tenantUserId : record.ownerId;
  const other = users[other_id] || {};
  const read = record.lastReadAt || {};
  const unread = record.unreadCount || {};
  const last = record.lastMessage || null;
  return {
    id: record.id,
    otherUser: {
      id: other_id,
      name: other.name || (i_am_owner ? record.tenantName : record.ownerName) || '',
      role: i_am_owner ? 'tenant' : 'owner',
    },
    lastMessage: last
      ? {
          id: last.id || record.id + '-last',
          conversationId: record.id,
          senderId: last.senderId,
          body: last.body || '',
          attachmentKey: null,
          metadata: last.metadata || undefined,
          createdAt: last.createdAt,
        }
      : null,
    unreadCount: unread[user_id] || 0,
    lastReadAt: read[user_id] || null,
    otherUserLastReadAt: read[other_id] || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt || record.createdAt,
  };
}

// every conversation I'm in, newest activity first
export async function getConversations(user_id) {
  const [conversations, users] = await Promise.all([getNode('conversations'), getNode('users')]);
  return recordsToList(conversations)
    .filter((record) => record.ownerId === user_id || record.tenantUserId === user_id)
    .map((record) => conversationFor(record, user_id, users))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

// the whole thread, newest first like the old pages (a landlord's thread is a few hundred messages at most),
// so next_cursor is always null and the screen never asks for an older page
export async function getMessages(conversation_id) {
  const keyed = await getNode('messages/' + conversation_id);
  const list = Object.keys(keyed)
    .sort()
    .map((id) => messageFromDb(conversation_id, id, keyed[id]))
    .reverse();
  return { messages: list, next_cursor: null };
}

// one multi-path write: the message, the conversation's last message, and one more unread for the other person
// metadata is for rent reminders ({ type: 'rent_reminder', ... }), left out for a normal message
export async function sendMessage(conversation_id, sender_id, body, metadata) {
  const record = await getNode('conversations/' + conversation_id, null);
  if (!record) {
    throw notFound();
  }
  const other_id = record.ownerId === sender_id ? record.tenantUserId : record.ownerId;
  const unread = record.unreadCount || {};
  const id = generatePushId();
  const now = nowIso();
  const message = { senderId: sender_id, body: body, createdAt: now };
  if (metadata) {
    message.metadata = metadata;
  }
  await patchNode('', {
    ['messages/' + conversation_id + '/' + id]: message,
    ['conversations/' + conversation_id + '/lastMessage']: { id: id, ...message },
    ['conversations/' + conversation_id + '/updatedAt']: now,
    // reading what the count was and adding one isn't atomic, two sends at the same moment can count one
    ['conversations/' + conversation_id + '/unreadCount/' + other_id]: (unread[other_id] || 0) + 1,
    // sending also means I've read everything before it
    ['conversations/' + conversation_id + '/lastReadAt/' + sender_id]: now,
    ['conversations/' + conversation_id + '/unreadCount/' + sender_id]: 0,
  });
  return messageFromDb(conversation_id, id, message);
}

// my lastReadAt moves to now and my unread goes to 0, the other person sees "Seen" from the read time
export async function markConversationRead(conversation_id, user_id) {
  const now = nowIso();
  await patchNode('conversations/' + conversation_id, {
    ['lastReadAt/' + user_id]: now,
    ['unreadCount/' + user_id]: 0,
  });
  return now;
}

// the conversation between a landlord and a tenant, for the rent reminder (null when there isn't one)
export async function findConversation(owner_id, tenant_user_id) {
  const found = recordsToList(await getNode('conversations')).find(
    (record) => record.ownerId === owner_id && record.tenantUserId === tenant_user_id,
  );
  return found ? found.id : null;
}
