import { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONTS } from '../../../theme';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import DemoBanner from '../../../components/DemoBanner';
import ErrorState from '../../../components/ErrorState';
import ConversationRow from '../components/ConversationRow';
import { useMessages } from '../context/MessagesContext';
import { useAuth } from '../../auth/context/AuthContext';

function MessagesScreen(props) {
  const insets = useSafeAreaInsets();
  // the work order screens pass the tenant's name in, so it can be missing when opened from the dashboard
  const tenant = props.route.params ? props.route.params.tenant : null;
  const { mode, my_user_id, conversations, status, error_message, reloadConversations } =
    useMessages();
  const { role } = useAuth();
  // only opens the tenant's thread once, so coming back here shows the list
  const opened_for_tenant = useRef(false);

  const tenant_conversation = tenant
    ? conversations.find(
        (conversation) =>
          conversation.otherUser.name.trim().toLowerCase() === tenant.trim().toLowerCase(),
      )
    : null;

  // coming from a work order goes straight to that tenant's thread when there is one
  useEffect(() => {
    if (tenant_conversation && !opened_for_tenant.current) {
      opened_for_tenant.current = true;
      props.navigation.navigate('MessageThread', { conversationId: tenant_conversation.id });
    }
  }, [tenant_conversation, props.navigation]);

  function openThread(conversation_id) {
    props.navigation.navigate('MessageThread', { conversationId: conversation_id });
  }

  const is_owner = mode === 'real' && role === 'owner';

  let body;
  if (mode === 'off') {
    // nobody is signed in and it's not the demo, so there's nothing to show yet
    body = (
      <Card>
        <Text style={styles.body_text}>Log in to see your messages.</Text>
        <PrimaryButton
          title="Log In"
          onPress={() => props.navigation.navigate('Login')}
          style={styles.inline_button}
        />
      </Card>
    );
  } else if (status === 'error' && conversations.length === 0) {
    body = <ErrorState message={error_message} onRetry={reloadConversations} />;
  } else if (status === 'loading' && conversations.length === 0) {
    body = <ActivityIndicator style={styles.spinner} color={COLORS.title} size="large" />;
  } else {
    body = (
      <FlatList
        style={styles.list}
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.lg }}
        refreshControl={
          mode === 'real' ? (
            <RefreshControl
              refreshing={status === 'loading'}
              onRefresh={reloadConversations}
              tintColor={COLORS.title}
            />
          ) : undefined
        }
        ListHeaderComponent={
          tenant && !tenant_conversation && status === 'ready' ? (
            <Text style={styles.note}>
              {'No conversation with ' + tenant + ' yet. They need to sign up with an invite code.'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.empty_text}>
            {is_owner
              ? 'No conversations yet. Invite a tenant and the thread shows up once they sign up.'
              : 'No conversations yet.'}
          </Text>
        }
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            my_user_id={my_user_id}
            onPress={() => openThread(item.id)}
          />
        )}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: SPACING.md }]}>
      {/* only shows while the demo is running */}
      <DemoBanner />
      {is_owner && (
        <PrimaryButton
          title="Invite a Tenant"
          icon="person-add-outline"
          text_color={COLORS.text_light}
          onPress={() => props.navigation.navigate('InviteTenant')}
          style={styles.invite_button}
        />
      )}
      {body}
    </View>
  );
}

export default MessagesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    padding: SPACING.md,
  },
  body_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
  },
  list: {
    alignSelf: 'stretch',
  },
  spinner: {
    marginTop: SPACING.lg,
  },
  inline_button: {
    marginTop: SPACING.md,
  },
  invite_button: {
    alignSelf: 'stretch',
    marginHorizontal: 0,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.success,
  },
  note: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    opacity: 0.8,
  },
  empty_text: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.7,
  },
});
