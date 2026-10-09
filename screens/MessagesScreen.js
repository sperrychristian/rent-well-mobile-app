import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONTS } from '../theme';
import ScreenTitle from '../components/ScreenTitle';
import Card from '../components/Card';

function MessagesScreen(props) {
  const insets = useSafeAreaInsets();
  // the work order screens pass the tenant's name in, so it can be missing when opened from the dashboard
  const tenant = props.route.params ? props.route.params.tenant : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <ScreenTitle>Messages</ScreenTitle>
      <Card>
        <Text style={styles.body_text}>
          {tenant
            ? 'Conversation with ' + tenant + ' coming soon'
            : 'Tenant conversations coming soon'}
        </Text>
      </Card>
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
});
