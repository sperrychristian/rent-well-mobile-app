import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitle from '../../../components/ScreenTitle';
import Card from '../../../components/Card';
import UnreadBadge from '../../messages/components/UnreadBadge';
import LogoutButton from '../../auth/components/LogoutButton';
import { useAuth } from '../../auth/context/AuthContext';
import { useMessages } from '../../messages/context/MessagesContext';
import { COLORS, SPACING, FONT_SIZES, FONTS } from '../../../theme';

// the tenant's home: message the landlord or report something that needs fixing
function TenantHomeScreen(props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unread_total } = useMessages();

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <ScreenTitle>Home</ScreenTitle>
      <Text style={styles.greeting}>Hi{user ? ', ' + user.name : ''}!</Text>

      <Pressable
        onPress={() => props.navigation.navigate('Messages')}
        accessibilityRole="button"
        accessibilityLabel={'Messages' + (unread_total ? ', ' + unread_total + ' unread' : '')}
        style={({ pressed }) => [styles.card_press, pressed && styles.pressed]}
      >
        <Card>
          <View style={styles.card_row}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={COLORS.action} />
            <View style={styles.card_text}>
              <Text style={styles.card_title}>Messages</Text>
              <Text style={styles.card_detail}>Talk with your landlord</Text>
            </View>
            <UnreadBadge count={unread_total} />
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </View>
        </Card>
      </Pressable>

      {/* still saves on this phone only, it moves to the server in a later phase */}
      <Pressable
        onPress={() => props.navigation.navigate('NewWorkOrder')}
        accessibilityRole="button"
        accessibilityLabel="Report an issue"
        style={({ pressed }) => [styles.card_press, pressed && styles.pressed]}
      >
        <Card>
          <View style={styles.card_row}>
            <Ionicons name="construct-outline" size={32} color={COLORS.danger} />
            <View style={styles.card_text}>
              <Text style={styles.card_title}>Report an Issue</Text>
              <Text style={styles.card_detail}>Something broken or not working</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </View>
        </Card>
      </Pressable>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <LogoutButton />
      </View>
    </View>
  );
}

export default TenantHomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  greeting: {
    color: COLORS.text,
    fontFamily: FONTS.subheading,
    fontSize: FONT_SIZES.body,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  card_press: {
    width: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
  card_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  card_text: {
    flex: 1,
  },
  card_title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: FONT_SIZES.body,
  },
  card_detail: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    opacity: 0.8,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
