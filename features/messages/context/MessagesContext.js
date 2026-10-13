import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  getConversations,
  getMessages,
  sendMessage as sendMessageRequest,
  markConversationRead,
  uploadImage,
  getAttachmentUrl,
} from '../../../services/api';
import {
  connectSocket,
  disconnectSocket,
  joinConversation,
  leaveConversation,
} from '../../../services/socket';
import { registerForPush, listenForNotificationTaps } from '../../../services/push';
import { navigation_ref } from '../../../services/navigationRef';
import { useAuth } from '../../auth/context/AuthContext';
import { useWorkOrders } from '../../../context/WorkOrdersContext';
import {
  applyNewMessage,
  applyRead,
  sortConversations,
  totalUnread,
} from '../utils/messageHelpers';
import { buildSampleThreads, demo_user_id, demo_replies } from '../data/sampleThreads';

const MessagesContext = createContext(null);
const page_size = 30;

// picks the mode and gives the store a new key when it changes, so logging out or starting the demo starts it clean
// demo is fully local and never touches the network, real uses the backend, off is signed out
export function MessagesProvider(props) {
  const { user } = useAuth();
  const { demo_mode } = useWorkOrders();
  const mode = demo_mode ? 'demo' : user ? 'real' : 'off';
  const my_user_id = mode === 'demo' ? demo_user_id : user ? user.id : null;
  return (
    <MessagesStore key={mode + ':' + my_user_id} mode={mode} my_user_id={my_user_id}>
      {props.children}
    </MessagesStore>
  );
}

// opens the thread from a push tap, the navigator might still be starting on a cold launch so I wait a little
function openThreadWhenReady(conversation_id, tries_left) {
  if (navigation_ref.isReady()) {
    navigation_ref.navigate('MessageThread', { conversationId: conversation_id });
  } else if (tries_left > 0) {
    setTimeout(() => openThreadWhenReady(conversation_id, tries_left - 1), 300);
  }
}

