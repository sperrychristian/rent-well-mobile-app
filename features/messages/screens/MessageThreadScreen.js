import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import ErrorState from '../../../components/ErrorState';
import MessageBubble from '../components/MessageBubble';
import ImageViewerModal from '../components/ImageViewerModal';
import { useMessages } from '../context/MessagesContext';
import { useTenants } from '../../tenants/context/TenantsContext';
import {
  mergeMessages,
  lastSeenMessageId,
  messageBodyToSend,
  dayDividerLabel,
  showsTime,
} from '../utils/messageHelpers';
import { COLORS, SPACING, TYPE, RADIUS, BORDER, SIZES, OPACITY } from '../../../theme';

// the server takes photos up to 10 MB and message text up to 2000 characters
const max_photo_bytes = 10485760;
const max_body_length = 2000;

function MessageThreadScreen(props) {
  const insets = useSafeAreaInsets();
  // the header sits above this screen now, so the keyboard lift has to count its height too
  const header_height = useHeaderHeight();
  const conversation_id = props.route.params.conversationId;
  const {
    is_demo,
    my_user_id,
    getConversation,
    fetchMessages,
    sendMessage,
    markRead,
    openThread,
    closeThread,
    subscribe,
  } = useMessages();
  // it can be missing for a moment when a push tap opens the app straight into the thread
  const conversation = getConversation(conversation_id);

  const [messages, setMessages] = useState([]);
  const [next_cursor, setNextCursor] = useState(null);
  // loading, ready, or error for the first page
  const [status, setStatus] = useState('loading');
  const [error_message, setErrorMessage] = useState('');
  const [loading_older, setLoadingOlder] = useState(false);
  const [older_failed, setOlderFailed] = useState(false);
  const [draft, setDraft] = useState('');
  // { uri, mime_type, size } for the photo waiting to send
  const [photo, setPhoto] = useState(null);
  const [sending, setSending] = useState(false);
  const [viewer_url, setViewerUrl] = useState(null);

  // the screen's own copies of the context functions, the effects below only run on mount so they read these
  // this effect is listed first so it's always filled in before the others run
  const actions = useRef({ fetchMessages, markRead, openThread, closeThread, subscribe });
  useEffect(() => {
    actions.current = { fetchMessages, markRead, openThread, closeThread, subscribe };
  });

  // gets the newest page and merges it in, used when the thread opens and after a reconnect
  const loadNewest = useCallback(
    async (show_errors) => {
      try {
        const page = await actions.current.fetchMessages(conversation_id, null);
        setMessages((current) => mergeMessages(current, page.messages));
        // only the first load sets the cursor, a refresh shouldn't move where older pages pick up
        setNextCursor((current) => (current === null && show_errors ? page.next_cursor : current));
        setStatus('ready');
      } catch (error) {
        console.log('Could not load messages', error.message);
        if (show_errors) {
          setErrorMessage(error.message);
          setStatus('error');
        }
      }
    },
    [conversation_id],
  );

  // opening the thread joins its room (no pushes while I'm looking) and marks it read
  useEffect(() => {
    const current_actions = actions.current;
    current_actions.openThread(conversation_id);
    current_actions.markRead(conversation_id);
    loadNewest(true);

    const stop_listening = current_actions.subscribe((event) => {
      if (event.type === 'message:new' && event.message.conversationId === conversation_id) {
        setMessages((current) => mergeMessages(current, [event.message]));
        // a new message from them while I'm looking counts as read
        if (event.message.senderId !== my_user_id) {
          actions.current.markRead(conversation_id);
        }
      } else if (event.type === 'resync') {
        loadNewest(false);
        actions.current.markRead(conversation_id);
      }
    });

    // in the background I leave the room so pushes start again, coming back joins and catches up
    const app_state = AppState.addEventListener('change', (next_state) => {
      if (next_state === 'active') {
        actions.current.openThread(conversation_id);
        actions.current.markRead(conversation_id);
        loadNewest(false);
      } else if (next_state === 'background') {
        actions.current.closeThread(conversation_id);
      }
    });

    return () => {
      stop_listening();
      app_state.remove();
      actions.current.closeThread(conversation_id);
    };
  }, [conversation_id, loadNewest, my_user_id]);

  // the list is upside down, so its end is the top and reaching it loads older messages
  async function loadOlder() {
    if (!next_cursor || loading_older) {
      return;
    }
    setLoadingOlder(true);
    setOlderFailed(false);
    try {
      const page = await fetchMessages(conversation_id, next_cursor);
      setMessages((current) => mergeMessages(current, page.messages));
      setNextCursor(page.next_cursor);
    } catch (error) {
      console.log('Could not load older messages', error.message);
      setOlderFailed(true);
    }
    setLoadingOlder(false);
  }

  function keepPhoto(asset) {
    if (asset.fileSize && asset.fileSize > max_photo_bytes) {
      Alert.alert('Photo too large', 'Pick a photo under 10 MB.');
      return;
    }
    setPhoto({ uri: asset.uri, mime_type: asset.mimeType || 'image/jpeg' });
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      keepPhoto(result.assets[0]);
    }
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      keepPhoto(result.assets[0]);
    }
  }

  function pickPhoto() {
    Alert.alert('Add a photo', null, [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Photo Library', onPress: choosePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSend() {
    const body = messageBodyToSend(draft, !!photo);
    if (body === '' || sending) {
      return;
    }
    setSending(true);
    try {
      const sent = await sendMessage(conversation_id, body, photo);
      setMessages((current) => mergeMessages(current, [sent]));
      setDraft('');
      setPhoto(null);
    } catch (error) {
      console.log('Could not send message', error.message);
      // the text and photo stay put so nothing has to be typed again
      Alert.alert('Message not sent', error.message);
    }
    setSending(false);
  }

  const seen_id = lastSeenMessageId(
    messages,
    my_user_id,
    conversation ? conversation.otherUserLastReadAt : null,
  );
  const can_send = (draft.trim() !== '' || !!photo) && !sending;
  // a tenant whose rental ended can still read the thread, but not write (owners can always write)
  const { is_read_only } = useTenants();

  let list;
  if (status === 'error' && messages.length === 0) {
    list = (
      <View style={styles.center}>
        <ErrorState message={error_message} onRetry={() => loadNewest(true)} />
      </View>
    );
  } else if (status === 'loading' && messages.length === 0) {
    list = (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.title} size="large" />
      </View>
    );
  } else {
    list = (
      <FlatList
        inverted
        style={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.list_content}
        // inverted, so the footer sits at the top above the oldest message
        ListFooterComponent={
          loading_older ? (
            <ActivityIndicator style={styles.older} color={COLORS.title} />
          ) : older_failed ? (
            <Pressable onPress={loadOlder} style={styles.older} accessibilityRole="button">
              <Text style={styles.older_text}>
                {"Couldn't load older messages. Tap to try again."}
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          // the list is flipped, so the empty text gets flipped back
          <Text style={[styles.empty_text, styles.flip]}>No messages yet. Say hello!</Text>
        }
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            is_mine={item.senderId === my_user_id}
            show_seen={item.id === seen_id}
            onOpenImage={setViewerUrl}
            day_label={dayDividerLabel(messages, index)}
            show_time={showsTime(messages, index)}
          />
        )}
      />
    );
  }

  return (
    // iOS needs padding to lift the composer, Android already resizes the window
    <KeyboardAvoidingView
      keyboardVerticalOffset={header_height}
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: SPACING.md }]}>
        <Text style={styles.name_line}>
          {conversation ? conversation.otherUser.name : 'Messages'}
        </Text>
        {is_demo && (
          <View style={styles.demo_strip}>
            <Text style={styles.demo_text}>Demo mode: replies are automatic, nothing is sent</Text>
          </View>
        )}
        {list}

        {is_read_only ? (
          <View style={[styles.read_only, { marginBottom: insets.bottom + SPACING.sm }]}>
            <Text style={styles.read_only_text}>
              Your tenancy has ended, so this conversation is read-only now.
            </Text>
          </View>
        ) : null}

        {!is_read_only && photo && (
          <View style={styles.photo_preview}>
            <Image source={{ uri: photo.uri }} style={styles.photo_thumb} />
            <Text style={styles.photo_text}>Photo ready to send</Text>
            <Pressable
              onPress={() => setPhoto(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
            >
              <Ionicons name="close-circle" size={24} color={COLORS.danger_text} />
            </Pressable>
          </View>
        )}

        {!is_read_only && (
          <View style={[styles.composer, { paddingBottom: insets.bottom + SPACING.sm }]}>
            <Pressable
              onPress={pickPhoto}
              disabled={sending}
              hitSlop={8}
              style={styles.icon_button}
              accessibilityRole="button"
              accessibilityLabel="Attach a photo"
            >
              <Ionicons name="camera-outline" size={26} color={COLORS.title} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Message"
              keyboardAppearance="light"
              accessibilityLabel="Message"
              placeholderTextColor={COLORS.text_muted}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={max_body_length}
              editable={!sending}
            />
            <Pressable
              onPress={handleSend}
              disabled={!can_send}
              hitSlop={8}
              style={[styles.send_button, !can_send && styles.send_disabled]}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              {sending ? (
                <ActivityIndicator color={COLORS.text_light} />
              ) : (
                <Ionicons name="send" size={20} color={COLORS.text_light} />
              )}
            </Pressable>
          </View>
        )}
      </View>

      <ImageViewerModal url={viewer_url} onClose={() => setViewerUrl(null)} />
    </KeyboardAvoidingView>
  );
}

