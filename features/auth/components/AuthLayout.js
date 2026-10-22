import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/ui/Card';
import Wordmark from '../../../components/ui/Wordmark';
import FadeInView from '../../../components/ui/FadeInView';
import { COLORS, SPACING, TYPE, RADIUS, SIZES } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

// the shared frame for login and both sign up screens: title, a card for the form, and room for the keyboard
// props: title, error (a message from the server shown above the form), children, footer
// the design pass added the Rent Well lockup on top and subtitle (one line saying what this form is for)
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
        {/* the title prop isn't drawn anymore, the header above already shows the same title */}
        <FadeInView index={0} style={styles.top}>
          <Wordmark size="medium" tagline={null} />
          {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
        </FadeInView>
        {props.error ? (
          <View style={styles.error_box} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle-outline" size={SIZES.icon} color={COLORS.danger_text} />
            <Text style={styles.error_text}>{props.error}</Text>
          </View>
        ) : null}
        <FadeInView index={1}>
          <Card style={styles.form_card}>{props.children}</Card>
        </FadeInView>
        <FadeInView index={2}>{props.footer}</FadeInView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default AuthLayout;

const styles = themedStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.screen_padding,
    // keeps the form a phone width on a tablet
    width: '100%',
    maxWidth: SIZES.content_max_width,
    alignSelf: 'center',
  },
  top: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  subtitle: {
    ...TYPE.body,
    color: COLORS.text_muted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  form_card: {
    marginBottom: SPACING.lg,
  },
  // the Hearth pass: a quiet warm note with a line icon, no red edge
  error_box: {
    backgroundColor: COLORS.danger_tint,
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md - SPACING.xs,
    marginBottom: SPACING.md,
  },
  error_text: {
    ...TYPE.body_small,
    fontFamily: TYPE.label.fontFamily,
    color: COLORS.danger_text,
    flex: 1,
  },
}));
