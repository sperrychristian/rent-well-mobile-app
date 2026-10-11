// demo only message threads, same shape as the server's so the screens can't tell the difference
// the tenants match the sample work orders, and the times are set from now so they always look recent

export const demo_user_id = 'demo-owner';

function minutesAgo(now, minutes) {
  return new Date(now.getTime() - minutes * 60000).toISOString();
}

function makeMessage(conversation_id, number, sender_id, body, created_at) {
  return {
    id: conversation_id + '-m' + number,
    conversationId: conversation_id,
    senderId: sender_id,
    body: body,
    attachmentKey: null,
    createdAt: created_at,
  };
}

// each thread is listed oldest to newest here because it reads naturally, it gets flipped to newest first below
const threads = [
  {
    id: 'demo-convo-sam',
    other: { id: 'demo-tenant-sam', name: 'Sam Rivera', role: 'tenant' },
    lines: [
      [false, 'Hi! The kitchen faucet is dripping again.', 300],
      [true, 'Thanks for letting me know. Is it the hot or cold side?', 290],
      [false, 'Hot side. It drips about once a second.', 285],
      [true, 'I can have a plumber out Thursday morning. Does that work?', 120],
      [false, 'Thursday works. I leave for work at 8:30.', 30],
      [false, 'Also the bathroom fan is making a rattling sound.', 28],
    ],
    // Sam hasn't read the plumber reply yet
    other_read_minutes: 200,
    my_read_minutes: 290,
  },
  {
    id: 'demo-convo-jordan',
    other: { id: 'demo-tenant-jordan', name: 'Jordan Lee', role: 'tenant' },
    lines: [
      [true, 'Reminder: the lease renewal paperwork is ready to sign.', 2880],
      [false, 'Got it, I will look it over this weekend.', 2860],
      [true, 'Sounds good. Let me know if you have questions.', 2850],
    ],
    other_read_minutes: 2840,
    my_read_minutes: 2850,
  },
  {
    id: 'demo-convo-alex',
    other: { id: 'demo-tenant-alex', name: 'Alex Chen', role: 'tenant' },
    lines: [
      [false, 'The porch light is out, I tried a new bulb and it still does not work.', 1500],
      [true, 'Thanks, it might be the switch. I will check it Saturday.', 1450],
    ],
    other_read_minutes: 1440,
    my_read_minutes: 1450,
  },
];

// a fresh copy every time the demo starts, so replies from the last demo never carry over
export function buildSampleThreads(now) {
  const current = now || new Date();
  const conversations = [];
  const messages_by_id = {};

  threads.forEach((thread) => {
    const messages = thread.lines
      .map((line, index) =>
        makeMessage(
          thread.id,
          index + 1,
          line[0] ? demo_user_id : thread.other.id,
          line[1],
          minutesAgo(current, line[2]),
        ),
      )
      .reverse();
    const last_read = minutesAgo(current, thread.my_read_minutes);
    const unread = messages.filter(
      (message) => message.senderId !== demo_user_id && message.createdAt > last_read,
    ).length;
    messages_by_id[thread.id] = messages;
    conversations.push({
      id: thread.id,
      otherUser: thread.other,
      lastMessage: messages[0],
      unreadCount: unread,
      lastReadAt: last_read,
      otherUserLastReadAt: minutesAgo(current, thread.other_read_minutes),
      createdAt: minutesAgo(current, thread.lines[0][2] + 1),
    });
  });

  return { conversations: conversations, messages_by_id: messages_by_id };
}

// the fake tenant picks one of these so the demo shows a reply arriving
export const demo_replies = [
  'Thanks, that works for me!',
  'Sounds good, see you then.',
  'Got it, thank you for the quick reply.',
  'Perfect, I will keep an eye out.',
  'Thanks! I will let you know if anything changes.',
];
