import { io } from 'socket.io-client';
import { api_base_url } from './config';
import { api_client } from './api';

// one socket for the whole app, the messages context opens it after login and closes it on logout
let socket = null;
// set while a thread is open, so it can be joined again after a reconnect (socket.io doesn't keep rooms)
let joined_conversation_id = null;
// stops a bad token from refreshing over and over, it resets once a connect works
let refreshed_for_connect = false;
let stop_listening_for_tokens = null;

// handlers: onMessageNew, onMessageRead, onConnect (also fires after every reconnect)
export function connectSocket(handlers) {
  disconnectSocket();
  socket = io(api_base_url, {
    auth: { token: api_client.getAccessToken() },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    refreshed_for_connect = false;
    if (joined_conversation_id) {
      socket.emit('conversation:join', { conversationId: joined_conversation_id });
    }
    handlers.onConnect();
  });

  // the server turns away an expired token with UNAUTHORIZED, so I refresh once and connect again
  // other errors (like the server being down) retry on their own
  socket.on('connect_error', async (error) => {
    if (error.message !== 'UNAUTHORIZED' || refreshed_for_connect) {
      return;
    }
    refreshed_for_connect = true;
    const current_socket = socket;
    try {
      await api_client.refreshSession();
      if (current_socket === socket) {
        socket.auth = { token: api_client.getAccessToken() };
        socket.connect();
      }
    } catch (refresh_error) {
      console.log('Socket could not refresh its token', refresh_error.message);
    }
  });

  socket.on('message:new', (payload) => handlers.onMessageNew(payload.message));
  socket.on('message:read', (payload) => handlers.onMessageRead(payload));

  // after any refresh the next reconnect should use the newest token
  stop_listening_for_tokens = api_client.onSessionEvent((event_name, payload) => {
    if (event_name === 'session' && socket) {
      socket.auth = { token: payload.access_token };
    }
  });
}

export function disconnectSocket() {
  if (stop_listening_for_tokens) {
    stop_listening_for_tokens();
    stop_listening_for_tokens = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  joined_conversation_id = null;
}

// being joined tells the server I'm looking at the thread, so it skips push notifications for it
export function joinConversation(conversation_id) {
  joined_conversation_id = conversation_id;
  if (socket && socket.connected) {
    socket.emit('conversation:join', { conversationId: conversation_id }, (ack) => {
      if (ack && !ack.ok) {
        console.log('Could not join conversation', ack.error);
      }
    });
  }
}

export function leaveConversation(conversation_id) {
  if (joined_conversation_id === conversation_id) {
    joined_conversation_id = null;
  }
  if (socket && socket.connected) {
    socket.emit('conversation:leave', { conversationId: conversation_id });
  }
}
