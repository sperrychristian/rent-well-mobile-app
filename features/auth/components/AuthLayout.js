import { View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import ScreenTitle from '../../../components/ScreenTitle';
import Card from '../../../components/Card';
import { COLORS, SPACING, FONTS } from '../../../theme';

// the shared frame for login and both sign up screens: title, a card for the form, and room for the keyboard
// props: title, error (a message from the server shown above the form), children, footer
function AuthLayout(props) {
  const insets = useSafeAreaInsets();
  // the header sits above this screen now, so the keyboard lift has to count its height too
  const header_height = useHeaderHeight();
  return (
    // iOS needs padding to lift the form, Android already resizes the window so it gets nothing
    <KeyboardAvoidingView
      keyboardVerticalOffset={header_height}
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: SPACING.md, paddingBottom: insets.bottom + SPACING.lg },
        ]}
      >
        <ScreenTitle>{props.title}</ScreenTitle>
        {props.error ? (
          <View style={styles.error_box} accessibilityLiveRegion="polite">
            <Text style={styles.error_text}>{props.error}</Text>
          </View>
        ) : null}
        <Card>{props.children}</Card>
        {props.footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default AuthLayout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    // keeps the form a phone width on a tablet
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  error_box: {
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    padding: SPACING.sm,
    width: '90%',
    alignSelf: 'center',
  },
  error_text: {
    color: COLORS.text_light,
    fontFamily: FONTS.body_bold,
    fontSize: 14,
    textAlign: 'center',
  },
});
