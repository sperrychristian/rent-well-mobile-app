import { Alert } from 'react-native';
import { findConversationFor } from './messageHelpers';

// opens the thread with a tenant by its id, so the work order and tenant screens never pass a name along
// when there's no thread yet it says so (the same note the Messages list used to show) and offers the list
export function openConversationFor(navigation, conversations, tenant_name, tenant_id) {
  const conversation = findConversationFor(conversations, tenant_name, tenant_id);
  if (conversation) {
    navigation.navigate('MessageThread', { conversationId: conversation.id });
    return;
  }
  Alert.alert(
    'No conversation yet',
    tenant_name
      ? 'No conversation with ' + tenant_name + ' yet. They need to sign up with an invite code.'
      : 'This work order has no tenant to message.',
    [
      { text: 'OK', style: 'cancel' },
      { text: 'Open Messages', onPress: () => navigation.navigate('Messages') },
    ],
  );
}