export default MessageThreadScreen;

const styles = StyleSheet.create({
  // the header has the screen's title now, so the name gets its own plain line instead of the big card
  name_line: {
    ...TYPE.subheading,
    fontFamily: TYPE.heading.fontFamily,
    color: COLORS.title,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  list_content: {
    paddingVertical: SPACING.sm,
    flexGrow: 1,
  },
  older: {
    padding: SPACING.md,
    minHeight: SIZES.touch,
    alignItems: 'center',
  },
  older_text: {
    ...TYPE.label,
    color: COLORS.cta,
  },
  empty_text: {
    ...TYPE.body_small,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  flip: {
    transform: [{ scaleY: -1 }],
  },
  demo_strip: {
    backgroundColor: COLORS.warning_tint,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.xs + SPACING.xxs,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  demo_text: {
    ...TYPE.caption,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.warning_text,
    textAlign: 'center',
  },
  photo_preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  photo_thumb: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
  },
  photo_text: {
    ...TYPE.body_small,
    flex: 1,
    color: COLORS.text,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER.hairline,
    borderTopColor: COLORS.border,
  },
  icon_button: {
    width: SIZES.touch,
    height: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    ...TYPE.input,
    fontSize: TYPE.body_compact.fontSize,
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border_strong,
    color: COLORS.text,
    borderRadius: RADIUS.xl + SPACING.xxs,
    flex: 1,
    minHeight: SIZES.touch,
    maxHeight: 120,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm + SPACING.xxs + 1,
    paddingBottom: SPACING.sm + SPACING.xxs + 1,
  },
  send_button: {
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.pill,
    width: SIZES.touch,
    height: SIZES.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  read_only: {
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.hairline,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + SPACING.xs,
    marginTop: SPACING.sm,
  },
  read_only_text: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.text_muted,
    textAlign: 'center',
  },
  send_disabled: {
    opacity: OPACITY.disabled,
  },
});
