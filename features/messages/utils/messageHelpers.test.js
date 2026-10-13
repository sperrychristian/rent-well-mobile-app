import {
  mergeMessages,
  sortConversations,
  applyNewMessage,
  applyRead,
  totalUnread,
  lastSeenMessageId,
  formatMessageTime,
  messageBodyToSend,
  findConversationFor,
} from './messageHelpers';

function message(id, created_at, sender_id, conversation_id) {
  return {
    id: id,
    conversationId: conversation_id || 'c1',
    senderId: sender_id || 'other',
    body: 'Message ' + id,
    attachmentKey: null,
    createdAt: created_at,
  };
}

describe('mergeMessages', () => {
  test('keeps newest first and drops repeats by id', () => {
    const existing = [
      message('b', '2026-10-11T10:00:01.000Z'),
      message('a', '2026-10-11T10:00:00.000Z'),
    ];
    const incoming = [
      message('c', '2026-10-11T10:00:02.000Z'),
      message('b', '2026-10-11T10:00:01.000Z'),
    ];
    expect(mergeMessages(existing, incoming).map((item) => item.id)).toEqual(['c', 'b', 'a']);
  });

  test('older pages land at the end', () => {
    const existing = [message('d', '2026-10-11T10:00:03.000Z')];
    const older = [
      message('b', '2026-10-11T10:00:01.000Z'),
      message('a', '2026-10-11T10:00:00.000Z'),
    ];
    expect(mergeMessages(existing, older).map((item) => item.id)).toEqual(['d', 'b', 'a']);
  });

  test('the incoming copy wins, and the same time is ordered by id', () => {
    const old_copy = { ...message('x', '2026-10-11T10:00:00.000Z'), body: 'old' };
    const new_copy = { ...message('x', '2026-10-11T10:00:00.000Z'), body: 'new' };
    const merged = mergeMessages([old_copy], [new_copy, message('y', '2026-10-11T10:00:00.000Z')]);
    expect(merged.map((item) => item.id)).toEqual(['y', 'x']);
    expect(merged[1].body).toBe('new');
  });

  test('does not change the lists passed in', () => {
    const existing = [message('a', '2026-10-11T10:00:00.000Z')];
    mergeMessages(existing, [message('b', '2026-10-11T10:00:01.000Z')]);
    expect(existing).toHaveLength(1);
  });
});