function MessagesStore(props) {
  const mode = props.mode;
  const my_user_id = props.my_user_id;
  const is_demo = mode === 'demo';

  // the demo starts on fresh sample threads, real mode starts empty and loads from the server
  const [demo_start] = useState(() => (is_demo ? buildSampleThreads() : null));
  const [conversations, setConversations] = useState(() =>
    demo_start ? demo_start.conversations : [],
  );
  // loading, ready, or error, the list screen shows a retry button for error
  const [status, setStatus] = useState(mode === 'real' ? 'loading' : 'ready');
  const [error_message, setErrorMessage] = useState('');

  // demo messages live here, newest first per thread, same as the server pages them
  const demo_messages = useRef(demo_start ? demo_start.messages_by_id : {});
  const demo_timers = useRef([]);
  // the thread on screen right now, its new messages don't count as unread
  const open_conversation = useRef(null);
  // the thread screens listen here for new messages, read receipts, and reconnects
  const listeners = useRef(new Set());
  const conversations_ref = useRef(conversations);
  // download urls run out after 5 minutes, so I keep them until just before that
  const attachment_urls = useRef(new Map());

  useEffect(() => {
    conversations_ref.current = conversations;
  }, [conversations]);

  function emit(event) {
    listeners.current.forEach((listener) => listener(event));
  }

  function subscribe(listener) {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }

  // quiet is for background refreshes, they shouldn't swap a list that's on screen for a spinner
  async function loadConversations(quiet) {
    if (mode !== 'real') {
      return;
    }
    if (!quiet) {
      setStatus('loading');
    }
    try {
      const list = await getConversations();
      setConversations(sortConversations(list));
      setStatus('ready');
      setErrorMessage('');
    } catch (error) {
      console.log('Could not load conversations', error.message);
      // a quiet refresh that fails keeps whatever was already on screen
      if (!quiet || conversations_ref.current.length === 0) {
        setErrorMessage(error.message);
        setStatus('error');
      }
    }
  }

  function handleNewMessage(message) {
    const known = conversations_ref.current.some(
      (conversation) => conversation.id === message.conversationId,
    );
    setConversations(
      (current) =>
        applyNewMessage(current, message, my_user_id, open_conversation.current).conversations,
    );
    // a thread I haven't seen yet (like a new tenant who just signed up) means the list needs a reload
    if (!known) {
      loadConversations(true);
    }
    emit({ type: 'message:new', message: message });
  }

  function handleRead(read_event) {
    setConversations((current) => applyRead(current, read_event, my_user_id));
    emit({ type: 'message:read', read: read_event });
  }

  // the socket callbacks read the newest handlers from here, since this store's effect only runs once
  const handlers = useRef({});
  useEffect(() => {
    handlers.current = { handleNewMessage, handleRead, loadConversations };
  });

  // real mode: load the inbox, open the socket, ask for push, and listen for push taps
  // mode never changes inside one store (a new mode gets a new store), so this runs once
  useEffect(() => {
    if (mode !== 'real') {
      return undefined;
    }
    let active = true;
    getConversations()
      .then((list) => {
        if (active) {
          setConversations(sortConversations(list));
          setStatus('ready');
        }
      })
      .catch((error) => {
        console.log('Could not load conversations', error.message);
        if (active) {
          setErrorMessage(error.message);
          setStatus('error');
        }
      });

    connectSocket({
      onMessageNew: (message) => active && handlers.current.handleNewMessage(message),
      onMessageRead: (read_event) => active && handlers.current.handleRead(read_event),
      // after a reconnect anything missed while offline gets picked up
      onConnect: () => {
        if (active) {
          handlers.current.loadConversations(true);
          emit({ type: 'resync' });
        }
      },
    });
    registerForPush();
    const stop_taps = listenForNotificationTaps((conversation_id) =>
      openThreadWhenReady(conversation_id, 10),
    );

    return () => {
      active = false;
      stop_taps();
      disconnectSocket();
    };
  }, [mode]);

  // the demo's fake replies get cancelled when the demo ends
  useEffect(() => {
    const timers = demo_timers.current;
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  // ----- what the screens call, each one works in both modes -----

  async function fetchMessages(conversation_id, cursor) {
    if (is_demo) {
      const all = demo_messages.current[conversation_id] || [];
      const start = cursor ? all.findIndex((message) => message.id === cursor) + 1 : 0;
      const page = all.slice(start, start + page_size);
      const has_more = start + page_size < all.length;
      return { messages: page, next_cursor: has_more ? page[page.length - 1].id : null };
    }
    return getMessages(conversation_id, cursor);
  }

  // in the demo the tenant reads the message and answers a moment later
  function scheduleDemoReply(conversation_id) {
    const conversation = conversations_ref.current.find((item) => item.id === conversation_id);
    if (!conversation) {
      return;
    }
    const read_timer = setTimeout(() => {
      handleRead({
        conversationId: conversation_id,
        userId: conversation.otherUser.id,
        readAt: new Date().toISOString(),
      });
    }, 1200);
    const reply_timer = setTimeout(() => {
      const reply = {
        id: 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        conversationId: conversation_id,
        senderId: conversation.otherUser.id,
        body: demo_replies[Math.floor(Math.random() * demo_replies.length)],
        attachmentKey: null,
        createdAt: new Date().toISOString(),
      };
      demo_messages.current[conversation_id] = [
        reply,
        ...(demo_messages.current[conversation_id] || []),
      ];
      handleNewMessage(reply);
    }, 2500);
    demo_timers.current.push(read_timer, reply_timer);
  }

  // photo is { uri, mime_type } or null, the body is already checked and trimmed by the screen
  async function sendMessage(conversation_id, body, photo) {
    if (is_demo) {
      // the demo shows the photo straight from the phone, nothing gets uploaded
      const message = {
        id: 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        conversationId: conversation_id,
        senderId: demo_user_id,
        body: body,
        attachmentKey: photo ? photo.uri : null,
        createdAt: new Date().toISOString(),
      };
      demo_messages.current[conversation_id] = [
        message,
        ...(demo_messages.current[conversation_id] || []),
      ];
      handleNewMessage(message);
      scheduleDemoReply(conversation_id);
      return message;
    }
    // the photo goes up first, the message only sends once the upload worked
    const attachment_key = photo ? await uploadImage(photo.uri, photo.mime_type) : null;
    const message = await sendMessageRequest(conversation_id, body, attachment_key);
    // the socket brings this same message too, the merge drops the repeat
    handleNewMessage(message);
    return message;
  }

  // clears my unread right away, then tells the server (which tells my other phones)
  function markRead(conversation_id) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversation_id && conversation.unreadCount !== 0
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );
    if (is_demo) {
      return;
    }
    markConversationRead(conversation_id).catch((error) => {
      console.log('Could not mark the conversation read', error.message);
    });
  }

  async function attachmentUrl(key) {
    if (is_demo) {
      return key;
    }
    const cached = attachment_urls.current.get(key);
    if (cached && Date.parse(cached.expires_at) - Date.now() > 30000) {
      return cached.url;
    }
    const fresh = await getAttachmentUrl(key);
    attachment_urls.current.set(key, fresh);
    return fresh.url;
  }

  function forgetAttachmentUrl(key) {
    attachment_urls.current.delete(key);
  }

  // joining tells the server I'm looking at the thread, so it skips pushes for it
  function openThread(conversation_id) {
    open_conversation.current = conversation_id;
    if (mode === 'real') {
      joinConversation(conversation_id);
    }
  }

  function closeThread(conversation_id) {
    if (open_conversation.current === conversation_id) {
      open_conversation.current = null;
    }
    if (mode === 'real') {
      leaveConversation(conversation_id);
    }
  }

  function getConversation(conversation_id) {
    return conversations.find((conversation) => conversation.id === conversation_id);
  }

  const value = {
    mode,
    is_demo,
    my_user_id,
    conversations,
    status,
    error_message,
    unread_total: totalUnread(conversations),
    reloadConversations: () => loadConversations(false),
    getConversation,
    fetchMessages,
    sendMessage,
    markRead,
    attachmentUrl,
    forgetAttachmentUrl,
    openThread,
    closeThread,
    subscribe,
  };

  return <MessagesContext.Provider value={value}>{props.children}</MessagesContext.Provider>;
}

// screens call this for the inbox, unread count, and message actions
export function useMessages() {
  return useContext(MessagesContext);
}
