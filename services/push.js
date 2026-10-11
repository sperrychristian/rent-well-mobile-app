import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerPushToken, unregisterPushToken } from './api';

// the token this phone registered, so logout can remove the same one
let registered_token = null;

// shows a banner even while the app is open, the server already skips pushes for the thread on screen
export function setupNotificationHandler() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.log('Notifications are not available here', error.message);
  }
}

// asks permission and sends this phone's Expo push token to the server
// push doesn't work everywhere (Expo Go, simulators, no EAS project id), so any failure just gets logged
export async function registerForPush() {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain !== false) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) {
      console.log('Push permission not granted');
      return;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const token_result = await Notifications.getExpoPushTokenAsync();
    await registerPushToken(token_result.data, Platform.OS === 'ios' ? 'ios' : 'android');
    registered_token = token_result.data;
  } catch (error) {
    console.log('Push notifications are not set up on this device', error.message);
  }
}

// called before the logout request so this phone stops getting pushes for the account
export async function unregisterForPush() {
  if (!registered_token) {
    return;
  }
  try {
    await unregisterPushToken(registered_token);
  } catch (error) {
    console.log('Could not remove the push token', error.message);
  }
  registered_token = null;
}

// tapping a message push should open its thread, this pulls the conversation id out of it
function conversationFromResponse(response) {
  const data =
    response && response.notification ? response.notification.request.content.data : null;
  return data && data.type === 'message:new' && data.conversationId ? data.conversationId : null;
}

// calls onOpen with the conversation id for taps while running, and once for a tap that launched the app
export function listenForNotificationTaps(onOpen) {
  let subscription = null;
  try {
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const conversation_id = conversationFromResponse(response);
      if (conversation_id) {
        onOpen(conversation_id);
      }
    });
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const conversation_id = conversationFromResponse(response);
        if (conversation_id) {
          onOpen(conversation_id);
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }
      })
      .catch((error) => console.log('Could not read the last notification', error.message));
  } catch (error) {
    console.log('Notification taps are not available here', error.message);
  }
  return () => {
    if (subscription) {
      subscription.remove();
    }
  };
}
