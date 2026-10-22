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

// work order pushes are workorder:new (to the owner) and workorder:updated (to the tenant)
function workOrderFromResponse(response) {
  const data =
    response && response.notification ? response.notification.request.content.data : null;
  const is_work_order =
    data && (data.type === 'workorder:new' || data.type === 'workorder:updated');
  return is_work_order && data.workOrderId ? data.workOrderId : null;
}

// calls onOpen with the id for taps while running, and once for a tap that launched the app
// idFromResponse picks which kind of push this listener cares about
function listenForTaps(idFromResponse, onOpen) {
  let subscription = null;
  try {
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = idFromResponse(response);
      if (id) {
        onOpen(id);
      }
    });
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const id = idFromResponse(response);
        if (id) {
          onOpen(id);
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

// calls onOpen with the conversation id for taps while running, and once for a tap that launched the app
export function listenForNotificationTaps(onOpen) {
  return listenForTaps(conversationFromResponse, onOpen);
}

// tenancy pushes go to the tenant when the owner assigns, moves, or ends a tenancy, onOpen gets the tenancy id
function tenancyFromResponse(response) {
  const data =
    response && response.notification ? response.notification.request.content.data : null;
  return data && data.type === 'tenancy:updated' && data.tenancyId ? data.tenancyId : null;
}

export function listenForTenancyTaps(onOpen) {
  return listenForTaps(tenancyFromResponse, onOpen);
}

// same thing for work order pushes, onOpen gets the work order id
export function listenForWorkOrderTaps(onOpen) {
  return listenForTaps(workOrderFromResponse, onOpen);
}

// rent ledger pushes: payment:claimed (to the owner), payment:confirmed and payment:rejected (to the tenant),
// and ledger:updated, onOpen gets { payment_id } or { tenancy_id } so the provider can pick the screen
// the real-backend pass: the server's pushes are payment:claimed, payment:confirmed, payment:rejected,
// payment:refunded (and later payment:succeeded, failed, returned), all with paymentId and tenancyId,
// ledger:reminder (to the tenant, with tenancyId), and ledger:overdue_digest (to the owner, no ids)
// onOpen gets { payment_id }, { tenancy_id }, or { digest: true }
function ledgerFromResponse(response) {
  const data =
    response && response.notification ? response.notification.request.content.data : null;
  if (!data || typeof data.type !== 'string') {
    return null;
  }
  if (data.type.indexOf('payment:') === 0 && data.paymentId) {
    return { payment_id: data.paymentId, tenancy_id: data.tenancyId || null };
  }
  if (data.type === 'ledger:reminder' && data.tenancyId) {
    return { tenancy_id: data.tenancyId };
  }
  if (data.type === 'ledger:overdue_digest') {
    return { digest: true };
  }
  return null;
}

export function listenForLedgerTaps(onOpen) {
  return listenForTaps(ledgerFromResponse, onOpen);
}

// lease pushes (lease:reminder) carry the tenancy, onOpen gets the tenancy id
// owners open that tenancy's lease, tenants go home where their lease line is
function leaseFromResponse(response) {
  const data =
    response && response.notification ? response.notification.request.content.data : null;
  return data && data.type === 'lease:reminder' && data.tenancyId ? data.tenancyId : null;
}

export function listenForLeaseTaps(onOpen) {
  return listenForTaps(leaseFromResponse, onOpen);
}