describe('conversation list updates', () => {
  const conversations = [
    {
      id: 'c1',
      otherUser: { id: 'other', name: 'Tara', role: 'tenant' },
      lastMessage: message('m1', '2026-10-11T10:00:00.000Z'),
      unreadCount: 0,
      lastReadAt: null,
      otherUserLastReadAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'c2',
      otherUser: { id: 'other2', name: 'Theo', role: 'tenant' },
      lastMessage: message('m2', '2026-10-11T11:00:00.000Z', 'other2', 'c2'),
      unreadCount: 2,
      lastReadAt: null,
      otherUserLastReadAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  test('sortConversations puts the newest activity first, empty threads use createdAt', () => {
    const empty = {
      ...conversations[0],
      id: 'c3',
      lastMessage: null,
      createdAt: '2026-10-12T00:00:00.000Z',
    };
    expect(sortConversations([...conversations, empty]).map((item) => item.id)).toEqual([
      'c3',
      'c2',
      'c1',
    ]);
  });

  test('a new message from the other person counts as unread and moves the thread up', () => {
    const result = applyNewMessage(
      conversations,
      message('m3', '2026-10-11T12:00:00.000Z'),
      'me',
      null,
    );
    expect(result.found).toBe(true);
    expect(result.conversations[0].id).toBe('c1');
    expect(result.conversations[0].unreadCount).toBe(1);
    expect(result.conversations[0].lastMessage.id).toBe('m3');
  });

  test('my own message never counts and moves my read time up', () => {
    const mine = message('m3', '2026-10-11T12:00:00.000Z', 'me');
    const result = applyNewMessage(conversations, mine, 'me', null);
    expect(result.conversations[0].unreadCount).toBe(0);
    expect(result.conversations[0].lastReadAt).toBe(mine.createdAt);
  });

  test('a message in the open thread does not count', () => {
    const result = applyNewMessage(
      conversations,
      message('m3', '2026-10-11T12:00:00.000Z'),
      'me',
      'c1',
    );
    expect(result.conversations[0].unreadCount).toBe(0);
  });

  test('the same message twice only counts once', () => {
    const incoming = message('m3', '2026-10-11T12:00:00.000Z');
    const once = applyNewMessage(conversations, incoming, 'me', null).conversations;
    const twice = applyNewMessage(once, incoming, 'me', null).conversations;
    expect(twice.find((item) => item.id === 'c1').unreadCount).toBe(1);
  });

  test('an unknown thread is reported as not found', () => {
    const result = applyNewMessage(
      conversations,
      message('m9', '2026-10-11T12:00:00.000Z', 'new', 'c9'),
      'me',
      null,
    );
    expect(result.found).toBe(false);
  });

  test('applyRead from me clears unread, from them moves their read time', () => {
    const mine = applyRead(
      conversations,
      { conversationId: 'c2', userId: 'me', readAt: 'T1' },
      'me',
    );
    expect(mine[1].unreadCount).toBe(0);
    expect(mine[1].lastReadAt).toBe('T1');
    const theirs = applyRead(
      conversations,
      { conversationId: 'c1', userId: 'other', readAt: 'T2' },
      'me',
    );
    expect(theirs[0].otherUserLastReadAt).toBe('T2');
    expect(theirs[0].unreadCount).toBe(0);
  });

  test('totalUnread adds every thread', () => {
    expect(totalUnread(conversations)).toBe(2);
    expect(totalUnread([])).toBe(0);
  });
});

describe('lastSeenMessageId', () => {
  const messages = [
    message('m4', '2026-10-11T10:04:00.000Z', 'me'),
    message('m3', '2026-10-11T10:03:00.000Z', 'other'),
    message('m2', '2026-10-11T10:02:00.000Z', 'me'),
    message('m1', '2026-10-11T10:01:00.000Z', 'me'),
  ];

  test('marks only my newest message at or before their read time', () => {
    expect(lastSeenMessageId(messages, 'me', '2026-10-11T10:03:30.000Z')).toBe('m2');
    expect(lastSeenMessageId(messages, 'me', '2026-10-11T10:04:00.000Z')).toBe('m4');
    expect(lastSeenMessageId(messages, 'me', '2026-10-11T10:00:00.000Z')).toBeNull();
    expect(lastSeenMessageId(messages, 'me', null)).toBeNull();
  });
});

describe('formatMessageTime', () => {
  test('today shows the time and other days show the date', () => {
    const now = new Date(2026, 9, 11, 18, 0);
    expect(formatMessageTime(new Date(2026, 9, 11, 15, 7).toISOString(), now)).toBe('3:07 PM');
    expect(formatMessageTime(new Date(2026, 9, 11, 0, 5).toISOString(), now)).toBe('12:05 AM');
    expect(formatMessageTime(new Date(2026, 9, 11, 12, 0).toISOString(), now)).toBe('12:00 PM');
    expect(formatMessageTime(new Date(2026, 9, 9, 9, 0).toISOString(), now)).toBe('2026-10-09');
    expect(formatMessageTime(null, now)).toBe('');
  });
});

describe('messageBodyToSend', () => {
  test('trims text and gives a photo on its own a body', () => {
    expect(messageBodyToSend('  hi  ', false)).toBe('hi');
    expect(messageBodyToSend('   ', true)).toBe('Photo');
    expect(messageBodyToSend('look', true)).toBe('look');
    expect(messageBodyToSend('', false)).toBe('');
  });
});

describe('findConversationFor', () => {
  const conversations = [
    { id: 'c1', otherUser: { id: 'u1', name: 'Tara Tenant' } },
    { id: 'c2', otherUser: { id: 'u2', name: 'Sam Rivera' } },
  ];

  test('matches the account id first, then the name without minding case or spaces', () => {
    expect(findConversationFor(conversations, 'Someone Else', 'u1').id).toBe('c1');
    expect(findConversationFor(conversations, ' sam rivera ', null).id).toBe('c2');
    expect(findConversationFor(conversations, 'Sam Rivera', 'unknown').id).toBe('c2');
  });

  test('nothing for an empty name or someone without a thread', () => {
    expect(findConversationFor(conversations, '', null)).toBeNull();
    expect(findConversationFor(conversations, 'Priya Shah', null)).toBeNull();
    expect(findConversationFor([], 'Tara Tenant', 'u1')).toBeNull();
  });
});
