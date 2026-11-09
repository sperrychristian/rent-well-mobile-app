import {
  getConversations,
  getMessages,
  sendMessage,
  markConversationRead,
  findConversation,
} from './messages';
import { seededFirebase, uninstallFakeFirebase } from '../../scripts/testing/fakeFirebase';

afterEach(uninstallFakeFirebase);

test('each side sees the conversation from their own side', async () => {
  seededFirebase();
  const landlord = await getConversations('owner-taylor');
  expect(landlord.length).toBe(5);
  const sam_thread = landlord.find((item) => item.id === 'convo-sam');
  expect(sam_thread.otherUser).toMatchObject({
    id: 'tenant-sam',
    name: 'Sam Rivera',
    role: 'tenant',
  });
  expect(sam_thread.unreadCount).toBeGreaterThan(0);
  const sam = await getConversations('tenant-sam');
  expect(sam).toHaveLength(1);
  expect(sam[0].otherUser).toMatchObject({ id: 'owner-taylor', role: 'owner' });
  expect(await getConversations('owner-jamie')).toEqual([]);
});

test('messages come back newest first, and a send lands for the other side as unread', async () => {
  const firebase = seededFirebase();
  const before = await getMessages('convo-sam');
  expect(before.next_cursor).toBeNull();
  expect(before.messages[0].createdAt >= before.messages[1].createdAt).toBe(true);
  const sam_unread_before = (await getConversations('tenant-sam'))[0].unreadCount;
  const sent = await sendMessage('convo-sam', 'owner-taylor', 'Plumber is booked for Thursday.');
  const after = await getMessages('convo-sam');
  expect(after.messages[0]).toMatchObject({ id: sent.id, body: 'Plumber is booked for Thursday.' });
  const sam_side = (await getConversations('tenant-sam'))[0];
  expect(sam_side.unreadCount).toBe(sam_unread_before + 1);
  expect(sam_side.lastMessage.body).toBe('Plumber is booked for Thursday.');
  // the landlord sent it, so their own unread is cleared
  expect(firebase.database.dump().conversations['convo-sam'].unreadCount['owner-taylor']).toBe(0);
});

test('reading moves my lastReadAt and clears my unread, the other side sees it as Seen', async () => {
  seededFirebase();
  const read_at = await markConversationRead('convo-sam', 'tenant-sam');
  const landlord_side = (await getConversations('owner-taylor')).find(
    (item) => item.id === 'convo-sam',
  );
  expect(landlord_side.otherUserLastReadAt).toBe(read_at);
  expect((await getConversations('tenant-sam'))[0].unreadCount).toBe(0);
});

test('a reminder message keeps its metadata, and the conversation can be found by the pair', async () => {
  seededFirebase();
  expect(await findConversation('owner-taylor', 'tenant-sam')).toBe('convo-sam');
  await sendMessage('convo-sam', 'owner-taylor', 'Rent reminder', { type: 'rent_reminder' });
  const page = await getMessages('convo-sam');
  expect(page.messages[0].metadata).toEqual({ type: 'rent_reminder' });
  await expect(sendMessage('nope', 'owner-taylor', 'x')).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});
